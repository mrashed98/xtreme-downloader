from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DownloadResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    content_type: str
    stream_id: str
    title: str
    language: str | None
    file_path: str | None
    status: str
    progress_pct: float
    speed_bps: int
    total_bytes: int
    downloaded_bytes: int
    chunks: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    poster: str | None = None


class VodDownloadRequest(BaseModel):
    language: str = "English"


class SeriesDownloadRequest(BaseModel):
    language: str = "English"
    season_num: int | None = None
    episode_ids: list[str] | None = None


class SeriesTrackRequest(BaseModel):
    language: str = "English"
    seasons: list[int] | str = "all"  # list of season numbers or "all"


class SettingsRequest(BaseModel):
    max_concurrent_downloads: int = Field(ge=1, le=10)
    download_chunks: int = Field(ge=1, le=32)
    speed_limit_bps: int = Field(ge=0)  # bytes/sec; 0 = unlimited
    max_retries: int = Field(default=2, ge=0, le=5)


class SettingsResponse(BaseModel):
    max_concurrent_downloads: int
    download_chunks: int
    speed_limit_bps: int  # 0 = unlimited
    max_retries: int


class TrackingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    series_id: int
    playlist_id: int
    language: str
    track_all_seasons: bool
    seasons_json: list | None
    last_checked_at: datetime | None
    created_at: datetime


class TrackResponse(TrackingResponse):
    """Returned by POST /track — extends TrackingResponse with queued_count."""
    queued_count: int = 0


class PatchEpisodeRequest(BaseModel):
    monitored: bool


class BulkActionRequest(BaseModel):
    """Act on many downloads at once.

    Provide `ids` for an explicit selection, or `status` to target everything
    currently in that state -- `{"action": "retry", "status": "failed"}` is the
    "retry all failed" case and avoids the client having to enumerate ids it
    may not have fetched.
    """

    action: Literal["pause", "resume", "retry", "delete"]
    ids: list[int] | None = None
    status: str | None = None
    delete_file: bool = False


class BulkActionItemError(BaseModel):
    id: int
    error: str


class BulkActionResponse(BaseModel):
    action: str
    requested: int
    succeeded: int
    # Per-item failures are reported rather than aborting the batch: one
    # download in the wrong state should not stop the other forty.
    errors: list[BulkActionItemError] = []
