"""APScheduler setup for background jobs."""
from __future__ import annotations
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


async def sync_all_playlists():
    """Refresh all active playlists from Xtream API."""
    from app.database import AsyncSessionLocal
    from app.models.playlist import Playlist
    from sqlalchemy import select

    logger.info("Starting scheduled playlist sync")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Playlist).where(Playlist.is_active == True))
        playlists = result.scalars().all()
        for playlist in playlists:
            try:
                await _sync_playlist(db, playlist)
                logger.info(f"Synced playlist '{playlist.name}'")
            except Exception as e:
                logger.error(f"Failed to sync playlist '{playlist.name}': {e}")


async def _sync_playlist(db, playlist):
    """Sync a single playlist using upsert — safe to call concurrently/repeatedly."""
    from app.services.xtream import XtreamClient
    from app.models.playlist import Playlist, Category, CategoryType
    from app.models.stream import LiveStream, VodStream, Series
    from sqlalchemy import select, update

    # Mark as syncing (best-effort; don't fail if this errors)
    try:
        await db.execute(
            update(Playlist)
            .where(Playlist.id == playlist.id)
            .values(sync_status="syncing")
        )
        await db.commit()
    except Exception:
        await db.rollback()

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    try:
        # ── Live categories ──────────────────────────────────────────────────
        live_cats = await client.get_live_categories()
        logger.info(f"[{playlist.name}] Upserting {len(live_cats)} live categories")
        for cat in live_cats:
            stmt = pg_insert(Category).values(
                playlist_id=playlist.id,
                type=CategoryType.live,
                category_id=str(cat.get("category_id", "")),
                name=cat.get("category_name", ""),
            ).on_conflict_do_update(
                constraint="uq_categories_playlist_type_cat",
                set_={"name": cat.get("category_name", "")},
            )
            await db.execute(stmt)

        # ── Live streams ─────────────────────────────────────────────────────
        live_streams = await client.get_live_streams()
        logger.info(f"[{playlist.name}] Upserting {len(live_streams)} live streams")
        for s in live_streams:
            stmt = pg_insert(LiveStream).values(
                playlist_id=playlist.id,
                stream_id=str(s.get("stream_id", "")),
                name=s.get("name", ""),
                icon=s.get("stream_icon"),
                category_id=str(s.get("category_id", "")) if s.get("category_id") else None,
                epg_channel_id=s.get("epg_channel_id"),
                stream_type=s.get("stream_type"),
            ).on_conflict_do_update(
                constraint="uq_live_streams_playlist_stream",
                set_={
                    "name": s.get("name", ""),
                    "icon": s.get("stream_icon"),
                    "category_id": str(s.get("category_id", "")) if s.get("category_id") else None,
                    "epg_channel_id": s.get("epg_channel_id"),
                },
            )
            await db.execute(stmt)

        # ── VOD categories ───────────────────────────────────────────────────
        vod_cats = await client.get_vod_categories()
        logger.info(f"[{playlist.name}] Upserting {len(vod_cats)} VOD categories")
        for cat in vod_cats:
            stmt = pg_insert(Category).values(
                playlist_id=playlist.id,
                type=CategoryType.vod,
                category_id=str(cat.get("category_id", "")),
                name=cat.get("category_name", ""),
            ).on_conflict_do_update(
                constraint="uq_categories_playlist_type_cat",
                set_={"name": cat.get("category_name", "")},
            )
            await db.execute(stmt)

        # ── VOD streams ──────────────────────────────────────────────────────
        vod_streams = await client.get_vod_streams()
        logger.info(f"[{playlist.name}] Upserting {len(vod_streams)} VOD streams")
        for s in vod_streams:
            rating = _safe_float(s.get("rating"))
            stmt = pg_insert(VodStream).values(
                playlist_id=playlist.id,
                stream_id=str(s.get("stream_id", "")),
                name=s.get("name", ""),
                icon=s.get("stream_icon"),
                category_id=str(s.get("category_id", "")) if s.get("category_id") else None,
                added=str(s.get("added", "")) if s.get("added") else None,
                container_extension=s.get("container_extension"),
                imdb_id=s.get("stream_id") if s.get("direct_source") else None,
                genre=s.get("genre"),
                cast=s.get("cast"),
                director=s.get("director"),
                rating=rating,
                plot=s.get("plot"),
                duration=s.get("duration"),
                language=s.get("language"),
            ).on_conflict_do_update(
                constraint="uq_vod_streams_playlist_stream",
                set_={
                    "name": s.get("name", ""),
                    "icon": s.get("stream_icon"),
                    "category_id": str(s.get("category_id", "")) if s.get("category_id") else None,
                    "genre": s.get("genre"),
                    "cast": s.get("cast"),
                    "director": s.get("director"),
                    "rating": rating,
                    "plot": s.get("plot"),
                    "duration": s.get("duration"),
                    "language": s.get("language"),
                    "container_extension": s.get("container_extension"),
                },
            )
            await db.execute(stmt)

        # ── Series categories ────────────────────────────────────────────────
        series_cats = await client.get_series_categories()
        for cat in series_cats:
            stmt = pg_insert(Category).values(
                playlist_id=playlist.id,
                type=CategoryType.series,
                category_id=str(cat.get("category_id", "")),
                name=cat.get("category_name", ""),
            ).on_conflict_do_update(
                constraint="uq_categories_playlist_type_cat",
                set_={"name": cat.get("category_name", "")},
            )
            await db.execute(stmt)

        # ── Series list (metadata only — episodes fetched on-demand) ─────────
        series_list = await client.get_series()
        for s in series_list:
            rating = _safe_float(s.get("rating") or s.get("rating_5based"))
            trailer = s.get("youtube_trailer") or None
            release_date = s.get("releaseDate") or s.get("release_date") or None
            stmt = pg_insert(Series).values(
                playlist_id=playlist.id,
                series_id=str(s.get("series_id", "")),
                name=s.get("name", ""),
                cover=s.get("cover"),
                category_id=str(s.get("category_id", "")) if s.get("category_id") else None,
                cast=s.get("cast"),
                director=s.get("director"),
                genre=s.get("genre"),
                plot=s.get("plot"),
                rating=rating,
                language=s.get("language"),
                youtube_trailer=trailer,
                release_date=release_date,
            ).on_conflict_do_update(
                constraint="uq_series_playlist_series",
                set_={
                    "name": s.get("name", ""),
                    "cover": s.get("cover"),
                    "category_id": str(s.get("category_id", "")) if s.get("category_id") else None,
                    "cast": s.get("cast"),
                    "director": s.get("director"),
                    "genre": s.get("genre"),
                    "plot": s.get("plot"),
                    "rating": rating,
                    "language": s.get("language"),
                    "youtube_trailer": trailer,
                    "release_date": release_date,
                },
            )
            await db.execute(stmt)

        await db.execute(
            update(Playlist)
            .where(Playlist.id == playlist.id)
            .values(last_synced_at=datetime.utcnow(), sync_status="idle")
        )
        await db.commit()

    except Exception:
        await db.rollback()
        try:
            await db.execute(
                update(Playlist)
                .where(Playlist.id == playlist.id)
                .values(sync_status="error")
            )
            await db.commit()
        except Exception:
            pass
        raise
    finally:
        await client.close()


async def fetch_and_cache_series_detail(db, playlist, series_obj) -> dict:
    """Fetch series episodes from the Xtream API and upsert into DB.
    Returns parsed info dict with seasons and episodes.
    """
    from app.services.xtream import XtreamClient
    from app.models.stream import Season, Episode
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    try:
        raw = await client.get_series_info(series_obj.series_id)
        parsed = client.parse_series_info(raw)
    finally:
        await client.close()

    # Upsert seasons
    for season_data in parsed.get("seasons", []):
        season_num = _safe_int(season_data.get("season_number") or season_data.get("season_num")) or 0
        if season_num == 0:
            continue
        stmt = pg_insert(Season).values(
            series_id=series_obj.id,
            season_num=season_num,
            name=season_data.get("name"),
            cover=season_data.get("cover"),
            air_date=str(season_data.get("air_date", "")) or None,
        ).on_conflict_do_update(
            constraint="uq_seasons_series_num",
            set_={
                "name": season_data.get("name"),
                "cover": season_data.get("cover"),
            },
        )
        await db.execute(stmt)

    # Upsert episodes
    for season_key, episode_list in parsed.get("episodes", {}).items():
        season_num = int(season_key)
        for ep in episode_list:
            ep_id = str(ep.get("id", ""))
            if not ep_id:
                continue

            # Ensure a season row exists for seasons not in the seasons list
            stmt = pg_insert(Season).values(
                series_id=series_obj.id,
                season_num=season_num,
                name=f"Season {season_num}",
            ).on_conflict_do_nothing(constraint="uq_seasons_series_num")
            await db.execute(stmt)

            info = ep.get("info", {}) or {}
            stmt = pg_insert(Episode).values(
                series_id=series_obj.id,
                season_num=season_num,
                episode_id=ep_id,
                episode_num=_safe_int(ep.get("episode_num")),
                title=ep.get("title"),
                container_extension=ep.get("container_extension"),
                added=str(ep.get("added", "")) or None,
                duration=str(info.get("duration", "")) or None,
            ).on_conflict_do_update(
                constraint="uq_episodes_series_epid",
                set_={
                    "episode_num": _safe_int(ep.get("episode_num")),
                    "title": ep.get("title"),
                    "container_extension": ep.get("container_extension"),
                },
            )
            await db.execute(stmt)

    await db.commit()
    return parsed


async def check_tracked_series():
    """Check all tracked series for new episodes."""
    from app.database import AsyncSessionLocal
    from app.services.tracker import check_tracked_series as _check

    logger.info("Checking tracked series for new episodes")
    async with AsyncSessionLocal() as db:
        await _check(db)


def start_scheduler():
    scheduler = get_scheduler()
    scheduler.add_job(
        sync_all_playlists,
        trigger=IntervalTrigger(hours=settings.sync_interval_hours),
        id="sync_playlists",
        replace_existing=True,
    )
    scheduler.add_job(
        check_tracked_series,
        trigger=IntervalTrigger(hours=settings.tracker_interval_hours),
        id="check_tracked_series",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)


def _safe_float(val) -> float | None:
    try:
        v = float(val or 0)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> int | None:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None
