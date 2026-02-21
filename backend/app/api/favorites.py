from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.favorite import Favorite
from app.schemas.favorite import FavoriteCreate, FavoriteResponse

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteResponse])
async def list_favorites(
    playlist_id: int = Query(...),
    content_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Favorite).where(Favorite.playlist_id == playlist_id)
    if content_type:
        query = query.where(Favorite.content_type == content_type)
    result = await db.execute(query.order_by(Favorite.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=FavoriteResponse, status_code=201)
async def add_favorite(data: FavoriteCreate, db: AsyncSession = Depends(get_db)):
    stmt = (
        pg_insert(Favorite)
        .values(
            playlist_id=data.playlist_id,
            content_type=data.content_type,
            item_id=data.item_id,
        )
        .on_conflict_do_nothing(constraint="uq_favorites_playlist_type_item")
        .returning(Favorite)
    )
    result = await db.execute(stmt)
    row = result.scalars().first()
    if row is None:
        # Already exists — fetch it
        existing = await db.execute(
            select(Favorite).where(
                Favorite.playlist_id == data.playlist_id,
                Favorite.content_type == data.content_type,
                Favorite.item_id == data.item_id,
            )
        )
        row = existing.scalars().first()
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{favorite_id}", status_code=204)
async def remove_favorite(favorite_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Favorite).where(Favorite.id == favorite_id))
    fav = result.scalars().first()
    if not fav:
        raise HTTPException(404, "Favorite not found")
    await db.delete(fav)
    await db.commit()


@router.delete("", status_code=204)
async def remove_favorite_by_item(
    playlist_id: int = Query(...),
    content_type: str = Query(...),
    item_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Remove a favorite by its natural key (no need to look up the id first)."""
    result = await db.execute(
        select(Favorite).where(
            Favorite.playlist_id == playlist_id,
            Favorite.content_type == content_type,
            Favorite.item_id == item_id,
        )
    )
    fav = result.scalars().first()
    if fav:
        await db.delete(fav)
        await db.commit()
