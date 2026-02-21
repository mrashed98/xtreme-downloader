import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, AlertCircle } from "lucide-react";
import { useState } from "react";
import { playlistsApi, type Playlist } from "../../api/client";
import { useAppStore } from "../../store";

export function Navbar() {
  const { activePlaylistId, setActivePlaylistId, setPlaylists } = useAppStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const qc = useQueryClient();

  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const data = await playlistsApi.list();
      setPlaylists(data);
      if (!activePlaylistId && data.length > 0) {
        setActivePlaylistId(data[0].id);
      }
      return data;
    },
    // Poll faster when any playlist is syncing so the status updates promptly
    refetchInterval: (query) => {
      const data = query.state.data as Playlist[] | undefined;
      return data?.some((p) => p.sync_status === "syncing") ? 2000 : 30_000;
    },
  });

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);
  const isSyncing = activePlaylist?.sync_status === "syncing";
  const isError = activePlaylist?.sync_status === "error";

  const handleSync = async () => {
    if (!activePlaylistId || isSyncing) return;
    await playlistsApi.sync(activePlaylistId);
    // Immediately refresh to show "syncing" status
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  return (
    <header className="glass-card rounded-none border-b border-white/10 px-6 py-3 flex items-center gap-4">
      {/* Playlist selector */}
      <div className="relative">
        <button
          className="flex items-center gap-2 glass-card px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <div className={`w-2 h-2 rounded-full ${isSyncing ? "bg-yellow-400 animate-pulse" : isError ? "bg-red-400" : "bg-green-400"}`} />
          <span className="text-sm font-medium text-white/90">
            {activePlaylist?.name || "Select Playlist"}
          </span>
          <ChevronDown size={14} className="text-white/50" />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-56 glass-card rounded-lg overflow-hidden z-50 shadow-xl">
            {playlists.map((p) => (
              <button
                key={p.id}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                  p.id === activePlaylistId
                    ? "bg-accent-purple/30 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => {
                  setActivePlaylistId(p.id);
                  setShowDropdown(false);
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  p.sync_status === "syncing" ? "bg-yellow-400 animate-pulse" :
                  p.sync_status === "error" ? "bg-red-400" : "bg-green-400"
                }`} />
                {p.name}
              </button>
            ))}
            {!playlists.length && (
              <p className="px-4 py-3 text-sm text-white/40">No playlists yet</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Sync status text */}
      {isSyncing && (
        <span className="hidden md:block text-xs text-yellow-400/80 animate-pulse">
          Syncing...
        </span>
      )}
      {isError && (
        <span className="hidden md:flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={12} /> Sync failed
        </span>
      )}
      {activePlaylist?.last_synced_at && !isSyncing && (
        <span className="hidden md:block text-xs text-white/30">
          Last sync: {new Date(activePlaylist.last_synced_at).toLocaleString()}
        </span>
      )}

      {/* Sync button */}
      {activePlaylistId && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title={isSyncing ? "Sync in progress…" : "Sync now"}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          <span className="hidden sm:block">{isSyncing ? "Syncing…" : "Sync"}</span>
        </button>
      )}
    </header>
  );
}
