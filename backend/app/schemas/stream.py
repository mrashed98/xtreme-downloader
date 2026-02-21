from pydantic import BaseModel


class LiveStreamResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    stream_id: str
    name: str
    icon: str | None
    category_id: str | None
    epg_channel_id: str | None
    stream_type: str | None


class StreamUrlResponse(BaseModel):
    url: str
    stream_type: str


class VodStreamResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    stream_id: str
    name: str
    icon: str | None
    category_id: str | None
    added: str | None
    container_extension: str | None
    imdb_id: str | None
    genre: str | None
    cast: str | None
    director: str | None
    rating: float | None
    plot: str | None
    duration: str | None
    language: str | None


class EpisodeResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    series_id: int
    season_num: int
    episode_id: str
    episode_num: int | None
    title: str | None
    container_extension: str | None
    added: str | None
    duration: str | None


class SeasonResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    series_id: int
    season_num: int
    name: str | None
    cover: str | None
    air_date: str | None
    episodes: list[EpisodeResponse] = []


class SeriesResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    playlist_id: int
    series_id: str
    name: str
    cover: str | None
    category_id: str | None
    cast: str | None
    director: str | None
    genre: str | None
    plot: str | None
    rating: float | None
    language: str | None
    youtube_trailer: str | None
    release_date: str | None


class SeriesDetailResponse(SeriesResponse):
    seasons: list[SeasonResponse] = []
