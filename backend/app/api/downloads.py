import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.download import Download, DownloadStatus, ContentType, statuses_for_filter
from app.models.playlist import Playlist
from app.models.stream import VodStream, Series, Episode
from app.schemas.download import (
    BulkActionItemError,
    BulkActionRequest,
    BulkActionResponse,
    DownloadResponse,
)
from app.services import downloader as dl_service
from app.services.download_runner import schedule_download
from app.services.xtream import XtreamClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/downloads", tags=["downloads"])


async def _poster_map(db: AsyncSession, downloads: list[Download]) -> dict[int, str | None]:
    """Resolve artwork per download: VOD icon by stream_id; series cover via the
    episode → series join (series downloads store the *episode* id)."""
    vod_ids = {d.stream_id for d in downloads if d.content_type == ContentType.vod}
    ep_ids = {d.stream_id for d in downloads if d.content_type == ContentType.series}

    vod_icons: dict[str, str | None] = {}
    if vod_ids:
        result = await db.execute(
            select(VodStream.stream_id, VodStream.icon).where(VodStream.stream_id.in_(vod_ids))
        )
        vod_icons = {row[0]: row[1] for row in result.all()}

    ep_covers: dict[str, str | None] = {}
    if ep_ids:
        result = await db.execute(
            select(Episode.episode_id, Series.cover)
            .join(Series, Episode.series_id == Series.id)
            .where(Episode.episode_id.in_(ep_ids))
        )
        ep_covers = {row[0]: row[1] for row in result.all()}

    out: dict[int, str | None] = {}
    for d in downloads:
        if d.content_type == ContentType.vod:
            out[d.id] = vod_icons.get(d.stream_id)
        elif d.content_type == ContentType.series:
            out[d.id] = ep_covers.get(d.stream_id)
        else:
            out[d.id] = None
    return out


# ---------------------------------------------------------------- action core
# The single-download endpoints and the bulk endpoint share these so the rules
# can only ever be stated once. They raise ValueError for a business-rule
# violation; callers decide whether that becomes a 400 or a per-item error.


async def _get(db: AsyncSession, download_id: int) -> Download:
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise LookupError("Download not found")
    return dl


async def _pause_one(db: AsyncSession, dl: Download) -> Download:
    if dl.status not in (DownloadStatus.downloading, DownloadStatus.queued):
        raise ValueError(f"Cannot pause download in status '{dl.status.value}'")
    dl_service.pause_download(dl.id)
    dl.status = DownloadStatus.paused
    return dl


async def _resume_one(db: AsyncSession, dl: Download) -> Download:
    if dl.status != DownloadStatus.paused:
        raise ValueError(f"Download is not paused (status: '{dl.status.value}')")
    dl_service.resume_download(dl.id)
    dl.status = DownloadStatus.downloading
    return dl


async def _retry_one(
    db: AsyncSession, dl: Download, playlist_cache: dict[int, Playlist] | None = None
) -> tuple[str, str, str]:
    """Reset the row for a re-run and return (url, dest, label).

    Returns the schedule args rather than scheduling directly: the caller must
    commit first, or the runner can read the row before the new status is
    visible.
    """
    if dl.status not in (DownloadStatus.failed, DownloadStatus.cancelled):
        raise ValueError(
            f"Only failed or cancelled downloads can be retried (status: '{dl.status.value}')"
        )
    if dl.content_type == ContentType.live:
        raise ValueError("Live streams are not downloadable")
    if not dl.file_path:
        raise ValueError("Download has no file_path -- cannot retry")

    # Cache playlists: retrying a whole failed series would otherwise re-query
    # the same playlist once per episode.
    cache = playlist_cache if playlist_cache is not None else {}
    playlist = cache.get(dl.playlist_id)
    if playlist is None:
        pl_result = await db.execute(select(Playlist).where(Playlist.id == dl.playlist_id))
        playlist = pl_result.scalar_one_or_none()
        if not playlist:
            raise ValueError("Playlist not found")
        cache[dl.playlist_id] = playlist

    # Derive container ext from existing file_path (fallback by content type).
    _, dot_ext = os.path.splitext(dl.file_path)
    ext = dot_ext.lstrip(".") or ("mkv" if dl.content_type == ContentType.series else "mp4")

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    if dl.content_type == ContentType.vod:
        url = client.build_vod_url(dl.stream_id, ext)
        label = "VOD-retry"
    else:
        url = client.build_series_url(dl.stream_id, ext)
        label = "Series-retry"

    # Purge any stale pause/cancel flags from the prior lifecycle before re-scheduling.
    dl_service.unregister_task(dl.id)

    dl.status = DownloadStatus.queued
    dl.progress_pct = 0.0
    dl.downloaded_bytes = 0
    dl.speed_bps = 0
    dl.error_message = None
    dl.completed_at = None
    return url, dl.file_path, label


async def _delete_one(db: AsyncSession, dl: Download, delete_file: bool) -> None:
    dl_service.cancel_download(dl.id)
    if delete_file and dl.file_path and os.path.exists(dl.file_path):
        try:
            os.remove(dl.file_path)
        except OSError as e:
            logger.warning(f"Could not delete file {dl.file_path}: {e}")
    await db.delete(dl)


@router.get("", response_model=list[DownloadResponse])
async def list_downloads(
    status: str | None = Query(None),
    content_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Download)
    if status:
        query = query.where(Download.status == status)
    if content_type:
        query = query.where(Download.content_type == content_type)
    query = query.order_by(Download.created_at.desc())
    result = await db.execute(query)
    downloads = list(result.scalars().all())

    posters = await _poster_map(db, downloads)
    return [
        DownloadResponse.model_validate(d).model_copy(update={"poster": posters.get(d.id)})
        for d in downloads
    ]


@router.get("/{download_id}", response_model=DownloadResponse)
async def get_download(download_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")
    return dl


@router.post("/{download_id}/pause", response_model=DownloadResponse)
async def pause_download(download_id: int, db: AsyncSession = Depends(get_db)):
    try:
        dl = await _get(db, download_id)
        await _pause_one(db, dl)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    await db.refresh(dl)
    return dl


@router.post("/{download_id}/resume", response_model=DownloadResponse)
async def resume_download(
    download_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        dl = await _get(db, download_id)
        await _resume_one(db, dl)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    await db.refresh(dl)
    return dl


@router.post("/{download_id}/retry", response_model=DownloadResponse)
async def retry_download(download_id: int, db: AsyncSession = Depends(get_db)):
    try:
        dl = await _get(db, download_id)
        url, dest, label = await _retry_one(db, dl)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    await db.commit()
    await db.refresh(dl)
    logger.info(f"[{label} #{dl.id}] Retry scheduled")
    schedule_download(dl.id, url, dest, label)
    return dl


@router.delete("/{download_id}", status_code=204)
async def delete_download(
    download_id: int,
    delete_file: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    try:
        dl = await _get(db, download_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    await _delete_one(db, dl, delete_file)
    await db.commit()


@router.post("/bulk", response_model=BulkActionResponse)
async def bulk_action(req: BulkActionRequest, db: AsyncSession = Depends(get_db)):
    """Apply one action to many downloads.

    Either `ids` (an explicit selection) or `status` (everything in that state,
    which is how "retry all failed" works without the client enumerating ids).
    """
    if not req.ids and not req.status:
        raise HTTPException(400, "Provide either 'ids' or 'status'")

    query = select(Download)
    if req.ids:
        query = query.where(Download.id.in_(req.ids))
    else:
        try:
            query = query.where(Download.status.in_(statuses_for_filter(req.status)))
        except ValueError:
            raise HTTPException(400, f"Unknown status '{req.status}'")
    # Oldest first so a bulk retry re-queues in the order things were added.
    query = query.order_by(Download.created_at.asc())

    result = await db.execute(query)
    targets = list(result.scalars().all())

    errors: list[BulkActionItemError] = []
    to_schedule: list[tuple[int, str, str, str]] = []
    playlist_cache: dict[int, Playlist] = {}
    succeeded = 0

    for dl in targets:
        try:
            if req.action == "pause":
                await _pause_one(db, dl)
            elif req.action == "resume":
                await _resume_one(db, dl)
            elif req.action == "retry":
                url, dest, label = await _retry_one(db, dl, playlist_cache)
                to_schedule.append((dl.id, url, dest, label))
            elif req.action == "delete":
                await _delete_one(db, dl, req.delete_file)
            succeeded += 1
        except ValueError as e:
            # One item in the wrong state must not abort the batch.
            errors.append(BulkActionItemError(id=dl.id, error=str(e)))

    await db.commit()

    # Scheduled only after the commit, so the runner sees status=queued.
    for dl_id, url, dest, label in to_schedule:
        logger.info(f"[{label} #{dl_id}] Bulk retry scheduled")
        schedule_download(dl_id, url, dest, label)

    logger.info(
        f"[bulk {req.action}] requested={len(targets)} ok={succeeded} failed={len(errors)}"
    )
    return BulkActionResponse(
        action=req.action, requested=len(targets), succeeded=succeeded, errors=errors
    )
