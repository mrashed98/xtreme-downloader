import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.download import Download, DownloadStatus
from app.services import downloader as dl_service

logger = logging.getLogger(__name__)


def log_task_result(task: asyncio.Task, download_id: int, label: str) -> None:
    """Done callback: surface any exception that slipped past the try/except."""
    if task.cancelled():
        logger.warning(f"[{label} #{download_id}] Task was cancelled unexpectedly")
    elif task.exception() is not None:
        logger.error(
            f"[{label} #{download_id}] Task raised unhandled exception",
            exc_info=task.exception(),
        )


async def run_download(download_id: int, url: str, file_path: str, label: str = "DL") -> None:
    logger.info(f"[{label} #{download_id}] Background task started → {file_path}")
    logger.info(f"[{label} #{download_id}] URL: {url}")

    async def updater(did, **kwargs):
        logger.debug(f"[{label} #{did}] DB update: {kwargs}")
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Download).where(Download.id == did))
            dl = result.scalar_one_or_none()
            if dl is None:
                logger.error(
                    f"[{label} #{did}] Download record not found in DB — cannot apply update {kwargs}"
                )
                return
            for k, v in kwargs.items():
                setattr(dl, k, v)
            try:
                await session.commit()
            except Exception as e:
                logger.error(
                    f"[{label} #{did}] Failed to commit DB update {kwargs}: {e}",
                    exc_info=True,
                )

    try:
        await dl_service.download_file(
            download_id, url, file_path,
            db_updater=updater,
        )
        logger.info(f"[{label} #{download_id}] Download completed successfully")
    except Exception as e:
        logger.error(f"[{label} #{download_id}] Download failed: {e}", exc_info=True)
        await updater(download_id, status=DownloadStatus.failed, error_message=str(e))
    finally:
        dl_service.unregister_task(download_id)
        logger.info(f"[{label} #{download_id}] Background task finished")


def schedule_download(download_id: int, url: str, file_path: str, label: str = "DL") -> asyncio.Task:
    """Create the asyncio task, register it with the service, and attach the done callback."""
    task = asyncio.create_task(run_download(download_id, url, file_path, label))
    task.add_done_callback(lambda t: log_task_result(t, download_id, label))
    dl_service.register_task(download_id, task)
    return task
