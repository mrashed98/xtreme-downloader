from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class CategoryType(str, enum.Enum):
    live = "live"
    vod = "vod"
    series = "series"


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(20), default="idle")  # idle | syncing | error
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    categories: Mapped[list["Category"]] = relationship("Category", back_populates="playlist", cascade="all, delete-orphan")
    live_streams: Mapped[list["LiveStream"]] = relationship("LiveStream", back_populates="playlist", cascade="all, delete-orphan")
    vod_streams: Mapped[list["VodStream"]] = relationship("VodStream", back_populates="playlist", cascade="all, delete-orphan")
    series: Mapped[list["Series"]] = relationship("Series", back_populates="playlist", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[CategoryType] = mapped_column(SAEnum(CategoryType), nullable=False)
    category_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="categories")
