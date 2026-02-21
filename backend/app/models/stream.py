from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Float, Text, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class LiveStream(Base):
    __tablename__ = "live_streams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    stream_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    epg_channel_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stream_type: Mapped[str | None] = mapped_column(String(32), nullable=True)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="live_streams")


class VodStream(Base):
    __tablename__ = "vod_streams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    stream_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    added: Mapped[str | None] = mapped_column(String(64), nullable=True)
    container_extension: Mapped[str | None] = mapped_column(String(16), nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cast: Mapped[str | None] = mapped_column(Text, nullable=True)
    director: Mapped[str | None] = mapped_column(String(512), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    plot: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str | None] = mapped_column(String(128), nullable=True)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="vod_streams")


class Series(Base):
    __tablename__ = "series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    series_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    cover: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cast: Mapped[str | None] = mapped_column(Text, nullable=True)
    director: Mapped[str | None] = mapped_column(String(512), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(512), nullable=True)
    plot: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    language: Mapped[str | None] = mapped_column(String(128), nullable=True)
    youtube_trailer: Mapped[str | None] = mapped_column(String(64), nullable=True)
    release_date: Mapped[str | None] = mapped_column(String(32), nullable=True)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="series")
    seasons: Mapped[list["Season"]] = relationship("Season", back_populates="series", cascade="all, delete-orphan")
    episodes: Mapped[list["Episode"]] = relationship("Episode", back_populates="series", cascade="all, delete-orphan")
    tracking: Mapped[list["SeriesTracking"]] = relationship("SeriesTracking", back_populates="series", cascade="all, delete-orphan")


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    series_id: Mapped[int] = mapped_column(Integer, ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    season_num: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cover: Mapped[str | None] = mapped_column(Text, nullable=True)
    air_date: Mapped[str | None] = mapped_column(String(64), nullable=True)

    series: Mapped["Series"] = relationship("Series", back_populates="seasons")


class Episode(Base):
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    series_id: Mapped[int] = mapped_column(Integer, ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    season_num: Mapped[int] = mapped_column(Integer, nullable=False)
    episode_id: Mapped[str] = mapped_column(String(64), nullable=False)
    episode_num: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    container_extension: Mapped[str | None] = mapped_column(String(16), nullable=True)
    added: Mapped[str | None] = mapped_column(String(64), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(32), nullable=True)

    series: Mapped["Series"] = relationship("Series", back_populates="episodes")
