import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, AlertCircle, Menu } from "lucide-react";
import { useState } from "react";
import { playlistsApi, type Playlist } from "../../api/client";
import { useAppStore } from "../../store";

export function Navbar() {
  const { activePlaylistId, setActivePlaylistId, setPlaylists } = useAppStore();
  const sidebarMobileOpen = useAppStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useAppStore((s) => s.setSidebarMobileOpen);
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
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  return (
    <header className="app-topbar">
      <button
        onClick={() => setSidebarMobileOpen(true)}
        className="flex-shrink-0 rounded-2xl border border-white/10 p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        aria-label="Open navigation"
        aria-expanded={sidebarMobileOpen}
        title="Menu"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-white/35">
          Control Center
        </p>
        <div className="relative mt-2">
          <button
            className="flex max-w-[9rem] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-left transition-colors hover:bg-white/[0.075] lg:max-w-[15rem]"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className={`h-2 w-2 rounded-full ${isSyncing ? "bg-yellow-400 animate-pulse" : isError ? "bg-red-400" : "bg-green-400"}`} />
            <span className="truncate text-sm font-medium text-white/90">
              {activePlaylist?.name || "Select Playlist"}
            </span>
            <ChevronDown size={14} className="text-white/50" />
          </button>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-[rgba(10,18,31,0.96)] shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:right-auto">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    p.id === activePlaylistId
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => {
                    setActivePlaylistId(p.id);
                    setShowDropdown(false);
                  }}
                >
                  <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
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
      </div>

      <div className="flex-1" />

      {(isSyncing || isError) && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.045] px-2.5 py-2 text-xs md:px-3">
          {isSyncing && (
            <span className="animate-pulse text-yellow-300 md:hidden">Syncing…</span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-red-300 md:hidden">
              <AlertCircle size={11} /> Failed
            </span>
          )}
          <span className="hidden items-center gap-2 text-white/55 md:flex">
            {isSyncing && <span className="animate-pulse text-yellow-300">Syncing now</span>}
            {isError && (
              <span className="flex items-center gap-1 text-red-300">
                <AlertCircle size={12} /> Sync failed
              </span>
            )}
          </span>
        </div>
      )}
      {!isSyncing && !isError && (
        <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/55 md:flex">
          {activePlaylist?.last_synced_at
            ? <span>Last sync {new Date(activePlaylist.last_synced_at).toLocaleString()}</span>
            : <span>Ready to sync playlist</span>
          }
        </div>
      )}

      {activePlaylistId && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title={isSyncing ? "Sync in progress…" : "Sync now"}
          aria-label={isSyncing ? "Sync in progress" : "Sync now"}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.075] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          <span className="hidden sm:block">{isSyncing ? "Syncing…" : "Sync"}</span>
        </button>
      )}
    </header>
  );
}
