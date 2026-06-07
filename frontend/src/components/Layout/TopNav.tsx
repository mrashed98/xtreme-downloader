import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { playlistsApi, type Playlist } from "../../api/client";
import { useAppStore } from "../../store";
import { Avatar, Bolt } from "../ds";
import { navItems } from "./navItems";

/** Shared playlists query — keeps the active playlist fresh + auto-selects the first one. */
export function usePlaylists() {
  const { activePlaylistId, setActivePlaylistId, setPlaylists } = useAppStore();
  return useQuery({
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
}

function syncDotClass(p?: Playlist) {
  if (!p) return "d is-error";
  if (p.sync_status === "syncing") return "d is-syncing";
  if (p.sync_status === "error") return "d is-error";
  return "d";
}

export function PlaylistSwitcher() {
  const { activePlaylistId, setActivePlaylistId } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data: playlists = [] } = usePlaylists();
  const active = playlists.find((p) => p.id === activePlaylistId);
  const isSyncing = active?.sync_status === "syncing";

  const { data: account } = useQuery({
    queryKey: ["account", activePlaylistId],
    queryFn: () => playlistsApi.account(activePlaylistId!),
    enabled: !!activePlaylistId,
    staleTime: 300_000,
    retry: 0,
  });
  const expDays = account?.exp_date
    ? Math.ceil((account.exp_date * 1000 - Date.now()) / 86_400_000)
    : null;
  const expSoon = expDays != null && expDays <= 14;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePlaylistId || isSyncing) return;
    await playlistsApi.sync(activePlaylistId);
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="xtopnav__pl"
        style={{ border: "1px solid var(--border-subtle)" }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Avatar name={active?.name || "X"} size={34} tone="var(--volt-500)" />
        <div style={{ textAlign: "left" }}>
          <div className="xtopnav__pl-name">{active?.name || "No playlist"}</div>
          <div className="xtopnav__pl-sub" style={expSoon ? { color: "var(--warn-500)" } : undefined}>
            <span className={expSoon ? "d is-syncing" : syncDotClass(active)} />
            {active
              ? expSoon
                ? `Expires in ${expDays}d`
                : isSyncing
                ? "Syncing…"
                : active.sync_status === "error"
                ? "Sync failed"
                : "Active source"
              : "Add a source"}
          </div>
        </div>
      </button>

      {open && (
        <div className="xpl-pop" role="listbox">
          {playlists.map((p) => (
            <button
              key={p.id}
              className={"xpl-pop__opt" + (p.id === activePlaylistId ? " is-on" : "")}
              role="option"
              aria-selected={p.id === activePlaylistId}
              onClick={() => {
                setActivePlaylistId(p.id);
                setOpen(false);
              }}
            >
              <span className={syncDotClass(p)} style={{ width: 7, height: 7, borderRadius: "50%", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            </button>
          ))}
          {!playlists.length && <div className="xpl-pop__empty">No playlists yet — add one from the Dashboard.</div>}
          {active && (
            <button className="xpl-pop__opt" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw size={14} className={isSyncing ? "is-spinning" : ""} style={isSyncing ? { animation: "xspin 1s linear infinite" } : undefined} />
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const activeDownloadCount = useAppStore((s) => s.activeDownloadCount);
  const navigate = useNavigate();

  return (
    <header className="xtopnav">
      <button className="xtopnav__logo" onClick={() => navigate("/")} aria-label="Xtreme Downloader — home">
        <span style={{ width: 28, height: 28 }}>
          <Bolt size={28} />
        </span>
        <span className="xtopnav__word">
          X<b>TREME</b>
          <span className="xtopnav__tag">Downloader</span>
        </span>
      </button>

      <nav className="xtopnav__nav">
        {navItems.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "xtopnav__item" + (isActive ? " is-active" : "")}>
            {label}
            {label === "Downloads" && activeDownloadCount > 0 ? (
              <span className="xtopnav__badge">{activeDownloadCount > 9 ? "9+" : activeDownloadCount}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="xtopnav__right">
        <PlaylistSwitcher />
      </div>
    </header>
  );
}
