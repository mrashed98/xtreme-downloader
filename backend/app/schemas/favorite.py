from datetime import datetime
from pydantic import BaseModel
from typing import Literal


class FavoriteCreate(BaseModel):
    playlist_id: int
    content_type: Literal["series", "vod"]
    item_id: str


class FavoriteResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    content_type: str
    item_id: str
    created_at: datetime
