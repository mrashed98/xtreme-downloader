"""IDM-like parallel chunk download engine."""
from __future__ import annotations
import asyncio
import aiohttp
import os
import time
import logging
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database import AsyncSession

logger = logging.getLogger(__name__)

# Global state
_download_semaphore: asyncio.Semaphore | None = None
_active_downloads: dict[int, asyncio.Task] = {}
_cancel_flags: dict[int, bool] = {}
_pause_flags: dict[int, bool] = {}
_slot_active: set[int] = set()  # downloads currently holding a semaphore slot
_ws_manager: "WSManager | None" = None

_runtime = {
    "max_concurrent_downloads": 3,
    "download_chunks": 16,
    "speed_limit_bps": 0,
    "max_retries": 2,
}


class IncompleteDownloadError(RuntimeError):
    pass


def init_downloader(max_concurrent: int = 3):
    global _download_semaphore
    _runtime["max_concurrent_downloads"] = max_concurrent
    _download_semaphore = asyncio.Semaphore(max_concurrent)


def apply_settings(
    max_concurrent: int,
    download_chunks: int,
    speed_limit_bps: int,
    max_retries: int,
):
    global _download_semaphore
    old_max = _runtime["max_concurrent_downloads"]
    _runtime["max_concurrent_downloads"] = max_concurrent
    _runtime["download_chunks"] = download_chunks
    _runtime["speed_limit_bps"] = speed_limit_bps
    _runtime["max_retries"] = max_retries

    if _download_semaphore is None:
        _download_semaphore = asyncio.Semaphore(max_concurrent)
        logger.info(f"Semaphore initialized: max_concurrent={max_concurrent}")
    elif max_concurrent != old_max:
        # Adjust semaphore capacity without replacing the object.
        # Replacing would orphan any tasks currently blocked on acquire().
        diff = max_concurrent - old_max
        if diff > 0:
            for _ in range(diff):
                _download_semaphore.release()
            logger.info(
                f"Semaphore capacity increased: {old_max} → {max_concurrent} "
                f"(released {diff} extra slots)"
            )
        else:
            # Shrinking: existing slot holders keep their slots; new requests
            # just see fewer available. Track the new logical max in _runtime.
            logger.info(
                f"Semaphore capacity decreased: {old_max} → {max_concurrent} "
                f"(existing holders unaffected, active={len(_slot_active)})"
            )
    else:
        logger.info(f"Settings applied (semaphore unchanged): max_concurrent={max_concurrent}")


def get_download_settings() -> dict:
    return _runtime.copy()


def set_ws_manager(manager):
    global _ws_manager
    _ws_manager = manager


async def _broadcast(download_id: int, data: dict):
    if _ws_manager:
        await _ws_manager.broadcast({"download_id": download_id, **data})


async def _check_range_support(session: aiohttp.ClientSession, url: str, download_id: int) -> tuple[bool, int]:
    """Check if server supports byte ranges. Returns (supports_range, content_length)."""
    try:
        async with session.head(url, allow_redirects=True, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            content_length = int(resp.headers.get("Content-Length", 0))
            accept_ranges = resp.headers.get("Accept-Ranges", "none").lower()
            return accept_ranges != "none" and content_length > 0, content_length
    except Exception as e:
        logger.warning(f"[Download #{download_id}] HEAD request failed (no range support): {e}")
        return False, 0


async def _download_chunk(
    session: aiohttp.ClientSession,
    url: str,
    start: int,
    end: int,
    chunk_file: str,
    download_id: int,
) -> int:
    """Download a single byte range chunk. Returns bytes downloaded."""
    headers = {"Range": f"bytes={start}-{end}"}
    downloaded = 0

    # Resume: check existing partial chunk
    existing_size = 0
    if os.path.exists(chunk_file):
        existing_size = os.path.getsize(chunk_file)
        if existing_size >= (end - start + 1):
            return existing_size  # chunk complete
        start += existing_size

    mode = "ab" if existing_size > 0 else "wb"
    async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=None, connect=30)) as resp:
        resp.raise_for_status()
        with open(chunk_file, mode) as f:
            async for chunk in resp.content.iter_chunked(65536):
                if _cancel_flags.get(download_id):
                    return downloaded
                while _pause_flags.get(download_id):
                    await asyncio.sleep(0.5)
                f.write(chunk)
                downloaded += len(chunk)

    return existing_size + downloaded


async def _merge_chunks(chunk_files: list[str], output_path: str):
    """Merge chunk files into final output."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as out:
        for chunk_file in chunk_files:
            with open(chunk_file, "rb") as cf:
                while True:
                    data = cf.read(1024 * 1024)
                    if not data:
                        break
                    out.write(data)
            os.remove(chunk_file)


async def download_file(
    download_id: int,
    url: str,
    output_path: str,
    num_chunks: int | None = None,
    db_updater=None,
) -> bool:
    """Main download function. Returns True on success."""
    global _download_semaphore
    if _download_semaphore is None:
        logger.warning(
            f"[Download #{download_id}] Semaphore was None — initializing fallback "
            f"(max_concurrent={_runtime['max_concurrent_downloads']}). "
            "This means init_downloader() was not called before the first download."
        )
        _download_semaphore = asyncio.Semaphore(_runtime["max_concurrent_downloads"])

    num_chunks = 1

    logger.info(
        f"[Download #{download_id}] download_file called — "
        f"semaphore_value={_download_semaphore._value}, "
        f"active_slots={len(_slot_active)}/{_runtime['max_concurrent_downloads']}, "
        f"output={output_path}"
    )

    _cancel_flags[download_id] = False
    _pause_flags[download_id] = False

    tmp_dir = f"{output_path}.parts"
    logger.info(f"[Download #{download_id}] Creating tmp dir: {tmp_dir}")
    try:
        await asyncio.to_thread(os.makedirs, tmp_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"[Download #{download_id}] Failed to create tmp dir '{tmp_dir}': {e}")
        raise
    logger.info(f"[Download #{download_id}] Tmp dir ready")

    # Acquire a download slot — this is the concurrency gate for ALL download types
    slot_wait_start = time.time()
    if _download_semaphore._value == 0:
        logger.warning(
            f"[Download #{download_id}] Semaphore is fully occupied "
            f"(active_slots={len(_slot_active)}/{_runtime['max_concurrent_downloads']}) — "
            "download will wait for a free slot"
        )
    else:
        logger.info(
            f"[Download #{download_id}] Waiting for semaphore slot "
            f"(free={_download_semaphore._value}/{_runtime['max_concurrent_downloads']})..."
        )
    await _download_semaphore.acquire()
    slot_wait_elapsed = time.time() - slot_wait_start
    _slot_active.add(download_id)
    logger.info(
        f"[Download #{download_id}] Slot acquired after {slot_wait_elapsed:.1f}s wait "
        f"(active_slots={len(_slot_active)}/{_runtime['max_concurrent_downloads']})"
    )

    try:
        connector = aiohttp.TCPConnector(ssl=False, limit=2)
        async with aiohttp.ClientSession(connector=connector) as session:
            logger.info(f"[Download #{download_id}] Checking range support for: {url[:80]}...")
            supports_range, total_bytes = await _check_range_support(session, url, download_id)
            logger.info(
                f"[Download #{download_id}] Range support: {supports_range}, "
                f"size: {total_bytes} bytes ({total_bytes / 1024 / 1024:.1f} MB)"
            )
            max_retries = max(0, int(_runtime.get("max_retries", 0)))
            attempts = max_retries + 1
            for attempt in range(1, attempts + 1):
                try:
                    return await _single_stream_download(
                        session,
                        download_id,
                        url,
                        output_path,
                        total_bytes,
                        tmp_dir,
                        db_updater,
                        supports_range,
                    )
                except IncompleteDownloadError as e:
                    if attempt >= attempts:
                        raise
                    backoff = min(2 * attempt, 6)
                    logger.warning(
                        f"[Download #{download_id}] Incomplete download ({e}); "
                        f"retrying in {backoff}s ({attempt}/{attempts - 1})"
                    )
                    await asyncio.sleep(backoff)
            raise IncompleteDownloadError("Download failed after retries")

    finally:
        # Release semaphore slot if we still hold it (not already released by pause)
        if download_id in _slot_active:
            _slot_active.discard(download_id)
            _download_semaphore.release()


async def _single_stream_download(
    session: aiohttp.ClientSession,
    download_id: int,
    url: str,
    output_path: str,
    total_bytes: int,
    tmp_dir: str,
    db_updater,
    supports_range: bool,
) -> bool:
    """Fallback single-stream download."""
    logger.info(f"[Download #{download_id}] Single-stream download starting")
    await asyncio.to_thread(Path(output_path).parent.mkdir, parents=True, exist_ok=True)

    # Transition status to "downloading" immediately — same as the parallel chunk path.
    # Without this the status stays "queued" in both the DB and WebSocket until completion.
    if db_updater:
        await db_updater(download_id, status="downloading", total_bytes=total_bytes)
    await _broadcast(download_id, {"status": "downloading", "total_bytes": total_bytes})

    tmp_file = os.path.join(tmp_dir, "stream")
    downloaded = 0
    start_time = time.time()

    if os.path.exists(tmp_file):
        downloaded = os.path.getsize(tmp_file)

    headers = {}
    if downloaded > 0 and not supports_range:
        await asyncio.to_thread(os.remove, tmp_file)
        downloaded = 0

    if downloaded > 0 and supports_range:
        headers["Range"] = f"bytes={downloaded}-"

    mode = "ab" if downloaded > 0 else "wb"
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=None, connect=30)) as resp:
            resp.raise_for_status()
            if total_bytes == 0:
                total_bytes = int(resp.headers.get("Content-Length", 0))

            with open(tmp_file, mode) as f:
                try:
                    async for chunk in resp.content.iter_chunked(65536):
                        if _cancel_flags.get(download_id):
                            return False
                        while _pause_flags.get(download_id):
                            await asyncio.sleep(0.5)
                        f.write(chunk)
                        downloaded += len(chunk)
                        elapsed = time.time() - start_time
                        speed = int(downloaded / elapsed) if elapsed > 0 else 0
                        pct = (downloaded / total_bytes * 100) if total_bytes > 0 else 0
                        if db_updater:
                            await db_updater(
                                download_id,
                                downloaded_bytes=downloaded,
                                progress_pct=round(pct, 2),
                                speed_bps=speed,
                                total_bytes=total_bytes,
                            )
                        await _broadcast(download_id, {
                            "progress": round(pct, 2),
                            "speed_bps": speed,
                            "downloaded_bytes": downloaded,
                            "total_bytes": total_bytes,
                        })

                        limit = _runtime["speed_limit_bps"]
                        if limit > 0:
                            expected = downloaded / limit
                            if elapsed < expected:
                                await asyncio.sleep(expected - elapsed)
                except aiohttp.ClientPayloadError as e:
                    if total_bytes > 0 and downloaded < total_bytes:
                        raise IncompleteDownloadError(
                            f"server closed early: expected {total_bytes} bytes, got {downloaded}"
                        ) from e
                    if downloaded == 0:
                        raise

        if total_bytes > 0 and downloaded < total_bytes:
            raise IncompleteDownloadError(
                f"incomplete download: expected {total_bytes} bytes, got {downloaded}"
            )

        await asyncio.to_thread(os.rename, tmp_file, output_path)
        try:
            await asyncio.to_thread(os.rmdir, tmp_dir)
        except OSError:
            pass

        if db_updater:
            await db_updater(download_id, status="completed", progress_pct=100.0)
        await _broadcast(download_id, {"status": "completed", "progress": 100.0})
        return True
    except Exception as e:
        logger.error(f"[Download #{download_id}] Single stream download failed: {e}", exc_info=True)
        raise


def pause_download(download_id: int):
    _pause_flags[download_id] = True
    # Release the semaphore slot while paused so another queued download can start
    if download_id in _slot_active:
        _slot_active.discard(download_id)
        _download_semaphore.release()
        logger.info(f"[Download #{download_id}] Slot released (paused)")


async def _do_resume(download_id: int):
    """Re-acquire a semaphore slot, then clear the pause flag to wake the download."""
    if _cancel_flags.get(download_id):
        return
    logger.info(f"[Download #{download_id}] Waiting to re-acquire slot after resume...")
    await _download_semaphore.acquire()
    if _cancel_flags.get(download_id):
        # Cancelled while waiting — give the slot back immediately
        _download_semaphore.release()
        return
    _slot_active.add(download_id)
    logger.info(f"[Download #{download_id}] Slot re-acquired, clearing pause flag")
    _pause_flags[download_id] = False


def resume_download(download_id: int):
    asyncio.create_task(_do_resume(download_id))


def cancel_download(download_id: int):
    _cancel_flags[download_id] = True
    _pause_flags[download_id] = False
    task = _active_downloads.get(download_id)
    if task:
        task.cancel()


def register_task(download_id: int, task: asyncio.Task):
    _active_downloads[download_id] = task


def unregister_task(download_id: int):
    _active_downloads.pop(download_id, None)
    _cancel_flags.pop(download_id, None)
    _pause_flags.pop(download_id, None)
    _slot_active.discard(download_id)
