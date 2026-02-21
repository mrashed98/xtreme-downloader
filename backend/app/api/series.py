import os
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, and_, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.playlist import Playlist, Category, CategoryType
from app.models.stream import Series, Season, Episode
from app.models.download import Download, DownloadStatus, ContentType
from app.models.tracking import SeriesTracking
from app.schemas.playlist import CategoryResponse
from app.schemas.stream import SeriesResponse, SeriesDetailResponse, SeasonResponse, EpisodeResponse, StreamUrlResponse
from app.schemas.download import SeriesDownloadRequest, SeriesTrackRequest, TrackingResponse, TrackResponse, DownloadResponse, PatchEpisodeRequest
from app.services.xtream import XtreamClient
from app.services import downloader as dl_service
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/series", tags=["series"])
settings = get_settings()


def _safe_filename(name: str) -> str:
    invalid = r'\/:*?"<>|'
    for ch in invalid:
        name = name.replace(ch, "_")
    return name.strip()


async def _queue_episode_downloads(
    db: AsyncSession,
    playlist,
    series,
    episodes: list,
    language: str,
) -> int:
    """Queue downloads for the given episodes, skipping active/completed or unmonitored ones."""
    active_statuses = [DownloadStatus.queued, DownloadStatus.downloading, DownloadStatus.paused, DownloadStatus.completed]
    result = await db.execute(
        select(Download.stream_id).where(
            Download.playlist_id == playlist.id,
            Download.content_type == ContentType.series,
            Download.status.in_(active_statuses),
        )
    )
    already_active = {row[0] for row in result.all()}

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    queued = []

    for ep in episodes:
        if not ep.monitored or ep.episode_id in already_active:
            continue

        ext = ep.container_extension or "mkv"
        ep_num = ep.episode_num or 0
        title = ep.title or f"Episode {ep_num}"
        file_path = os.path.join(
            settings.media_path, "Series", language,
            _safe_filename(series.name),
            f"Season {ep.season_num}",
            f"{_safe_filename(title)}.{ext}",
        )
        download = Download(
            playlist_id=playlist.id,
            content_type=ContentType.series,
            stream_id=ep.episode_id,
            title=f"{series.name} S{ep.season_num:02d}E{ep_num:02d} - {title}",
            language=language,
            file_path=file_path,
            status=DownloadStatus.queued,
            chunks=1,
        )
        db.add(download)
        queued.append((download, ep.episode_id, ext))

    if queued:
        await db.commit()
        for download, ep_id, ext in queued:
            await db.refresh(download)
            url = client.build_series_url(ep_id, ext)
            task = asyncio.create_task(_run_download(download.id, url, download.file_path))
            dl_service.register_task(download.id, task)

    return len(queued)


@router.get("/{playlist_id}/categories", response_model=list[CategoryResponse])
async def get_series_categories(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(
            Category.playlist_id == playlist_id,
            Category.type == CategoryType.series,
        ).order_by(Category.name)
    )
    return result.scalars().all()


@router.get("/{playlist_id}", response_model=list[SeriesResponse])
async def get_series(
    playlist_id: int,
    category_id: str | None = Query(None),
    language: str | None = Query(None),
    genre: str | None = Query(None),
    cast: str | None = Query(None),
    rating_min: float | None = Query(None),
    search: str | None = Query(None),
    ids: str | None = Query(None),
    limit: int = Query(50, le=1000),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(Series).where(Series.playlist_id == playlist_id)
    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        if id_list:
            query = query.where(Series.series_id.in_(id_list))
    if category_id:
        query = query.where(Series.category_id == category_id)
    if language:
        query = query.where(Series.language.ilike(f"%{language}%"))
    if genre:
        query = query.where(Series.genre.ilike(f"%{genre}%"))
    if cast:
        for actor in cast.split(","):
            actor = actor.strip()
            if actor:
                query = query.where(Series.cast.ilike(f"%{actor}%"))
    if rating_min is not None:
        query = query.where(Series.rating >= rating_min)
    if search:
        query = query.where(Series.name.ilike(f"%{search}%"))
    query = query.order_by(Series.name).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{playlist_id}/genres", response_model=list[str])
async def get_series_genres(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Series.genre).distinct()
        .where(Series.playlist_id == playlist_id, Series.genre.isnot(None))
        .order_by(Series.genre)
    )
    return [row[0] for row in result.all() if row[0]]


@router.get("/{playlist_id}/actors", response_model=list[str])
async def get_series_actors(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT DISTINCT TRIM(actor) AS actor
            FROM series,
                 unnest(string_to_array("cast", ',')) AS actor
            WHERE playlist_id = :pid
              AND "cast" IS NOT NULL
              AND "cast" != ''
            ORDER BY 1
        """),
        {"pid": playlist_id},
    )
    return [row[0] for row in result.all() if row[0]]


@router.get("/{playlist_id}/{series_id}", response_model=SeriesDetailResponse)
async def get_series_detail(
    playlist_id: int,
    series_id: str,
    db: AsyncSession = Depends(get_db),
):
    from app.services.scheduler import fetch_and_cache_series_detail

    result = await db.execute(
        select(Series).where(
            Series.playlist_id == playlist_id,
            Series.series_id == series_id,
        )
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    # Always fetch fresh episode data from the Xtream API and cache it.
    # The series list sync only gives metadata — episodes require a separate call.
    try:
        await fetch_and_cache_series_detail(db, playlist, series)
    except Exception as e:
        logger.warning(f"Could not fetch series detail from API: {e}. Falling back to DB.")

    # Load from DB (now freshly populated)
    seasons_result = await db.execute(
        select(Season).where(Season.series_id == series.id).order_by(Season.season_num)
    )
    seasons = seasons_result.scalars().all()

    episodes_result = await db.execute(
        select(Episode)
        .where(Episode.series_id == series.id)
        .order_by(Episode.season_num, Episode.episode_num)
    )
    all_episodes = episodes_result.scalars().all()

    episodes_by_season: dict[int, list] = {}
    for ep in all_episodes:
        episodes_by_season.setdefault(ep.season_num, []).append(ep)

    season_responses = []
    for s in seasons:
        eps = episodes_by_season.get(s.season_num, [])
        season_responses.append(SeasonResponse(
            id=s.id,
            series_id=s.series_id,
            season_num=s.season_num,
            name=s.name,
            cover=s.cover,
            air_date=s.air_date,
            episodes=[EpisodeResponse.model_validate(ep) for ep in eps],
        ))

    return SeriesDetailResponse(
        id=series.id,
        playlist_id=series.playlist_id,
        series_id=series.series_id,
        name=series.name,
        cover=series.cover,
        category_id=series.category_id,
        cast=series.cast,
        director=series.director,
        genre=series.genre,
        plot=series.plot,
        rating=series.rating,
        language=series.language,
        youtube_trailer=series.youtube_trailer,
        release_date=series.release_date,
        seasons=season_responses,
    )


@router.get("/{playlist_id}/{series_id}/episodes/{episode_id}/watch", response_model=StreamUrlResponse)
async def watch_episode(
    playlist_id: int,
    series_id: str,
    episode_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    url = client.build_series_url(episode_id, "m3u8")
    return StreamUrlResponse(url=url, stream_type="hls")


@router.get("/{playlist_id}/{series_id}/tracking", response_model=TrackingResponse | None)
async def get_tracking(
    playlist_id: int,
    series_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Series).where(Series.playlist_id == playlist_id, Series.series_id == series_id)
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    result = await db.execute(
        select(SeriesTracking).where(
            SeriesTracking.series_id == series.id,
            SeriesTracking.playlist_id == playlist_id,
        )
    )
    return result.scalars().first()


@router.post("/{playlist_id}/{series_id}/track", response_model=TrackResponse, status_code=201)
async def track_series(
    playlist_id: int,
    series_id: str,
    body: SeriesTrackRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Series).where(Series.playlist_id == playlist_id, Series.series_id == series_id)
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    # Upsert tracking
    result = await db.execute(
        select(SeriesTracking).where(
            SeriesTracking.series_id == series.id,
            SeriesTracking.playlist_id == playlist_id,
        )
    )
    tracking = result.scalars().first()

    track_all = body.seasons == "all" or body.seasons == ["all"]
    seasons_list = None if track_all else (body.seasons if isinstance(body.seasons, list) else None)

    if tracking:
        tracking.language = body.language
        tracking.track_all_seasons = track_all
        tracking.seasons_json = seasons_list
    else:
        tracking = SeriesTracking(
            series_id=series.id,
            playlist_id=playlist_id,
            language=body.language,
            track_all_seasons=track_all,
            seasons_json=seasons_list,
        )
        db.add(tracking)

    await db.commit()
    await db.refresh(tracking)

    # Determine which seasons to queue
    tracked_seasons: set[int] | None = None
    if not track_all and seasons_list:
        tracked_seasons = set(seasons_list)

    # Load existing monitored episodes in those seasons
    ep_query = select(Episode).where(Episode.series_id == series.id, Episode.monitored == True)
    if tracked_seasons is not None:
        ep_query = ep_query.where(Episode.season_num.in_(tracked_seasons))
    ep_result = await db.execute(ep_query)
    episodes = ep_result.scalars().all()

    pl_result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = pl_result.scalar_one_or_none()

    queued_count = 0
    if playlist and episodes:
        queued_count = await _queue_episode_downloads(db, playlist, series, episodes, body.language)

    return TrackResponse(
        id=tracking.id,
        series_id=tracking.series_id,
        playlist_id=tracking.playlist_id,
        language=tracking.language,
        track_all_seasons=tracking.track_all_seasons,
        seasons_json=tracking.seasons_json,
        last_checked_at=tracking.last_checked_at,
        created_at=tracking.created_at,
        queued_count=queued_count,
    )


@router.delete("/{playlist_id}/{series_id}/track", status_code=204)
async def untrack_series(
    playlist_id: int,
    series_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Series).where(Series.playlist_id == playlist_id, Series.series_id == series_id)
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    await db.execute(
        delete(SeriesTracking).where(
            SeriesTracking.series_id == series.id,
            SeriesTracking.playlist_id == playlist_id,
        )
    )
    await db.commit()


@router.patch("/{playlist_id}/{series_id}/episodes/{episode_id}", response_model=EpisodeResponse)
async def patch_episode(
    playlist_id: int,
    series_id: str,
    episode_id: str,
    body: PatchEpisodeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Series).where(Series.playlist_id == playlist_id, Series.series_id == series_id)
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    result = await db.execute(
        select(Episode).where(Episode.series_id == series.id, Episode.episode_id == episode_id)
    )
    episode = result.scalars().first()
    if not episode:
        raise HTTPException(404, "Episode not found")

    episode.monitored = body.monitored
    await db.commit()
    await db.refresh(episode)

    if body.monitored:
        result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
        playlist = result.scalar_one_or_none()
        if playlist:
            t_result = await db.execute(
                select(SeriesTracking).where(
                    SeriesTracking.series_id == series.id,
                    SeriesTracking.playlist_id == playlist_id,
                )
            )
            tracking = t_result.scalars().first()
            language = tracking.language if tracking else "English"
            await _queue_episode_downloads(db, playlist, series, [episode], language)
    else:
        result = await db.execute(
            select(Download).where(
                Download.playlist_id == playlist_id,
                Download.content_type == ContentType.series,
                Download.stream_id == episode_id,
                Download.status == DownloadStatus.queued,
            )
        )
        for dl in result.scalars().all():
            dl.status = DownloadStatus.cancelled
        await db.commit()

    return episode


@router.post("/{playlist_id}/{series_id}/download", response_model=list[DownloadResponse], status_code=201)
async def download_series(
    playlist_id: int,
    series_id: str,
    body: SeriesDownloadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    result = await db.execute(
        select(Series).where(Series.playlist_id == playlist_id, Series.series_id == series_id)
    )
    series = result.scalars().first()
    if not series:
        raise HTTPException(404, "Series not found")

    # Get episodes to download
    query = select(Episode).where(Episode.series_id == series.id)
    if body.season_num is not None:
        query = query.where(Episode.season_num == body.season_num)
    if body.episode_ids:
        query = query.where(Episode.episode_id.in_(body.episode_ids))
    query = query.order_by(Episode.season_num, Episode.episode_num)

    result = await db.execute(query)
    episodes = result.scalars().all()

    if not episodes:
        raise HTTPException(404, "No episodes found")

    downloads = []
    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)

    for ep in episodes:
        ext = ep.container_extension or "mkv"
        ep_num = ep.episode_num or 0
        title = ep.title or f"Episode {ep_num}"
        safe_series = _safe_filename(series.name)
        safe_title = _safe_filename(title)

        file_path = os.path.join(
            settings.media_path,
            "Series",
            body.language,
            safe_series,
            f"Season {ep.season_num}",
            f"{safe_title}.{ext}",
        )

        download = Download(
            playlist_id=playlist_id,
            content_type=ContentType.series,
            stream_id=ep.episode_id,
            title=f"{series.name} S{ep.season_num:02d}E{ep_num:02d} - {title}",
            language=body.language,
            file_path=file_path,
            status=DownloadStatus.queued,
            chunks=1,
        )
        db.add(download)
        downloads.append((download, ep.episode_id, ext))

    await db.commit()

    for download, ep_id, ext in downloads:
        await db.refresh(download)
        url = client.build_series_url(ep_id, ext)
        task = asyncio.create_task(_run_download(download.id, url, download.file_path))
        dl_service.register_task(download.id, task)

    return [d for d, _, _ in downloads]


async def _run_download(download_id: int, url: str, file_path: str):
    from app.models.download import Download, DownloadStatus
    from sqlalchemy import select

    logger.info(f"[Series #{download_id}] Background task started → {file_path}")
    logger.info(f"[Series #{download_id}] URL: {url}")

    async def updater(did, **kwargs):
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Download).where(Download.id == did))
            dl = result.scalar_one_or_none()
            if dl:
                for k, v in kwargs.items():
                    setattr(dl, k, v)
                await session.commit()

    try:
        await dl_service.download_file(
            download_id, url, file_path,
            db_updater=updater,
        )
        logger.info(f"[Series #{download_id}] Download completed successfully")
    except Exception as e:
        logger.error(f"[Series #{download_id}] Download failed: {e}", exc_info=True)
        await updater(download_id, status=DownloadStatus.failed, error_message=str(e))
    finally:
        dl_service.unregister_task(download_id)
        logger.info(f"[Series #{download_id}] Background task finished")
