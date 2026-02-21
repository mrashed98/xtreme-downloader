import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Pause, Play, Trash2, Download, Settings, X } from "lucide-react";
import {
  downloadsApi,
  settingsApi,
  formatBytes,
  formatSpeed,
  type Download as DownloadType,
  type DownloadSettings,
} from "../api/client";
import { useAppStore } from "../store";
import { GlassCard } from "../components/Layout/GlassCard";

const STATUS_COLORS: Record<string, string> = {
  queued: "badge-gray",
  downloading: "badge-purple",
  paused: "badge-yellow",
  completed: "badge-green",
  failed: "badge-red",
  cancelled: "badge-gray",
};

const TABS = ["all", "downloading", "completed", "failed"] as const;
type Tab = (typeof TABS)[number];

type SpeedUnit = "unlimited" | "kbps" | "mbps";

function bpsToDisplay(bps: number): { value: number; unit: SpeedUnit } {
  if (bps === 0) return { value: 0, unit: "unlimited" };
  if (bps >= 1024 * 1024) return { value: Math.round(bps / (1024 * 1024)), unit: "mbps" };
  return { value: Math.round(bps / 1024), unit: "kbps" };
}

function displayToBps(value: number, unit: SpeedUnit): number {
  if (unit === "unlimited") return 0;
  if (unit === "mbps") return value * 1024 * 1024;
  return value * 1024;
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: remoteSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [concurrent, setConcurrent] = useState(3);
  const [chunks, setChunks] = useState(16);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>("unlimited");
  const [speedValue, setSpeedValue] = useState(0);

  // Sync local state when remote data loads
  useEffect(() => {
    if (remoteSettings) {
      setConcurrent(remoteSettings.max_concurrent_downloads);
      setChunks(remoteSettings.download_chunks);
      const { value, unit } = bpsToDisplay(remoteSettings.speed_limit_bps);
      setSpeedUnit(unit);
      setSpeedValue(value);
    }
  }, [remoteSettings]);

  const mutation = useMutation({
    mutationFn: (data: DownloadSettings) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    mutation.mutate({
      max_concurrent_downloads: concurrent,
      download_chunks: chunks,
      speed_limit_bps: displayToBps(speedValue, speedUnit),
    });
  };

  return (
    <div className="glass-card p-5 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Settings size={15} className="text-purple-400" />
          Download Settings
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Concurrent Downloads */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Concurrent Downloads</span>
          <span className="text-white font-medium tabular-nums">{concurrent} / 10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={concurrent}
          onChange={(e) => setConcurrent(Number(e.target.value))}
          className="w-full accent-purple-500 cursor-pointer"
        />
      </div>

      {/* Chunks per Download */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60" title="IDM-style parallel parts — higher = faster on good connections">
            Chunks per Download
          </span>
          <span className="text-white font-medium tabular-nums">{chunks} / 32</span>
        </div>
        <input
          type="range"
          min={1}
          max={32}
          value={chunks}
          onChange={(e) => setChunks(Number(e.target.value))}
          className="w-full accent-purple-500 cursor-pointer"
        />
      </div>

      {/* Speed Limit */}
      <div className="space-y-2">
        <span className="text-xs text-white/60">Speed Limit</span>
        <div className="flex items-center gap-2">
          <select
            value={speedUnit}
            onChange={(e) => {
              const u = e.target.value as SpeedUnit;
              setSpeedUnit(u);
              if (u === "unlimited") setSpeedValue(0);
              else if (speedValue === 0) setSpeedValue(u === "mbps" ? 10 : 1024);
            }}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="unlimited">Unlimited</option>
            <option value="kbps">KB/s</option>
            <option value="mbps">MB/s</option>
          </select>
          {speedUnit !== "unlimited" && (
            <input
              type="number"
              min={1}
              value={speedValue}
              onChange={(e) => setSpeedValue(Math.max(1, Number(e.target.value)))}
              className="w-24 bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 tabular-nums"
            />
          )}
          {speedUnit === "unlimited" && (
            <span className="text-xs text-white/30">No limit</span>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && <span className="text-xs text-green-400">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="btn-accent px-4 py-1.5 text-xs rounded-lg disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DownloadRow({
  dl,
  onPause,
  onResume,
  onDelete,
}: {
  dl: DownloadType;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const progress = dl.progress_pct;

  return (
    <div className="glass-card p-4 space-y-2 animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{dl.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`badge ${STATUS_COLORS[dl.status] || "badge-gray"}`}>
              {dl.status}
            </span>
            <span className="text-xs text-white/40">{dl.content_type}</span>
            {dl.language && <span className="text-xs text-white/30">{dl.language}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {dl.status === "downloading" && (
            <button
              onClick={() => onPause(dl.id)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Pause"
            >
              <Pause size={14} />
            </button>
          )}
          {dl.status === "paused" && (
            <button
              onClick={() => onResume(dl.id)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Resume"
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={() => onDelete(dl.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress */}
      {(dl.status === "downloading" || dl.status === "paused" || (dl.status === "completed" && progress > 0)) && (
        <>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>
              {formatBytes(dl.downloaded_bytes)} / {dl.total_bytes > 0 ? formatBytes(dl.total_bytes) : "?"}
            </span>
            <div className="flex items-center gap-3">
              {dl.status === "downloading" && dl.speed_bps > 0 && (
                <span className="text-purple-400">{formatSpeed(dl.speed_bps)}</span>
              )}
              <span>{progress.toFixed(1)}%</span>
            </div>
          </div>
        </>
      )}

      {dl.status === "failed" && dl.error_message && (
        <p className="text-xs text-red-400/80 truncate">{dl.error_message}</p>
      )}

      {dl.file_path && dl.status === "completed" && (
        <p className="text-xs text-white/30 truncate">{dl.file_path}</p>
      )}
    </div>
  );
}

export function Downloads() {
  const qc = useQueryClient();
  const setActiveDownloadCount = useAppStore((s) => s.setActiveDownloadCount);
  const [tab, setTab] = useState<Tab>("all");
  const [showSettings, setShowSettings] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: downloads = [], refetch } = useQuery({
    queryKey: ["downloads", tab],
    queryFn: () => downloadsApi.list({ status: tab === "all" ? undefined : tab }),
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const hasActive = data.some(
        (d) => d.status === "downloading" || d.status === "queued"
      );
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

        // If status changed to a terminal state, do a full refetch to get fresh data
        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          qc.invalidateQueries({ queryKey: ["downloads"] });
          return;
        }

        // Otherwise patch in-place for smooth progress updates
        qc.setQueryData<DownloadType[]>(["downloads", tab], (old) => {
          if (!old) return old;
          const found = old.some((dl) => dl.id === data.download_id);
          if (!found) {
            // Not in this tab's filtered list — polling will pick it up
            return old;
          }
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
      } catch {}
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [tab]);

  // Update badge count
  useEffect(() => {
    const active = downloads.filter((d) => d.status === "downloading" || d.status === "queued").length;
    setActiveDownloadCount(active);
  }, [downloads, setActiveDownloadCount]);

  const handlePause = async (id: number) => {
    await downloadsApi.pause(id);
    refetch();
  };

  const handleResume = async (id: number) => {
    await downloadsApi.resume(id);
    refetch();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this download?")) return;
    await downloadsApi.delete(id);
    refetch();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <p className="text-white/50 text-sm mt-0.5">{downloads.length} items</p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings
              ? "bg-purple-500/20 text-purple-400"
              : "hover:bg-white/10 text-white/40 hover:text-white"
          }`}
          title="Download Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Tabs */}
      <div className="flex gap-1 glass-card p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "btn-accent" : "text-white/50 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Downloads list */}
      {downloads.length === 0 ? (
        <GlassCard className="p-12">
          <div className="text-center text-white/30">
            <Download size={48} className="mx-auto mb-3 opacity-30" />
            <p>No downloads found</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => (
            <DownloadRow
              key={dl.id}
              dl={dl}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
