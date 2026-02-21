from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.playlist import Playlist, Category, CategoryType
from app.models.stream import LiveStream
from app.schemas.playlist import CategoryResponse
from app.schemas.stream import LiveStreamResponse, StreamUrlResponse
from app.services.xtream import XtreamClient

router = APIRouter(prefix="/api/live", tags=["live"])


@router.get("/{playlist_id}/categories", response_model=list[CategoryResponse])
async def get_live_categories(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(
            Category.playlist_id == playlist_id,
            Category.type == CategoryType.live,
        ).order_by(Category.name)
    )
    return result.scalars().all()


@router.get("/{playlist_id}/streams", response_model=list[LiveStreamResponse])
async def get_live_streams(
    playlist_id: int,
    category_id: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(LiveStream).where(LiveStream.playlist_id == playlist_id)
    if category_id:
        query = query.where(LiveStream.category_id == category_id)
    if search:
        query = query.where(LiveStream.name.ilike(f"%{search}%"))
    query = query.order_by(LiveStream.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{playlist_id}/streams/{stream_id}/url", response_model=StreamUrlResponse)
async def get_stream_url(
    playlist_id: int,
    stream_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(404, "Playlist not found")

    client = XtreamClient(playlist.base_url, playlist.username, playlist.password)
    url = client.build_live_url(stream_id)
    return StreamUrlResponse(url=url, stream_type="hls")
