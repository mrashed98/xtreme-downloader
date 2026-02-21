import os
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.playlist import Playlist, Category, CategoryType
from app.models.stream import VodStream
from app.models.download import Download, DownloadStatus, ContentType
from app.schemas.playlist import CategoryResponse
from app.schemas.stream import VodStreamResponse, StreamUrlResponse
from app.schemas.download import VodDownloadRequest, DownloadResponse
from app.services.xtream import XtreamClient
from app.services import downloader as dl_service
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vod", tags=["vod"])
settings = get_settings()


def _safe_filename(name: str) -> str:
    invalid = r'\/:*?"<>|'
    for ch in invalid:
        name = name.replace(ch, "_")
    return name.strip()


@router.get("/{playlist_id}/categories", response_model=list[CategoryResponse])
async def get_vod_categories(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(
            Category.playlist_id == playlist_id,
            Category.type == CategoryType.vod,
        ).order_by(Category.name)
    )
    return result.scalars().all()


@router.get("/{playlist_id}/streams", response_model=list[VodStreamResponse])
async def get_vod_streams(
    playlist_id: int,
    category_id: str | None = Query(None),
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
    if category_id:
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
    query = query.order_by(VodStream.name).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{playlist_id}/streams/{stream_id}", response_model=VodStreamResponse)
async def get_vod_stream(
    playlist_id: int,
    stream_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VodStream).where(
            VodStream.playlist_id == playlist_id,
            VodStream.stream_id == stream_id,
        )
    )
    stream = result.scalars().first()
    if not stream:
        raise HTTPException(404, "Stream not found")
    return stream


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
    # Use .m3u8 so the player always uses HLS.js (avoids browser mp4 playback issues)
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

    task = asyncio.create_task(_run_download(download.id, url, file_path))
    dl_service.register_task(download.id, task)
    return download


async def _run_download(download_id: int, url: str, file_path: str):
    from app.models.download import Download, DownloadStatus
    from sqlalchemy import select

    logger.info(f"[VOD #{download_id}] Background task started → {file_path}")
    logger.info(f"[VOD #{download_id}] URL: {url}")

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
        logger.info(f"[VOD #{download_id}] Download completed successfully")
    except Exception as e:
        logger.error(f"[VOD #{download_id}] Download failed: {e}", exc_info=True)
        await updater(download_id, status=DownloadStatus.failed, error_message=str(e))
    finally:
        dl_service.unregister_task(download_id)
        logger.info(f"[VOD #{download_id}] Background task finished")
