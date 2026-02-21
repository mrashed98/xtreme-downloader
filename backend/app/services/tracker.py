"""Series episode tracker — detects new episodes and auto-queues downloads."""
from __future__ import annotations
import logging
import os
from datetime import datetime

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SeriesTracking, Series, Episode, Download
from app.models.download import DownloadStatus, ContentType
from app.services.xtream import XtreamClient
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def check_tracked_series(db: AsyncSession):
    """Check all tracked series for new episodes and queue downloads."""
    result = await db.execute(
        select(SeriesTracking).join(Series, SeriesTracking.series_id == Series.id)
    )
    trackings = result.scalars().all()

    for tracking in trackings:
        try:
            await _process_tracking(db, tracking)
        except Exception as e:
            logger.error(f"Error processing tracking {tracking.id}: {e}")


async def _process_tracking(db: AsyncSession, tracking: SeriesTracking):
    """Process a single series tracking entry."""
    # Get series info
    result = await db.execute(select(Series).where(Series.id == tracking.series_id))
    series = result.scalar_one_or_none()
    if not series:
        return

    # Get playlist credentials
    from app.models.playlist import Playlist
    result = await db.execute(select(Playlist).where(Playlist.id == tracking.playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist or not playlist.is_active:
        return

    # Fetch fresh data from API
    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    try:
        raw = await client.get_series_info(series.series_id)
        parsed = client.parse_series_info(raw)
    finally:
        await client.close()

    # Determine tracked seasons
    tracked_seasons: set[int] | None = None
    if not tracking.track_all_seasons and tracking.seasons_json:
        tracked_seasons = set(tracking.seasons_json)

    # Get existing episode IDs from DB
    result = await db.execute(
        select(Episode.episode_id).where(Episode.series_id == series.id)
    )
    existing_episode_ids = {row[0] for row in result.all()}

    # Find new episodes
    new_episodes = []
    for season_key, episode_list in parsed["episodes"].items():
        season_num = int(season_key)
        if tracked_seasons is not None and season_num not in tracked_seasons:
            continue

        for ep in episode_list:
            ep_id = str(ep.get("id", ""))
            if ep_id and ep_id not in existing_episode_ids:
                new_episodes.append((season_num, ep))

    if not new_episodes:
        tracking.last_checked_at = datetime.utcnow()
        await db.commit()
        return

    logger.info(f"Found {len(new_episodes)} new episodes for series '{series.name}'")

    # Save new episodes to DB
    for season_num, ep in new_episodes:
        episode = Episode(
            series_id=series.id,
            season_num=season_num,
            episode_id=str(ep.get("id", "")),
            episode_num=_safe_int(ep.get("episode_num")),
            title=ep.get("title", ""),
            container_extension=ep.get("container_extension", "mkv"),
            added=str(ep.get("added", "")),
            duration=str(ep.get("info", {}).get("duration", "") if isinstance(ep.get("info"), dict) else ""),
        )
        db.add(episode)

    await db.flush()

    # Queue downloads for new episodes
    for season_num, ep in new_episodes:
        ext = ep.get("container_extension", "mkv")
        ep_id = str(ep.get("id", ""))
        ep_num = _safe_int(ep.get("episode_num")) or 0
        title = ep.get("title") or f"Episode {ep_num}"
        safe_series = _safe_filename(series.name)
        safe_title = _safe_filename(title)
        lang = tracking.language

        file_path = os.path.join(
            settings.media_path,
            "Series",
            lang,
            safe_series,
            f"Season {season_num}",
            f"{safe_title}.{ext}",
        )

        url = XtreamClient(playlist.base_url, playlist.username, playlist.password).build_series_url(ep_id, ext)

        download = Download(
            playlist_id=tracking.playlist_id,
            content_type=ContentType.series,
            stream_id=ep_id,
            title=f"{series.name} S{season_num:02d}E{ep_num:02d} - {title}",
            language=lang,
            file_path=file_path,
            status=DownloadStatus.queued,
        )
        db.add(download)

    tracking.last_checked_at = datetime.utcnow()
    await db.commit()

    # Trigger downloader for new queued items
    await _trigger_queued_downloads(db, playlist)


async def _trigger_queued_downloads(db: AsyncSession, playlist):
    """Kick off any queued downloads."""
    from app.services import downloader as dl_service
    from app.services.xtream import XtreamClient

    result = await db.execute(
        select(Download).where(
            and_(
                Download.status == DownloadStatus.queued,
                Download.playlist_id == playlist.id,
            )
        ).limit(10)
    )
    queued = result.scalars().all()

    for download in queued:
        if download.id in dl_service._active_downloads:
            continue

        client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
        url = client.build_series_url(download.stream_id, download.file_path.rsplit(".", 1)[-1] if download.file_path else "mkv")

        import asyncio
        logger.info(
            f"[Tracker #{download.id}] Scheduling orphaned queued download — "
            f"active_tasks={len(dl_service._active_downloads)}"
        )
        task = asyncio.create_task(
            _run_download(db, download.id, url, download.file_path or "/tmp/unknown")
        )
        task.add_done_callback(lambda t, did=download.id: _log_task_result(t, did))
        dl_service.register_task(download.id, task)
        logger.info(f"[Tracker #{download.id}] Task created and registered")


def _log_task_result(task, download_id: int):
    if task.cancelled():
        logger.warning(f"[Tracker #{download_id}] Task was cancelled unexpectedly")
    elif task.exception() is not None:
        logger.error(
            f"[Tracker #{download_id}] Task raised unhandled exception",
            exc_info=task.exception(),
        )


async def _run_download(db: AsyncSession, download_id: int, url: str, file_path: str):
    from app.services import downloader as dl_service
    from app.database import AsyncSessionLocal

    logger.info(f"[Tracker #{download_id}] Background task started → {file_path}")
    logger.info(f"[Tracker #{download_id}] URL: {url}")

    async def updater(did, **kwargs):
        logger.debug(f"[Tracker #{did}] DB update: {kwargs}")
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Download).where(Download.id == did))
            dl = result.scalar_one_or_none()
            if dl is None:
                logger.error(f"[Tracker #{did}] Download record not found in DB — cannot apply update {kwargs}")
                return
            for k, v in kwargs.items():
                setattr(dl, k, v)
            try:
                await session.commit()
            except Exception as e:
                logger.error(f"[Tracker #{did}] Failed to commit DB update {kwargs}: {e}", exc_info=True)

    try:
        await dl_service.download_file(download_id, url, file_path, db_updater=updater)
        logger.info(f"[Tracker #{download_id}] Download completed successfully")
    except Exception as e:
        logger.error(f"[Tracker #{download_id}] Download failed: {e}", exc_info=True)
        await updater(download_id, status=DownloadStatus.failed, error_message=str(e))
    finally:
        dl_service.unregister_task(download_id)
        logger.info(f"[Tracker #{download_id}] Background task finished")


def _safe_int(val) -> int | None:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _safe_filename(name: str) -> str:
    """Sanitize a string for use as a filesystem path component."""
    invalid = r'\/:*?"<>|'
    for ch in invalid:
        name = name.replace(ch, "_")
    return name.strip()
