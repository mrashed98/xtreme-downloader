import { useQuery } from "@tanstack/react-query";
import { Film, Tv, Clapperboard, Download, Plus, RefreshCw, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { playlistsApi, downloadsApi, type Playlist } from "../api/client";
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
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
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
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save playlist");
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

  const activeCount = downloads.filter((d) => d.status === "downloading").length;
  const completedCount = downloads.filter((d) => d.status === "completed").length;
  const failedCount = downloads.filter((d) => d.status === "failed").length;

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this playlist?")) return;
    await playlistsApi.delete(id);
    refetch();
  };

  const handleSync = async (id: number) => {
    await playlistsApi.sync(id);
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-sm mt-0.5">Manage your IPTV playlists and downloads</p>
        </div>
        <button
          onClick={() => { setEditPlaylist(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium"
        >
          <Plus size={16} />
          Add Playlist
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Playlists" value={playlists.length} icon={<Tv size={20} className="text-purple-300" />} color="bg-purple-500/20" />
        <StatCard label="Downloading" value={activeCount} icon={<Download size={20} className="text-blue-300" />} color="bg-blue-500/20" />
        <StatCard label="Completed" value={completedCount} icon={<Film size={20} className="text-green-300" />} color="bg-green-500/20" />
        <StatCard label="Failed" value={failedCount} icon={<Clapperboard size={20} className="text-red-300" />} color="bg-red-500/20" />
      </div>

      {/* Playlists */}
      <GlassCard className="p-5">
        <h2 className="text-base font-semibold text-white mb-4">Playlists</h2>
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
                className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${
                  p.id === activePlaylistId ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/3 hover:bg-white/5"
                }`}
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setActivePlaylistId(p.id)}
                >
                  <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(p.id)}
                    disabled={p.sync_status === "syncing"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      p.sync_status === "syncing"
                        ? "text-blue-400 cursor-not-allowed"
                        : "hover:bg-white/10 text-white/40 hover:text-white"
                    }`}
                    title={p.sync_status === "syncing" ? "Syncing..." : "Sync"}
                  >
                    <RefreshCw size={14} className={p.sync_status === "syncing" ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={() => { setEditPlaylist(p); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

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
