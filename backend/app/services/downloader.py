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
}


def init_downloader(max_concurrent: int = 3):
    global _download_semaphore
    _runtime["max_concurrent_downloads"] = max_concurrent
    _download_semaphore = asyncio.Semaphore(max_concurrent)


def apply_settings(max_concurrent: int, download_chunks: int, speed_limit_bps: int):
    global _download_semaphore
    _runtime["max_concurrent_downloads"] = max_concurrent
    _runtime["download_chunks"] = download_chunks
    _runtime["speed_limit_bps"] = speed_limit_bps
    _download_semaphore = asyncio.Semaphore(max_concurrent)


def get_download_settings() -> dict:
    return _runtime.copy()


def set_ws_manager(manager):
    global _ws_manager
    _ws_manager = manager


async def _broadcast(download_id: int, data: dict):
    if _ws_manager:
        await _ws_manager.broadcast({"download_id": download_id, **data})


async def _check_range_support(session: aiohttp.ClientSession, url: str) -> tuple[bool, int]:
    """Check if server supports byte ranges. Returns (supports_range, content_length)."""
    try:
        async with session.head(url, allow_redirects=True, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            content_length = int(resp.headers.get("Content-Length", 0))
            accept_ranges = resp.headers.get("Accept-Ranges", "none").lower()
            return accept_ranges != "none" and content_length > 0, content_length
    except Exception:
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
        _download_semaphore = asyncio.Semaphore(_runtime["max_concurrent_downloads"])

    if num_chunks is None:
        num_chunks = _runtime["download_chunks"]

    logger.info(
        f"[Download #{download_id}] download_file called — chunks={num_chunks}, "
        f"semaphore_value={_download_semaphore._value}, output={output_path}"
    )

    _cancel_flags[download_id] = False
    _pause_flags[download_id] = False

    tmp_dir = f"{output_path}.parts"
    logger.info(f"[Download #{download_id}] Creating tmp dir: {tmp_dir}")
    await asyncio.to_thread(os.makedirs, tmp_dir, exist_ok=True)
    logger.info(f"[Download #{download_id}] Tmp dir ready")

    # Acquire a download slot — this is the concurrency gate for ALL download types
    logger.info(
        f"[Download #{download_id}] Waiting for semaphore slot "
        f"(max_concurrent={_runtime['max_concurrent_downloads']})..."
    )
    await _download_semaphore.acquire()
    _slot_active.add(download_id)
    logger.info(f"[Download #{download_id}] Slot acquired")

    try:
        connector = aiohttp.TCPConnector(ssl=False, limit=num_chunks + 4)
        async with aiohttp.ClientSession(connector=connector) as session:
            logger.info(f"[Download #{download_id}] Checking range support...")
            supports_range, total_bytes = await _check_range_support(session, url)
            logger.info(
                f"[Download #{download_id}] Range support: {supports_range}, "
                f"size: {total_bytes} bytes ({total_bytes / 1024 / 1024:.1f} MB)"
            )

            if not supports_range or total_bytes == 0:
                logger.info(f"[Download #{download_id}] Falling back to single-stream download")
                return await _single_stream_download(
                    session, download_id, url, output_path, total_bytes, tmp_dir, db_updater
                )

            # Parallel chunk download
            chunk_size = total_bytes // num_chunks
            chunks = []
            for i in range(num_chunks):
                start = i * chunk_size
                end = start + chunk_size - 1 if i < num_chunks - 1 else total_bytes - 1
                chunk_file = os.path.join(tmp_dir, f"chunk_{i:04d}")
                chunks.append((start, end, chunk_file))

            if db_updater:
                await db_updater(download_id, status="downloading", total_bytes=total_bytes)

            await _broadcast(download_id, {"status": "downloading", "total_bytes": total_bytes})

            downloaded_per_chunk = [0] * num_chunks
            start_time = time.time()
            total_downloaded = [0]

            async def download_chunk_with_progress(i, start, end, chunk_file):
                async def track(session, url, start, end, chunk_file, did):
                    headers = {"Range": f"bytes={start}-{end}"}
                    existing = 0
                    if os.path.exists(chunk_file):
                        existing = os.path.getsize(chunk_file)
                        if existing >= (end - start + 1):
                            downloaded_per_chunk[i] = existing
                            total_downloaded[0] += existing
                            return True
                        start += existing
                        downloaded_per_chunk[i] = existing
                        total_downloaded[0] += existing

                    mode = "ab" if existing > 0 else "wb"
                    try:
                        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=None, connect=30)) as resp:
                            resp.raise_for_status()
                            with open(chunk_file, mode) as f:
                                try:
                                    async for data in resp.content.iter_chunked(65536):
                                        if _cancel_flags.get(did):
                                            return False
                                        while _pause_flags.get(did):
                                            await asyncio.sleep(0.5)
                                        f.write(data)
                                        downloaded_per_chunk[i] += len(data)
                                        total_downloaded[0] += len(data)

                                        limit = _runtime["speed_limit_bps"]
                                        if limit > 0:
                                            per_slot = limit / max(1, _runtime["max_concurrent_downloads"])
                                            elapsed = time.time() - start_time
                                            expected = total_downloaded[0] / per_slot
                                            if elapsed < expected:
                                                await asyncio.sleep(expected - elapsed)
                                except aiohttp.ClientPayloadError as e:
                                    if downloaded_per_chunk[i] == 0:
                                        raise
                                    logger.warning(f"Chunk {i}: server closed early ({e}), treating as complete")
                        return True
                    except Exception as e:
                        logger.error(f"Chunk {i} failed: {e}")
                        return False

                return await track(session, url, start, end, chunk_file, download_id)

            # Progress reporter task
            progress_done = asyncio.Event()

            async def report_progress():
                while not progress_done.is_set():
                    elapsed = time.time() - start_time
                    done = sum(downloaded_per_chunk)
                    speed = int(done / elapsed) if elapsed > 0 else 0
                    pct = (done / total_bytes * 100) if total_bytes > 0 else 0
                    eta = int((total_bytes - done) / speed) if speed > 0 else 0

                    if db_updater:
                        await db_updater(
                            download_id,
                            downloaded_bytes=done,
                            progress_pct=round(pct, 2),
                            speed_bps=speed,
                        )
                    await _broadcast(download_id, {
                        "progress": round(pct, 2),
                        "speed_bps": speed,
                        "downloaded_bytes": done,
                        "total_bytes": total_bytes,
                        "eta_seconds": eta,
                    })
                    await asyncio.sleep(1)

            reporter = asyncio.create_task(report_progress())

            try:
                logger.info(f"[Download #{download_id}] Launching {num_chunks} chunks")
                tasks = [
                    asyncio.create_task(download_chunk_with_progress(i, s, e, f))
                    for i, (s, e, f) in enumerate(chunks)
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                logger.info(f"[Download #{download_id}] All chunks finished, results: {[type(r).__name__ for r in results]}")
            finally:
                progress_done.set()
                reporter.cancel()

            if _cancel_flags.get(download_id):
                return False

            if any(r is False or isinstance(r, Exception) for r in results):
                raise RuntimeError("One or more chunks failed")

            # Merge
            chunk_files = [c[2] for c in chunks]
            await _merge_chunks(chunk_files, output_path)

            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass

            if db_updater:
                await db_updater(
                    download_id,
                    status="completed",
                    progress_pct=100.0,
                    downloaded_bytes=total_bytes,
                )
            await _broadcast(download_id, {"status": "completed", "progress": 100.0})
            return True

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
    if downloaded > 0 and total_bytes > 0:
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
                    if downloaded == 0:
                        raise
                    # Server closed early with wrong Content-Length — common on IPTV
                    # servers. We received data so treat it as complete.
                    logger.warning(
                        f"Download {download_id}: server closed early ({e}), "
                        f"{downloaded} bytes received — treating as complete"
                    )

        os.rename(tmp_file, output_path)
        try:
            os.rmdir(tmp_dir)
        except OSError:
            pass

        if db_updater:
            await db_updater(download_id, status="completed", progress_pct=100.0)
        await _broadcast(download_id, {"status": "completed", "progress": 100.0})
        return True
    except Exception as e:
        logger.error(f"Single stream download failed: {e}")
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
