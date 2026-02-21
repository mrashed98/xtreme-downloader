# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full stack (recommended for local dev)
```bash
docker compose up --build   # spins up postgres, backend (auto-migrates), frontend, redis
```
Access at `http://localhost:3000`. API docs at `http://localhost:8000/docs`.

### Backend only
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # assumes postgres running locally or via docker compose
```

### Frontend only
```bash
cd frontend
npm install
npm run dev    # proxies /api and /ws to :8000
npm run lint
npm run build  # tsc -b && vite build
```

### Database migrations
```bash
cd backend
alembic upgrade head          # apply all migrations
alembic revision -m "desc"    # create new migration (then edit versions/<N>_desc.py)
```
Migration revision IDs are sequential integers as strings (`"001"`, `"002"`, …). New migrations must set `down_revision` to the previous ID.

## Architecture

### Backend (`backend/app/`)
- **`main.py`** — FastAPI app with lifespan: loads DB settings, resets stale `syncing` playlists and stuck `queued`/`downloading` downloads on startup, starts APScheduler
- **`config.py`** — Pydantic settings with dual DB URL strategy: local dev uses `DATABASE_URL`/`SYNC_DATABASE_URL` strings; K8s injects individual `POSTGRES_*` env vars and `config.py` builds a `SQLAlchemy URL object` (not a string) to correctly handle special characters in passwords
- **`database.py`** — async engine (asyncpg) for the app, sync engine (psycopg2) used only by Alembic `env.py`
- **`api/`** — FastAPI routers: `playlists`, `live`, `vod`, `series`, `downloads`, `ws`, `settings`, `favorites`
- **`models/`** — SQLAlchemy ORM: `playlist`, `stream` (LiveStream/VodStream/Series/Season/Episode), `download`, `tracking`, `setting`
- **`services/downloader.py`** — IDM-style parallel chunk engine. Uses `Range` headers to split files into N chunks (default 16). Falls back to single-stream if server doesn't support ranges. Global semaphore limits concurrent downloads (default 3). Background tasks are ephemeral — startup recovery in `main.py` resets stuck downloads
- **`services/scheduler.py`** — APScheduler jobs: `sync_all_playlists` (6h) and `check_tracked_series` (1h). Sync runs three **independent** transactions (Live, VOD, Series) — failure in one section does not rollback the others
- **`services/tracker.py`** — Checks tracked series for new episodes, auto-queues downloads
- **`services/xtream.py`** — HTTP client for the Xtream Codes API (`get_live_categories`, `get_vod_streams`, `get_series_info`, etc.). All requests are logged with timing

### Frontend (`frontend/src/`)
- **`api/client.ts`** — Axios client (baseURL `/api`). All API calls and TypeScript types live here
- **`store/index.ts`** — Zustand store (persisted to localStorage: `activePlaylistId` only). Holds: active playlist, player queue state, active download badge count
- **`pages/`** — One component per route: `Dashboard`, `LiveTV`, `Movies`, `SeriesPage`, `Downloads`
- **`components/`** — `Layout/` (shell, sidebar, player overlay), `ContentGrid/` (CategorySidebar with search, ContentCard), `TrackingDialog/`
- React Query (`@tanstack/react-query` v5) for all server state. Query keys: `["vod-streams", playlistId, ...]`, `["series", playlistId, ...]`, `["downloads", tab]`, `["favorites", playlistId, type]`
- Downloads page polls every 2s when downloads are active, 10s otherwise. WebSocket at `/ws/downloads` patches in-place for progress updates; triggers `invalidateQueries` on terminal states (completed/failed) or when a download is missing from the current list

### Database schema key points
- `playlists.sync_status`: `"idle"` | `"syncing"` | `"error"` — set to `"idle"` on startup if stuck in `"syncing"`
- All stream IDs (`stream_id`, `series_id`, `episode_id`) are stored as `String` even though the Xtream API returns integers — always cast to `str()` when inserting
- `Series.cast` is a raw comma-separated string from the API (e.g. `"Actor A, Actor B"`). The `/actors` endpoint splits it with PostgreSQL `unnest(string_to_array(...))` for distinct actor lookup
- Upserts use `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_update(constraint="uq_...")` — all tables have named unique constraints

### WebSocket
- Single endpoint `/ws/downloads` managed by `WSManager` in `api/ws.py`
- Backend broadcasts `{"download_id": N, "progress": float, "speed_bps": int, "status": str?, ...}` every ~1s during downloads
- Heartbeat every 30s; client pings every 25s

## Kubernetes Deployment

The app deploys to K3s via a Helm chart (`helm/xtreme-downloader/`) managed by ArgoCD.

**Shared infrastructure** (deployed separately in `homelab` repo, `databases` namespace):
- PostgreSQL: `postgres.databases.svc.cluster.local:5432` (Bitnami chart, `fullnameOverride: postgres`)
- Redis: `redis-master.databases.svc.cluster.local:6379` (Bitnami standalone, auth disabled)
- PostgreSQL uses `storageClass: local-path` — **never NFS** (NFS breaks PostgreSQL file locking)

**App-specific pattern**:
- No PostgreSQL StatefulSet in the app chart — uses the shared instance
- A Helm pre-install/pre-upgrade Job (`db-provision-job.yaml`) creates the app DB and user idempotently
- `xtreme-secrets` SealedSecret holds two keys: `postgres-password` (app user) and `postgres-admin-password` (superuser, for provisioning)
- `DATABASE_URL` is built in the Deployment `env` section via `$(POSTGRES_PASSWORD)` variable substitution — **not** in a ConfigMap (K8s doesn't interpolate env vars in ConfigMaps)

**Media storage**: NFS mount `192.168.68.100:/mnt/pve/BigData/k3s-shares/media` on storageClass `nfs-hdd`. File paths:
```
/media/Series/{Language}/{Series Name}/Season {N}/{title}.{ext}
/media/VOD/{Language}/{Movie Name}/{Movie Name}.{ext}
```

**Access**: `http://xtreme.local` (Traefik ingress). Routes `/api` and `/ws` to backend:8000, `/` to frontend:80.

## Key Constraints

- **Blocking I/O on NFS**: Use `asyncio.to_thread()` for any `os.makedirs`, `Path.mkdir`, or file operations inside async functions — NFS calls can block the event loop
- **Download lifecycle**: Downloads added via `BackgroundTasks` do not survive pod restarts. On startup, `main.py` resets any `queued`/`downloading` records to `failed`
- **Sync isolation**: Each of the three sync sections (Live, VOD, Series) commits independently. Never wrap all three in a single transaction
- **Special chars in DB passwords**: Always use `config.get_async_url()` / `config.get_sync_url()` — these return a `SQLAlchemy URL` object in K8s mode, which correctly handles `#`, `@`, etc. in passwords
