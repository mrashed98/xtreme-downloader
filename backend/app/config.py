from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from sqlalchemy.engine import URL as SAURL
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — full URLs (used by docker-compose / local dev)
    database_url: str = "postgresql+asyncpg://xtreme:xtreme@localhost:5432/xtreme"
    sync_database_url: str = "postgresql+psycopg2://xtreme:xtreme@localhost:5432/xtreme"

    # Individual DB params (injected by K8s ConfigMap + Secret).
    # When all are present they override the URL fields above, using
    # SQLAlchemy's URL.create() which percent-encodes special characters
    # so passwords like "#21Cd01e1@#@" work without breaking the URL parser.
    postgres_host: str | None = None
    postgres_port: int = 5432
    postgres_db: str | None = None
    postgres_user: str | None = None
    postgres_password: str | None = None

    @model_validator(mode="after")
    def build_urls_from_parts(self) -> "Settings":
        if self.postgres_host and self.postgres_password:
            self.database_url = str(SAURL.create(
                drivername="postgresql+asyncpg",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            ))
            self.sync_database_url = str(SAURL.create(
                drivername="postgresql+psycopg2",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            ))
        return self

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Media
    media_path: str = "/media"

    # App
    app_name: str = "Xtreme Downloader"
    debug: bool = False

    # Download settings (startup defaults — overridden at runtime from DB)
    max_concurrent_downloads: int = 3
    download_chunks: int = 16

    # Scheduler intervals (seconds)
    sync_interval_hours: int = 6
    tracker_interval_hours: int = 1


@lru_cache
def get_settings() -> Settings:
    return Settings()
