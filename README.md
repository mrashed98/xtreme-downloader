# Xtreme Downloader

Full-stack IPTV Manager with IDM-like downloader, series tracking, and glassmorphism UI.

## Quick Start (Local Dev)

```bash
docker compose up --build
```

Access at `http://localhost:3000`.

### First Run
1. Open Dashboard → Add Playlist (enter Xtream Codes credentials)
2. Click **Sync** to populate the database
3. Browse Live TV, Movies, Series
4. Watch or download content

## Architecture

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Glassmorphism
- **Backend**: FastAPI (Python) + SQLAlchemy async + APScheduler
- **Database**: PostgreSQL 15
- **Download Engine**: Parallel 16-chunk IDM-style with resume
- **Real-time**: WebSocket progress updates

## Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit as needed
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
cd backend
alembic upgrade head
```

## Kubernetes Deployment

### Prerequisites
- K3s cluster with Traefik ingress
- NFS storage class `nfs-hdd`
- Sealed Secrets controller

### Seal the DB password
```bash
echo -n 'your-strong-password' | kubectl create secret generic xtreme-secrets \
  --dry-run=client \
  --from-literal=postgres-password=- \
  -o yaml | kubeseal -o yaml > helm/xtreme-downloader/templates/sealed-secret.yaml
```

### Deploy via ArgoCD
```bash
# In the homelab repo:
kubectl apply -f argocd/apps/xtreme-downloader.yaml
```

ArgoCD will sync the Helm chart automatically. Access at `http://xtreme.local`.

## File Path Convention

```
/media/
├── Series/{Language}/{Series Name}/Season {N}/{title}.{ext}
└── VOD/{Language}/{Movie Name}/{Movie Name}.{ext}
```

## API Reference

See [FastAPI docs](http://localhost:8000/docs) when running locally.

## Key Features

- **Live TV**: Browse categories, search channels, in-browser HLS streaming
- **Movies**: Filter by language/genre/cast/rating, watch or download
- **Series**: Browse, track seasons for auto-download, download individual episodes
- **Downloads**: Parallel chunk engine (16 chunks), pause/resume, WebSocket progress
- **Scheduler**: Auto-sync every 6h, episode tracker every 1h
