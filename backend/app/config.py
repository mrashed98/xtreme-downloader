from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — full URLs (used by docker-compose / local dev)
    database_url: str = "postgresql+asyncpg://xtreme:xtreme@localhost:5432/xtreme"
    sync_database_url: str = "postgresql+psycopg2://xtreme:xtreme@localhost:5432/xtreme"

    # Individual DB params (injected by K8s ConfigMap + Secret).
    # When present, get_async_url() / get_sync_url() return a URL *object*
    # (not a string) so SQLAlchemy never renders the password through its
    # limited RFC-1738 quoting which omits '#' and other special chars.
    postgres_host: str | None = None
    postgres_port: int = 5432
    postgres_db: str | None = None
    postgres_user: str | None = None
    postgres_password: str | None = None

    @model_validator(mode="after")
    def validate_db_config(self) -> "Settings":
        # Nothing to build at validation time — URL objects are returned
        # on demand by get_async_url() / get_sync_url() below.
        return self

    def get_async_url(self):
        """Return a SQLAlchemy URL object (or string for docker-compose)."""
        if self.postgres_host and self.postgres_password:
            from sqlalchemy.engine import URL
            return URL.create(
                drivername="postgresql+asyncpg",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        return self.database_url

    def get_sync_url(self):
        """Return a SQLAlchemy URL object (or string for docker-compose)."""
        if self.postgres_host and self.postgres_password:
            from sqlalchemy.engine import URL
            return URL.create(
                drivername="postgresql+psycopg2",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        return self.sync_database_url

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
    max_retries: int = 2

    # Scheduler intervals
    sync_interval_hours: int = 6
    tracker_interval_hours: int = 1


@lru_cache
def get_settings() -> Settings:
    return Settings()
