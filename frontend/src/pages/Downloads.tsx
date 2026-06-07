import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download as DownloadIcon,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadsApi,
  settingsApi,
  formatBytes,
  formatSpeed,
  type Download as DownloadType,
  type DownloadSettings,
} from "../api/client";
import { useAppStore } from "../store";
import { EmptyState, ProgressBar, TONE_BG, Tabs, toneFg, toneFor } from "../components/ds";

const GRAPH_LEN = 40;

const STATUS_LABEL: Record<string, string> = {
  downloading: "Downloading",
  queued: "Queued",
  paused: "Paused",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"xst xst--" + status}>
      <span className="d" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Eq() {
  return (
    <span className="xeq" aria-hidden="true">
      {[8, 13, 6, 11].map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </span>
  );
}

function fmtEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function DownloadRow({
  dl,
  onPause,
  onResume,
  onRetry,
  onDelete,
}: {
  dl: DownloadType;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onRetry: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const pct = dl.progress_pct;
  const active = dl.status === "downloading";
  const canRetry = dl.status === "failed" || dl.status === "cancelled";
  const tone = toneFor(dl.title);
  const eta = active && dl.speed_bps > 0 ? (dl.total_bytes - dl.downloaded_bytes) / dl.speed_bps : null;

  return (
    <div className="xdlrow">
      <div className={"xdlrow__poster" + (dl.poster ? " xdlrow__poster--img" : "")} style={{ background: TONE_BG[tone] }}>
        {dl.poster ? (
          <img
            src={dl.poster}
            alt=""
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
            }}
          />
        ) : (
          <span style={{ color: toneFg(tone) }}>{dl.title.split(/[\s—·-]+/)[0]}</span>
        )}
      </div>
      <div className="xdlrow__mid">
        <div className="xdlrow__toprow">
          <span className="xdlrow__title">{dl.title}</span>
          <StatusBadge status={dl.status} />
          {active ? <Eq /> : null}
        </div>

        {dl.status === "completed" ? (
          <div className="xdlrow__metarow">
            <span style={{ color: "var(--text-secondary)" }}>
              {dl.content_type}
              {dl.language ? ` · ${dl.language}` : ""}
            </span>
            {dl.total_bytes > 0 && <span>{formatBytes(dl.total_bytes)}</span>}
            {dl.file_path && (
              <span className="path">
                <Check size={13} /> {dl.file_path}
              </span>
            )}
          </div>
        ) : dl.status === "failed" || dl.status === "cancelled" ? (
          <div className="xdlrow__metarow">
            <span style={{ color: "var(--text-secondary)" }}>
              {dl.content_type}
              {dl.language ? ` · ${dl.language}` : ""}
            </span>
            {dl.error_message && (
              <span className="err">
                <AlertTriangle size={13} />
                {dl.error_message}
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="xdlrow__progwrap">
              <ProgressBar value={Math.min(pct, 100)} variant={dl.status === "paused" ? "hot" : "volt"} height={6} />
            </div>
            <div className="xdlrow__metarow">
              <span className="pct">{pct.toFixed(0)}%</span>
              <span>
                {formatBytes(dl.downloaded_bytes)} / {dl.total_bytes > 0 ? formatBytes(dl.total_bytes) : "?"}
              </span>
              {active && dl.speed_bps > 0 && (
                <span className="sp">
                  <Gauge size={13} /> {formatSpeed(dl.speed_bps)}
                </span>
              )}
              {eta != null && <span>ETA {fmtEta(eta)}</span>}
              <span style={{ color: "var(--text-tertiary)" }}>
                {dl.content_type}
                {dl.language ? ` · ${dl.language}` : ""}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="xdlrow__actions">
        {dl.status === "downloading" && (
          <button className="xrowbtn" onClick={() => onPause(dl.id)} aria-label="Pause download">
            <Pause />
          </button>
        )}
        {dl.status === "paused" && (
          <button className="xrowbtn" onClick={() => onResume(dl.id)} aria-label="Resume download">
            <Play fill="currentColor" stroke="none" />
          </button>
        )}
        {canRetry && (
          <button className="xrowbtn xrowbtn--accent" onClick={() => onRetry(dl.id)} aria-label="Retry download">
            <RotateCcw />
          </button>
        )}
        <button className="xrowbtn xrowbtn--danger" onClick={() => onDelete(dl.id)} aria-label="Delete download">
          <Trash2 />
        </button>
      </div>
    </div>
  );
}

function SpeedGraph({ hist }: { hist: number[] }) {
  const max = Math.max(1, ...hist);
  return (
    <div className="xgraph">
      {hist.map((v, i) => (
        <div
          key={i}
          className={"xgraph__bar" + (i === hist.length - 1 ? " hot" : "")}
          style={{ height: Math.max(3, (v / max) * 100) + "%" }}
        />
      ))}
      <div className="xgraph__axis">
        <span>-{GRAPH_LEN}s</span>
        <span>live throughput</span>
        <span>now</span>
      </div>
    </div>
  );
}

const SPEED_PRESETS: [number, string][] = [
  [0, "Max"],
  [1024 * 1024, "1MB/s"],
  [2 * 1024 * 1024, "2MB/s"],
  [5 * 1024 * 1024, "5MB/s"],
  [10 * 1024 * 1024, "10MB/s"],
];

export function speedLabel(bps: number): string {
  const preset = SPEED_PRESETS.find(([v]) => v === bps);
  if (preset) return preset[1];
  return `${formatBytes(bps)}/s`;
}

function DownloadEngine() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: remote } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [draft, setDraft] = useState<DownloadSettings | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (remote && !draft) setDraft(remote);
  }, [remote, draft]);

  const mutation = useMutation({
    mutationFn: (data: DownloadSettings) => settingsApi.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    onError: () => toast.error("Failed to save engine settings"),
  });

  const set = (patch: Partial<DownloadSettings>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => mutation.mutate(next), 600);
      return next;
    });
  };

  const s = draft;
  const customSpeed = s && !SPEED_PRESETS.some(([v]) => v === s.speed_limit_bps);

  return (
    <div className={"xdlsettings" + (open ? " is-open" : "")}>
      <button className="xdlsettings__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Settings size={19} style={{ color: "var(--text-tertiary)" }} />
        <span className="xdlsettings__title">Download Engine</span>
        <span className="xdlsettings__sum">
          {s ? `${s.max_concurrent_downloads} concurrent · ${speedLabel(s.speed_limit_bps)}` : "…"}
        </span>
        <ChevronDown size={20} className="xdlsettings__chev" />
      </button>
      {open && s && (
        <div className="xdlsettings__body">
          <div className="xctrl">
            <div className="xctrl__label">
              <span>Concurrent downloads</span>
              <span className="xctrl__val">{s.max_concurrent_downloads}</span>
            </div>
            <input
              className="xrange"
              type="range"
              min={1}
              max={10}
              value={s.max_concurrent_downloads}
              onChange={(e) => set({ max_concurrent_downloads: Number(e.target.value) })}
            />
          </div>
          <div className="xctrl">
            <div className="xctrl__label">
              <span>Max retries</span>
              <span className="xctrl__val">{s.max_retries}</span>
            </div>
            <input
              className="xrange"
              type="range"
              min={0}
              max={5}
              value={s.max_retries}
              onChange={(e) => set({ max_retries: Number(e.target.value) })}
            />
          </div>
          <div className="xctrl">
            <div className="xctrl__label">
              <span>Speed limit</span>
            </div>
            <div className="xseg">
              {SPEED_PRESETS.map(([v, l]) => (
                <button key={v} className={s.speed_limit_bps === v ? "is-on" : ""} onClick={() => set({ speed_limit_bps: v })}>
                  {l}
                </button>
              ))}
              {customSpeed && <button className="is-on">{speedLabel(s.speed_limit_bps)}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = ["all", "active", "completed", "failed"] as const;
type Tab = (typeof TABS)[number];

export function Downloads() {
  const qc = useQueryClient();
  const setActiveDownloadCount = useAppStore((s) => s.setActiveDownloadCount);
  const [tab, setTab] = useState<Tab>("all");
  const [speedHist, setSpeedHist] = useState<number[]>(() => Array(GRAPH_LEN).fill(0));
  const wsRef = useRef<WebSocket | null>(null);

  const { data: downloads = [], refetch } = useQuery({
    queryKey: ["downloads"],
    queryFn: () => downloadsApi.list(),
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const hasActive = data.some((d) => d.status === "downloading" || d.status === "queued");
      return hasActive ? 2000 : 10000;
    },
  });

  // WebSocket for real-time progress
  useEffect(() => {
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/downloads`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.download_id || data.type === "heartbeat") return;

        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          qc.invalidateQueries({ queryKey: ["downloads"] });
          return;
        }

        qc.setQueryData<DownloadType[]>(["downloads"], (old) => {
          if (!old) return old;
          const found = old.some((dl) => dl.id === data.download_id);
          if (!found) return old;
          return old.map((dl) =>
            dl.id === data.download_id
              ? {
                  ...dl,
                  progress_pct: data.progress ?? dl.progress_pct,
                  speed_bps: data.speed_bps ?? dl.speed_bps,
                  downloaded_bytes: data.downloaded_bytes ?? dl.downloaded_bytes,
                  total_bytes: data.total_bytes ?? dl.total_bytes,
                  status: data.status ?? dl.status,
                }
              : dl
          );
        });
      } catch {
        /* ignore malformed frames */
      }
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [qc]);

  // live throughput history (1s tick)
  useEffect(() => {
    const t = setInterval(() => {
      const list = qc.getQueryData<DownloadType[]>(["downloads"]) ?? [];
      const total = list.filter((d) => d.status === "downloading").reduce((s, d) => s + d.speed_bps, 0);
      setSpeedHist((h) => [...h.slice(1), total]);
    }, 1000);
    return () => clearInterval(t);
  }, [qc]);

  // badge count
  useEffect(() => {
    const active = downloads.filter((d) => d.status === "downloading" || d.status === "queued").length;
    setActiveDownloadCount(active);
  }, [downloads, setActiveDownloadCount]);

  const counts = {
    all: downloads.length,
    downloading: downloads.filter((d) => d.status === "downloading").length,
    queued: downloads.filter((d) => d.status === "queued").length,
    paused: downloads.filter((d) => d.status === "paused").length,
    completed: downloads.filter((d) => d.status === "completed").length,
    failed: downloads.filter((d) => d.status === "failed" || d.status === "cancelled").length,
  };

  const totalSpeed = downloads.filter((d) => d.status === "downloading").reduce((s, d) => s + d.speed_bps, 0);
  const remaining = downloads
    .filter((d) => d.status === "downloading" || d.status === "queued")
    .reduce((s, d) => s + Math.max(0, d.total_bytes - d.downloaded_bytes), 0);
  const eta = totalSpeed > 0 ? fmtEta(remaining / totalSpeed) : "—";

  let list = downloads;
  if (tab === "active") list = downloads.filter((d) => ["downloading", "queued", "paused"].includes(d.status));
  else if (tab === "completed") list = downloads.filter((d) => d.status === "completed");
  else if (tab === "failed") list = downloads.filter((d) => d.status === "failed" || d.status === "cancelled");

  const tabItems = [
    {
      value: "all",
      label: (
        <span>
          All<span className="xtabcount">{counts.all}</span>
        </span>
      ),
    },
    {
      value: "active",
      label: (
        <span>
          Active<span className="xtabcount">{counts.downloading + counts.queued + counts.paused}</span>
        </span>
      ),
    },
    {
      value: "completed",
      label: (
        <span>
          Completed<span className="xtabcount">{counts.completed}</span>
        </span>
      ),
    },
    {
      value: "failed",
      label: (
        <span>
          Failed<span className="xtabcount">{counts.failed}</span>
        </span>
      ),
    },
  ];

  const handlePause = async (id: number) => {
    await downloadsApi.pause(id);
    refetch();
  };
  const handleResume = async (id: number) => {
    await downloadsApi.resume(id);
    refetch();
  };
  const handleRetry = async (id: number) => {
    try {
      await downloadsApi.retry(id);
      toast.success("Download re-queued");
      qc.invalidateQueries({ queryKey: ["downloads"] });
    } catch {
      toast.error("Failed to retry download");
    }
  };
  const handleDelete = (id: number) => {
    toast("Delete this download?", {
      action: {
        label: "Delete",
        onClick: async () => {
          await downloadsApi.delete(id);
          refetch();
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  return (
    <div className="xcontent">
      <div className="xpagehead" style={{ paddingBottom: 18 }}>
        <div className="xpagehead__eyebrow">IDM-grade queue · WebSocket live</div>
        <h1 className="xpagehead__title">Downloads</h1>
      </div>

      <div className="xdl">
        {/* mission-control banner */}
        <div className="xdl-banner xrise">
          <div className="xdl-banner__l">
            <span className="xdl-banner__eyebrow">
              <span className="xdl-banner__live">
                <span className="d" />
                Live
              </span>
              · Total throughput
            </span>
            <div className="xdl-banner__big">
              <span className="n">{(totalSpeed / (1024 * 1024)).toFixed(1)}</span>
              <span className="u">MB/s</span>
            </div>
            <div className="xdl-banner__substat">
              <div>
                <div className="k">Active</div>
                <div className="v">{counts.downloading}</div>
              </div>
              <div>
                <div className="k">Queued</div>
                <div className="v">{counts.queued}</div>
              </div>
              <div>
                <div className="k">ETA</div>
                <div className="v warn">{eta}</div>
              </div>
              <div>
                <div className="k">Done</div>
                <div className="v pos">{counts.completed}</div>
              </div>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <SpeedGraph hist={speedHist} />
          </div>
        </div>

        <div className="xdl-controls">
          <div className="xdl-controls__tabs">
            <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v as Tab)} />
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<DownloadIcon />}
            title="Queue's empty"
            sub="Nothing here yet. Go find something worth the bandwidth."
          />
        ) : (
          <div>
            {list.map((dl) => (
              <DownloadRow
                key={dl.id}
                dl={dl}
                onPause={handlePause}
                onResume={handleResume}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <DownloadEngine />
      </div>
    </div>
  );
}
