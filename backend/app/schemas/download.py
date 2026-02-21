from datetime import datetime
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


class SettingsResponse(BaseModel):
    max_concurrent_downloads: int
    download_chunks: int
    speed_limit_bps: int  # 0 = unlimited


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
