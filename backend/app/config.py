from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://xtreme:xtreme@localhost:5432/xtreme"
    sync_database_url: str = "postgresql+psycopg2://xtreme:xtreme@localhost:5432/xtreme"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Media
    media_path: str = "/media"

    # App
    app_name: str = "Xtreme Downloader"
    debug: bool = False

    # Download settings
    max_concurrent_downloads: int = 3
    download_chunks: int = 16

    # Scheduler intervals (seconds)
    sync_interval_hours: int = 6
    tracker_interval_hours: int = 1


@lru_cache
def get_settings() -> Settings:
    return Settings()
