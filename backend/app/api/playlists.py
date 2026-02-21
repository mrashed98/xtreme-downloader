import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.playlist import Playlist, Category, CategoryType
from app.models.stream import LiveStream, VodStream, Series
from app.schemas.playlist import PlaylistCreate, PlaylistUpdate, PlaylistResponse
from app.services.xtream import XtreamClient
from app.services.scheduler import _sync_playlist

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.get("", response_model=list[PlaylistResponse])
async def list_playlists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Playlist).order_by(Playlist.id))
    return result.scalars().all()


@router.post("", response_model=PlaylistResponse, status_code=201)
async def create_playlist(data: PlaylistCreate, db: AsyncSession = Depends(get_db)):
    playlist = Playlist(**data.model_dump())
    db.add(playlist)
    await db.commit()
    await db.refresh(playlist)
    return playlist


@router.get("/{playlist_id}", response_model=PlaylistResponse)
async def get_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")
    return playlist


@router.put("/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(
    playlist_id: int, data: PlaylistUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(playlist, field, value)
    await db.commit()
    await db.refresh(playlist)
    return playlist


@router.delete("/{playlist_id}", status_code=204)
async def delete_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")
    await db.delete(playlist)
    await db.commit()


@router.post("/{playlist_id}/sync", response_model=PlaylistResponse)
async def sync_playlist(
    playlist_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")
    if playlist.sync_status == "syncing":
        logger.info(f"Playlist {playlist_id} sync requested but already syncing — skipping")
        return playlist  # already running — return current state, don't double-queue

    background_tasks.add_task(_sync_playlist_bg, playlist_id)
    return playlist


async def _sync_playlist_bg(playlist_id: int):
    from app.database import AsyncSessionLocal
    from sqlalchemy import select, update

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
        playlist = result.scalar_one_or_none()
        if not playlist:
            return
        try:
            await _sync_playlist(db, playlist)
        except Exception:
            # _sync_playlist sets sync_status="error" and re-raises on failure.
            # If its own error handler also failed, use a fresh session to ensure
            # the status is never left stuck at "syncing".
            try:
                async with AsyncSessionLocal() as db2:
                    await db2.execute(
                        update(Playlist)
                        .where(Playlist.id == playlist_id)
                        .values(sync_status="error")
                    )
                    await db2.commit()
            except Exception:
                pass
