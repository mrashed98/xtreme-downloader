from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal
from app.api import playlists, live, vod, series, downloads, ws, favorites
from app.api import settings as settings_router
from app.api.ws import ws_manager
from app.models.setting import AppSetting
from app.services import downloader as dl_service
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Xtreme Downloader...")
    dl_service.init_downloader(settings.max_concurrent_downloads)
    dl_service.set_ws_manager(ws_manager)

    # Load persisted settings from DB and apply
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AppSetting))
            rows = {r.key: r.value for r in result.scalars().all()}
            if rows:
                dl_service.apply_settings(
                    max_concurrent=int(rows.get("max_concurrent_downloads", settings.max_concurrent_downloads)),
                    download_chunks=int(rows.get("download_chunks", settings.download_chunks)),
                    speed_limit_bps=int(rows.get("speed_limit_bps", 0)),
                )
    except Exception as e:
        logger.warning(f"Could not load settings from DB (first boot?): {e}")

    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(playlists.router)
app.include_router(live.router)
app.include_router(vod.router)
app.include_router(series.router)
app.include_router(downloads.router)
app.include_router(favorites.router)
app.include_router(settings_router.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
