import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.playlist import Playlist, Category, CategoryType
from app.models.stream import VodStream
from app.models.download import Download, DownloadStatus, ContentType
from app.schemas.playlist import CategoryResponse
from app.schemas.stream import VodStreamResponse, VodStreamDetailResponse, StreamUrlResponse
from app.schemas.download import VodDownloadRequest, DownloadResponse
from app.services.xtream import XtreamClient
from app.services import downloader as dl_service
from app.services.download_runner import schedule_download
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vod", tags=["vod"])
settings = get_settings()


def _safe_filename(name: str) -> str:
    invalid = r'\\/:*?"<>|'
    for ch in invalid:
        name = name.replace(ch, "_")
    return name.strip()


def _build_vod_detail_payload(stream: VodStream, raw_info: dict | None) -> dict:
    base = VodStreamResponse.model_validate(stream).model_dump()
    raw_info = raw_info or {}
    info = raw_info.get("info") or {}
    movie_data = raw_info.get("movie_data") or {}
    video = info.get("video") or {}
    audio = info.get("audio") or {}
    audio_tags = audio.get("tags") or {}

    backdrop_path = info.get("backdrop_path")
    if isinstance(backdrop_path, str):
        backdrop_path = [backdrop_path]
    elif not isinstance(backdrop_path, list):
        backdrop_path = None

    rating_raw = info.get("rating")
    try:
        rating_val = float(rating_raw) if rating_raw not in (None, "") else base.get("rating")
    except (TypeError, ValueError):
        rating_val = base.get("rating")

    try:
        rating_5 = float(info.get("rating_5based")) if info.get("rating_5based") is not None else None
    except (TypeError, ValueError):
        rating_5 = None

    return {
        **base,
        "icon": info.get("movie_image") or base.get("icon"),
        "container_extension": movie_data.get("container_extension") or base.get("container_extension"),
        "genre": info.get("genre") or base.get("genre"),
        "cast": info.get("cast") or base.get("cast"),
        "director": info.get("director") or base.get("director"),
        "rating": rating_val,
        "plot": info.get("plot") or base.get("plot"),
        "duration": info.get("duration") or base.get("duration"),
        "tmdb_id": info.get("tmdb_id"),
        "movie_image": info.get("movie_image"),
        "backdrop": info.get("backdrop"),
        "backdrop_path": backdrop_path,
        "youtube_trailer": info.get("youtube_trailer"),
        "release_date": info.get("releasedate"),
        "duration_secs": info.get("duration_secs"),
        "bitrate": info.get("bitrate"),
        "rating_5based": rating_5,

        "video_codec": video.get("codec_name"),
        "video_codec_long": video.get("codec_long_name"),
        "video_profile": video.get("profile"),
        "video_width": video.get("width"),
        "video_height": video.get("height"),
        "video_pix_fmt": video.get("pix_fmt"),
        "video_aspect_ratio": video.get("display_aspect_ratio"),
        "video_frame_rate": video.get("r_frame_rate") or video.get("avg_frame_rate"),
        "video_level": video.get("level"),
        "video_field_order": video.get("field_order"),
        "video_bits_per_raw_sample": video.get("bits_per_raw_sample"),

        "audio_codec": audio.get("codec_name"),
        "audio_codec_long": audio.get("codec_long_name"),
        "audio_profile": audio.get("profile"),
        "audio_sample_rate": audio.get("sample_rate"),
        "audio_channels": audio.get("channel_layout"),
        "audio_channel_count": audio.get("channels"),
        "audio_language": audio_tags.get("language"),
        "audio_bitrate": audio_tags.get("BPS") or audio_tags.get("BPS-eng"),

        "video": video or None,
        "audio": audio or None,
        "info": info or None,
        "movie_data": movie_data or None,
    }


@router.get("/{playlist_id}/categories", response_model=list[CategoryResponse])
async def get_vod_categories(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(
            Category.playlist_id == playlist_id,
            Category.type == CategoryType.vod,
        ).order_by(Category.name.desc())
    )
    return result.scalars().all()


@router.get("/{playlist_id}/streams", response_model=list[VodStreamResponse])
async def get_vod_streams(
    playlist_id: int,
    category_id: str | None = Query(None),
    latest: bool = Query(False),
    language: str | None = Query(None),
    genre: str | None = Query(None),
    cast: str | None = Query(None),
    rating_min: float | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    query = select(VodStream).where(VodStream.playlist_id == playlist_id)
    if category_id and not latest:
        query = query.where(VodStream.category_id == category_id)
    if language:
        query = query.where(VodStream.language.ilike(f"%{language}%"))
    if genre:
        query = query.where(VodStream.genre.ilike(f"%{genre}%"))
    if cast:
        query = query.where(VodStream.cast.ilike(f"%{cast}%"))
    if rating_min is not None:
        query = query.where(VodStream.rating >= rating_min)
    if search:
        query = query.where(VodStream.name.ilike(f"%{search}%"))
    if latest:
        query = query.order_by(VodStream.added.desc().nullslast(), VodStream.id.desc()).limit(min(limit, 50))
    else:
        query = query.order_by(VodStream.name).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{playlist_id}/streams/{stream_id}", response_model=VodStreamDetailResponse)
async def get_vod_stream(
    playlist_id: int,
    stream_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    result = await db.execute(
        select(VodStream).where(
            VodStream.playlist_id == playlist_id,
            VodStream.stream_id == stream_id,
        )
    )
    stream = result.scalars().first()
    if not stream:
        raise HTTPException(404, "Stream not found")

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    try:
        raw_info = await client.get_vod_info(stream_id)
    finally:
        await client.close()

    return _build_vod_detail_payload(stream, raw_info)


@router.get("/{playlist_id}/streams/{stream_id}/watch", response_model=StreamUrlResponse)
async def watch_vod(
    playlist_id: int,
    stream_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    result = await db.execute(
        select(VodStream).where(
            VodStream.playlist_id == playlist_id,
            VodStream.stream_id == stream_id,
        )
    )
    stream = result.scalars().first()
    ext = stream.container_extension if stream else "mp4"

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    url = client.build_vod_url(stream_id, "m3u8")
    return StreamUrlResponse(url=url, stream_type="hls")


@router.post("/{playlist_id}/streams/{stream_id}/download", response_model=DownloadResponse, status_code=201)
async def download_vod(
    playlist_id: int,
    stream_id: str,
    body: VodDownloadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    result = await db.execute(
        select(VodStream).where(
            VodStream.playlist_id == playlist_id,
            VodStream.stream_id == stream_id,
        )
    )
    stream = result.scalars().first()
    if not stream:
        raise HTTPException(404, "Stream not found")

    ext = stream.container_extension or "mp4"
    safe_name = _safe_filename(stream.name)
    file_path = os.path.join(
        settings.media_path, "VOD", body.language, safe_name, f"{safe_name}.{ext}"
    )

    download = Download(
        playlist_id=playlist_id,
        content_type=ContentType.vod,
        stream_id=stream_id,
        title=stream.name,
        language=body.language,
        file_path=file_path,
        status=DownloadStatus.queued,
        chunks=1,
    )
    db.add(download)
    await db.commit()
    await db.refresh(download)

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    url = client.build_vod_url(stream_id, ext)

    logger.info(
        f"[VOD #{download.id}] Scheduling download task — "
        f"active_tasks={len(dl_service._active_downloads)}"
    )
    schedule_download(download.id, url, file_path, "VOD")
    logger.info(f"[VOD #{download.id}] Task created and registered")
    return download
