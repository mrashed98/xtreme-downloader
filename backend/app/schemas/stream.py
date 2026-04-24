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


class VodStreamDetailResponse(VodStreamResponse):
    tmdb_id: str | None = None
    movie_image: str | None = None
    backdrop: str | None = None
    backdrop_path: list[str] | None = None
    youtube_trailer: str | None = None
    release_date: str | None = None
    duration_secs: int | None = None
    bitrate: int | None = None
    rating_5based: float | None = None

    video_codec: str | None = None
    video_codec_long: str | None = None
    video_profile: str | None = None
    video_width: int | None = None
    video_height: int | None = None
    video_pix_fmt: str | None = None
    video_aspect_ratio: str | None = None
    video_frame_rate: str | None = None
    video_level: int | None = None
    video_field_order: str | None = None
    video_bits_per_raw_sample: str | None = None

    audio_codec: str | None = None
    audio_codec_long: str | None = None
    audio_profile: str | None = None
    audio_sample_rate: str | None = None
    audio_channels: str | None = None
    audio_channel_count: int | None = None
    audio_language: str | None = None
    audio_bitrate: str | None = None

    video: dict | None = None
    audio: dict | None = None
    info: dict | None = None
    movie_data: dict | None = None


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
    monitored: bool


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
