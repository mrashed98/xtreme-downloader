import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.download import Download, DownloadStatus
from app.schemas.download import DownloadResponse
from app.services import downloader as dl_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/downloads", tags=["downloads"])


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
    return result.scalars().all()


@router.get("/{download_id}", response_model=DownloadResponse)
async def get_download(download_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")
    return dl


@router.post("/{download_id}/pause", response_model=DownloadResponse)
async def pause_download(download_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")
    if dl.status not in (DownloadStatus.downloading, DownloadStatus.queued):
        raise HTTPException(400, f"Cannot pause download in status '{dl.status}'")

    dl_service.pause_download(download_id)
    dl.status = DownloadStatus.paused
    await db.commit()
    await db.refresh(dl)
    return dl


@router.post("/{download_id}/resume", response_model=DownloadResponse)
async def resume_download(
    download_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")
    if dl.status != DownloadStatus.paused:
        raise HTTPException(400, f"Download is not paused (status: '{dl.status}')")

    dl_service.resume_download(download_id)
    dl.status = DownloadStatus.downloading
    await db.commit()
    await db.refresh(dl)
    return dl


@router.delete("/{download_id}", status_code=204)
async def delete_download(
    download_id: int,
    delete_file: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Download).where(Download.id == download_id))
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")

    # Cancel active download
    dl_service.cancel_download(download_id)

    if delete_file and dl.file_path and os.path.exists(dl.file_path):
        try:
            os.remove(dl.file_path)
        except OSError as e:
            logger.warning(f"Could not delete file {dl.file_path}: {e}")

    await db.delete(dl)
    await db.commit()
