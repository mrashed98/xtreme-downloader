import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Pencil, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "../components/Layout/GlassCard";
import {
  playlistsApi,
  settingsApi,
  type DownloadSettings,
  type Playlist,
} from "../api/client";

interface PlaylistFormData {
  name: string;
  base_url: string;
  username: string;
  password: string;
}

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

function PlaylistModal({
  onClose,
  onSaved,
  existing,
}: {
  onClose: () => void;
  onSaved: () => void;
  existing?: Playlist | null;
}) {
  const [form, setForm] = useState<PlaylistFormData>({
    name: existing?.name || "",
    base_url: existing?.base_url || "",
    username: existing?.username || "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (existing) {
        await playlistsApi.update(existing.id, form);
      } else {
        await playlistsApi.create(form);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      setError(detail || "Failed to save server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <GlassCard className="mx-4 w-full max-w-md p-6 animate-slide-up">
        <h2 className="mb-5 text-lg font-semibold text-white">
          {existing ? "Edit Server" : "Add Server"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Name</label>
            <input
              className="glass-input w-full"
              placeholder="My IPTV"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Server URL</label>
            <input
              className="glass-input w-full"
              placeholder="http://server.example.com:8080"
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Username</label>
            <input
              className="glass-input w-full"
              placeholder="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Password {existing && "(leave blank to keep)"}
            </label>
            <input
              type="password"
              className="glass-input w-full"
              placeholder="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!existing}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-white/5 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-accent flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editPlaylist, setEditPlaylist] = useState<Playlist | null>(null);

  const { data: playlists = [], refetch: refetchPlaylists } = useQuery({
    queryKey: ["playlists"],
    queryFn: playlistsApi.list,
  });

  const { data: remoteSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [concurrent, setConcurrent] = useState(3);
  const [chunks, setChunks] = useState(16);
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>("unlimited");
  const [speedValue, setSpeedValue] = useState(0);
  const [maxRetries, setMaxRetries] = useState(2);

  useEffect(() => {
    if (!remoteSettings) return;
    setConcurrent(remoteSettings.max_concurrent_downloads);
    setChunks(remoteSettings.download_chunks);
    const { value, unit } = bpsToDisplay(remoteSettings.speed_limit_bps);
    setSpeedUnit(unit);
    setSpeedValue(value);
    setMaxRetries(remoteSettings.max_retries ?? 2);
  }, [remoteSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: (data: DownloadSettings) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Download settings saved");
    },
    onError: () => {
      toast.error("Failed to save download settings");
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      max_concurrent_downloads: concurrent,
      download_chunks: chunks,
      speed_limit_bps: displayToBps(speedValue, speedUnit),
      max_retries: maxRetries,
    });
  };

  const handleDelete = (id: number, name: string) => {
    toast(`Delete server "${name}"?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          await playlistsApi.delete(id);
          refetchPlaylists();
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const handleSync = async (id: number) => {
    await playlistsApi.sync(id);
    refetchPlaylists();
  };

  return (
    <div className="page-shell h-full overflow-y-auto space-y-6 nav-clearance">
      <section className="glass-card page-hero">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-hero__eyebrow">Settings</p>
            <h1 className="page-hero__title">Manage servers and download behavior in one place.</h1>
            <p className="page-hero__body">
              Use this page to maintain IPTV sources and tune downloader performance without leaving the app shell.
            </p>
          </div>
          <button
            onClick={() => {
              setEditPlaylist(null);
              setShowModal(true);
            }}
            className="btn-accent inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            <Plus size={16} />
            Add Server
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4">
            <p className="page-hero__eyebrow">Servers</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Playlist sources</h2>
          </div>

          {playlists.length === 0 ? (
            <div className="py-10 text-center text-white/35">
              <p>No servers added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{playlist.name}</span>
                        <span className={`badge ${playlist.sync_status === "syncing" ? "badge-yellow" : playlist.sync_status === "error" ? "badge-red" : "badge-green"}`}>
                          {playlist.sync_status}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-white/45">{playlist.base_url}</p>
                      <p className="mt-1 text-xs text-white/35">{playlist.username}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(playlist.id)}
                        className="rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                        title="Sync"
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setEditPlaylist(playlist);
                          setShowModal(true);
                        }}
                        className="rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(playlist.id, playlist.name)}
                        className="rounded-xl p-2 text-white/45 transition-colors hover:bg-red-500/20 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4">
            <p className="page-hero__eyebrow">Downloads</p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
              <Settings2 size={18} className="text-emerald-300" />
              Performance controls
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Concurrent Downloads</span>
                <span className="font-medium tabular-nums text-white">{concurrent} / 10</span>
              </div>
              <input type="range" min={1} max={10} value={concurrent} onChange={(e) => setConcurrent(Number(e.target.value))} className="w-full cursor-pointer accent-purple-500" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Chunks per Download</span>
                <span className="font-medium tabular-nums text-white">{chunks} / 16</span>
              </div>
              <input type="range" min={1} max={16} value={chunks} onChange={(e) => setChunks(Number(e.target.value))} className="w-full cursor-pointer accent-purple-500" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Max Retries</span>
                <span className="font-medium tabular-nums text-white">{maxRetries} / 5</span>
              </div>
              <input type="range" min={0} max={5} value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} className="w-full cursor-pointer accent-purple-500" />
            </div>

            <div className="space-y-2">
              <span className="text-xs text-white/60">Speed Limit</span>
              <div className="flex items-center gap-2">
                <select
                  value={speedUnit}
                  onChange={(e) => {
                    const unit = e.target.value as SpeedUnit;
                    setSpeedUnit(unit);
                    if (unit === "unlimited") setSpeedValue(0);
                    else if (speedValue === 0) setSpeedValue(unit === "mbps" ? 10 : 1024);
                  }}
                  className="glass-input py-2 text-xs"
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="kbps">KB/s</option>
                  <option value="mbps">MB/s</option>
                </select>
                {speedUnit !== "unlimited" ? (
                  <input
                    type="number"
                    min={1}
                    value={speedValue}
                    onChange={(e) => setSpeedValue(Math.max(1, Number(e.target.value)))}
                    className="glass-input w-28 py-2 text-xs tabular-nums"
                  />
                ) : (
                  <span className="text-xs text-white/35">No limit</span>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
              className="btn-accent mt-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </GlassCard>
      </div>

      {showModal && (
        <PlaylistModal
          existing={editPlaylist}
          onClose={() => setShowModal(false)}
          onSaved={refetchPlaylists}
        />
      )}
    </div>
  );
}
