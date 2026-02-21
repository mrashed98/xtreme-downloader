"""Async Xtream Codes API client."""
from __future__ import annotations
import aiohttp
import asyncio
from typing import Any
from urllib.parse import urljoin


class XtreamClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self._session: aiohttp.ClientSession | None = None

    @property
    def session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                connector=aiohttp.TCPConnector(ssl=False),
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _api_url(self, **params) -> str:
        base = f"{self.base_url}/player_api.php?username={self.username}&password={self.password}"
        for k, v in params.items():
            base += f"&{k}={v}"
        return base

    async def _get(self, **params) -> Any:
        url = self._api_url(**params)
        async with self.session.get(url) as resp:
            resp.raise_for_status()
            return await resp.json(content_type=None)

    def _normalize_list(self, data: Any) -> list:
        """Handle Xtream's inconsistent numbered-key objects vs proper arrays."""
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Numbered keys like {"1": {...}, "2": {...}}
            try:
                keys = sorted(data.keys(), key=lambda k: int(k))
                return [data[k] for k in keys]
            except (ValueError, TypeError):
                return list(data.values())
        return []

    def _safe_float(self, val: Any) -> float | None:
        if val is None:
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    async def get_user_info(self) -> dict:
        return await self._get(action="get_user_info") or {}

    async def get_live_categories(self) -> list[dict]:
        data = await self._get(action="get_live_categories")
        return self._normalize_list(data)

    async def get_live_streams(self, category_id: str | None = None) -> list[dict]:
        params: dict[str, Any] = {"action": "get_live_streams"}
        if category_id:
            params["category_id"] = category_id
        data = await self._get(**params)
        return self._normalize_list(data)

    async def get_vod_categories(self) -> list[dict]:
        data = await self._get(action="get_vod_categories")
        return self._normalize_list(data)

    async def get_vod_streams(self, category_id: str | None = None) -> list[dict]:
        params: dict[str, Any] = {"action": "get_vod_streams"}
        if category_id:
            params["category_id"] = category_id
        data = await self._get(**params)
        return self._normalize_list(data)

    async def get_vod_info(self, vod_id: str) -> dict:
        return await self._get(action="get_vod_info", vod_id=vod_id) or {}

    async def get_series_categories(self) -> list[dict]:
        data = await self._get(action="get_series_categories")
        return self._normalize_list(data)

    async def get_series(self, category_id: str | None = None) -> list[dict]:
        params: dict[str, Any] = {"action": "get_series"}
        if category_id:
            params["category_id"] = category_id
        data = await self._get(**params)
        return self._normalize_list(data)

    async def get_series_info(self, series_id: str) -> dict:
        return await self._get(action="get_series_info", series_id=series_id) or {}

    def build_stream_url(self, stream_type: str, stream_id: str, ext: str = "m3u8") -> str:
        """Build direct stream URL.

        stream_type: 'live' | 'movie' | 'series'
        """
        return f"{self.base_url}/{stream_type}/{self.username}/{self.password}/{stream_id}.{ext}"

    def build_live_url(self, stream_id: str) -> str:
        return self.build_stream_url("live", stream_id, "m3u8")

    def build_vod_url(self, stream_id: str, ext: str = "mp4") -> str:
        return self.build_stream_url("movie", stream_id, ext)

    def build_series_url(self, episode_id: str, ext: str = "mkv") -> str:
        return self.build_stream_url("series", episode_id, ext)

    def parse_series_info(self, raw: dict) -> dict:
        """Normalize get_series_info response."""
        info = raw.get("info", {}) or {}
        episodes_raw = raw.get("episodes", {}) or {}
        seasons_raw = raw.get("seasons", {}) or []

        # Normalize episodes: keys are season numbers
        episodes: dict[str, list] = {}
        if isinstance(episodes_raw, dict):
            for season_key, ep_list in episodes_raw.items():
                episodes[str(season_key)] = self._normalize_list(ep_list)
        elif isinstance(episodes_raw, list):
            for ep in episodes_raw:
                s = str(ep.get("season", "1"))
                episodes.setdefault(s, []).append(ep)

        seasons = self._normalize_list(seasons_raw)

        return {
            "info": info,
            "seasons": seasons,
            "episodes": episodes,
        }
