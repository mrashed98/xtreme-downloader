from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.setting import AppSetting
from app.schemas.download import SettingsRequest, SettingsResponse
from app.services import downloader as dl_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

_DEFAULTS = {
    "max_concurrent_downloads": "3",
    "download_chunks": "16",
    "speed_limit_bps": "0",
}


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting))
    rows = {r.key: r.value for r in result.scalars().all()}
    return SettingsResponse(
        max_concurrent_downloads=int(rows.get("max_concurrent_downloads", _DEFAULTS["max_concurrent_downloads"])),
        download_chunks=int(rows.get("download_chunks", _DEFAULTS["download_chunks"])),
        speed_limit_bps=int(rows.get("speed_limit_bps", _DEFAULTS["speed_limit_bps"])),
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsRequest, db: AsyncSession = Depends(get_db)):
    updates = {
        "max_concurrent_downloads": str(body.max_concurrent_downloads),
        "download_chunks": str(body.download_chunks),
        "speed_limit_bps": str(body.speed_limit_bps),
    }
    for key, value in updates.items():
        result = await db.execute(select(AppSetting).where(AppSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(AppSetting(key=key, value=value))
    await db.commit()

    dl_service.apply_settings(
        max_concurrent=body.max_concurrent_downloads,
        download_chunks=body.download_chunks,
        speed_limit_bps=body.speed_limit_bps,
    )
    return SettingsResponse(
        max_concurrent_downloads=body.max_concurrent_downloads,
        download_chunks=body.download_chunks,
        speed_limit_bps=body.speed_limit_bps,
    )
