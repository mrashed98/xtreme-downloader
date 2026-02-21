from datetime import datetime
from pydantic import BaseModel, HttpUrl, field_validator


class PlaylistCreate(BaseModel):
    name: str
    base_url: str
    username: str
    password: str


class PlaylistUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    username: str | None = None
    password: str | None = None
    is_active: bool | None = None


class PlaylistResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    base_url: str
    username: str
    is_active: bool
    last_synced_at: datetime | None
    sync_status: str
    created_at: datetime


class CategoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    type: str
    category_id: str
    name: str
