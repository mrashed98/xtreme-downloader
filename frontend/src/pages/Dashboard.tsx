import { useQuery } from "@tanstack/react-query";
import { Film, Tv, Clapperboard, Download, Plus, RefreshCw, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { downloadsApi, playlistsApi, seriesApi, vodApi, type Playlist } from "../api/client";
import { useAppStore } from "../store";
import { GlassCard } from "../components/Layout/GlassCard";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${color}`}>{icon}</div>
      </div>
    </GlassCard>
  );
}

interface PlaylistFormData {
  name: string;
  base_url: string;
  username: string;
  password: string;
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
      setError(detail || "Failed to save playlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md mx-4 p-6 animate-slide-up">
        <h2 className="text-lg font-semibold text-white mb-5">
          {existing ? "Edit Playlist" : "Add Playlist"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Name</label>
            <input
              className="w-full glass-input"
              placeholder="My IPTV"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Server URL</label>
            <input
              className="w-full glass-input"
              placeholder="http://server.example.com:8080"
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Username</label>
            <input
              className="w-full glass-input"
              placeholder="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Password {existing && "(leave blank to keep)"}
            </label>
            <input
              type="password"
              className="w-full glass-input"
              placeholder="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!existing}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg btn-accent text-sm font-medium disabled:opacity-50">
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

export function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [editPlaylist, setEditPlaylist] = useState<Playlist | null>(null);
  const { setActivePlaylistId, activePlaylistId } = useAppStore();

  const { data: playlists = [], refetch } = useQuery({
    queryKey: ["playlists"],
    queryFn: playlistsApi.list,
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.sync_status === "syncing") ? 2000 : false,
  });

  const { data: downloads = [] } = useQuery({
    queryKey: ["downloads"],
    queryFn: () => downloadsApi.list(),
    refetchInterval: 5000,
  });

  const { data: latestMovies = [] } = useQuery({
    queryKey: ["dashboard-latest-movies", activePlaylistId],
    queryFn: () => vodApi.streams(activePlaylistId!, { latest: true, limit: 6 }),
    enabled: !!activePlaylistId,
    staleTime: 60_000,
  });

  const { data: latestSeries = [] } = useQuery({
    queryKey: ["dashboard-latest-series", activePlaylistId],
    queryFn: () => seriesApi.list(activePlaylistId!, { latest: true, limit: 6 }),
    enabled: !!activePlaylistId,
    staleTime: 60_000,
  });

  const activeCount = downloads.filter((d) => d.status === "downloading").length;
  const completedCount = downloads.filter((d) => d.status === "completed").length;
  const failedCount = downloads.filter((d) => d.status === "failed").length;

  const handleDelete = (id: number, name: string) => {
    toast(`Delete playlist "${name}"?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          await playlistsApi.delete(id);
          refetch();
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const handleSync = async (id: number) => {
    await playlistsApi.sync(id);
    refetch();
  };

  return (
    <div className="page-shell h-full overflow-y-auto space-y-6 nav-clearance">
      <section className="glass-card page-hero overflow-hidden">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="page-hero__eyebrow">Overview</p>
            <h1 className="page-hero__title">Your IPTV command deck, rebuilt for web and mobile.</h1>
            <p className="page-hero__body">
              Xtreme Downloader is a media control frontend for syncing IPTV playlists, exploring live channels and on-demand catalogs, and managing downloads in one polished workspace.
            </p>
          </div>
          <div className="page-actions">
            <span className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/55">
              {playlists.length} playlists connected
            </span>
            <button
              onClick={() => { setEditPlaylist(null); setShowModal(true); }}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold btn-accent"
            >
              <Plus size={16} />
              Add Playlist
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Playlists" value={playlists.length} icon={<Tv size={20} className="text-purple-300" />} color="bg-purple-500/20" />
        <StatCard label="Downloading" value={activeCount} icon={<Download size={20} className="text-blue-300" />} color="bg-blue-500/20" />
        <StatCard label="Completed" value={completedCount} icon={<Film size={20} className="text-green-300" />} color="bg-green-500/20" />
        <StatCard label="Failed" value={failedCount} icon={<Clapperboard size={20} className="text-red-300" />} color="bg-red-500/20" />
      </div>

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="page-hero__eyebrow">Playlists</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Sources and sync status</h2>
          </div>
          <span className="hidden rounded-full border border-white/10 px-3 py-2 text-sm text-white/50 sm:inline-flex">
            Tap any row to make it active
          </span>
        </div>
        {playlists.length === 0 ? (
          <div className="text-center py-10">
            <Tv size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">No playlists yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {playlists.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col gap-4 rounded-[1.5rem] border p-4 transition-colors sm:flex-row sm:items-center ${
                  p.id === activePlaylistId ? "border-emerald-300/20 bg-emerald-300/8" : "border-white/6 bg-white/[0.025] hover:bg-white/[0.045]"
                }`}
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setActivePlaylistId(p.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${p.is_active ? "bg-green-400" : "bg-white/20"}`} />
                    <span className="font-medium text-white text-sm">{p.name}</span>
                    {p.id === activePlaylistId && (
                      <span className="badge badge-purple text-xs">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1 ml-4">
                    {p.base_url} · {p.username}
                  </p>
                  {p.last_synced_at && (
                    <p className="text-xs text-white/30 mt-0.5 ml-4">
                      Last sync: {new Date(p.last_synced_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleSync(p.id)}
                    disabled={p.sync_status === "syncing"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      p.sync_status === "syncing"
                        ? "text-blue-400 cursor-not-allowed"
                        : "hover:bg-white/10 text-white/40 hover:text-white"
                    }`}
                    title={p.sync_status === "syncing" ? "Syncing..." : "Sync"}
                    aria-label={`Sync playlist ${p.name}`}
                  >
                    <RefreshCw size={14} className={p.sync_status === "syncing" ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={() => { setEditPlaylist(p); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    title="Edit"
                    aria-label={`Edit playlist ${p.name}`}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    title="Delete"
                    aria-label={`Delete playlist ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-5 sm:p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="page-hero__eyebrow">Latest Media</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Newest synced picks</h2>
            </div>
            <Link to="/settings" className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white">
              Open Settings
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Film size={16} className="text-amber-300" />
                <h3 className="text-sm font-semibold text-white">Latest Movies</h3>
              </div>
              <div className="space-y-3">
                {latestMovies.length ? latestMovies.map((item) => (
                  <div key={item.stream_id} className="flex items-center gap-3">
                    <div className="h-12 w-10 overflow-hidden rounded-xl bg-white/5">
                      {item.icon && <img src={item.icon} alt={item.name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.name}</p>
                      <p className="truncate text-xs text-white/45">{item.genre || "No genre yet"}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-white/35">Select a playlist to load latest movies.</p>}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clapperboard size={16} className="text-emerald-300" />
                <h3 className="text-sm font-semibold text-white">Latest Series</h3>
              </div>
              <div className="space-y-3">
                {latestSeries.length ? latestSeries.map((item) => (
                  <div key={item.series_id} className="flex items-center gap-3">
                    <div className="h-12 w-10 overflow-hidden rounded-xl bg-white/5">
                      {item.cover && <img src={item.cover} alt={item.name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.name}</p>
                      <p className="truncate text-xs text-white/45">{item.release_date || item.genre || "No release date yet"}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-white/35">Select a playlist to load latest series.</p>}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <p className="page-hero__eyebrow">Analytics Readiness</p>
          <h2 className="mt-2 text-xl font-semibold text-white">What we can power now</h2>
          <div className="mt-4 space-y-3 text-sm text-white/60">
            <p>Available now: latest added movies, latest series, favorites, downloads, server state, and sync health.</p>
            <p>Missing for true dashboard analytics: playback history, play counters, last watched timestamps, and popularity aggregates.</p>
            <p>Next backend step for “Recent Watched”, “Most Watched”, and “Popular”: add a playback-events table and increment counters from the watch endpoints.</p>
          </div>
        </GlassCard>
      </div>

      {showModal && (
        <PlaylistModal
          onClose={() => setShowModal(false)}
          onSaved={refetch}
          existing={editPlaylist}
        />
      )}
    </div>
  );
}
