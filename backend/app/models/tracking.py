from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SeriesTracking(Base):
    __tablename__ = "series_tracking"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    series_id: Mapped[int] = mapped_column(Integer, ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    playlist_id: Mapped[int] = mapped_column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    language: Mapped[str] = mapped_column(String(128), nullable=False)
    track_all_seasons: Mapped[bool] = mapped_column(Boolean, default=False)
    seasons_json: Mapped[list | None] = mapped_column(JSON, nullable=True)  # list of season numbers
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    series: Mapped["Series"] = relationship("Series", back_populates="tracking")
