import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, playlistsApi, settingsApi, type DownloadSettings, type Playlist } from "../api/client";
import { useAppStore } from "../store";
import { Badge, Button, SectionHead } from "../components/ds";
import { usePlaylists } from "../components/Layout/TopNav";
import { PlaylistModal } from "./Dashboard";

function AccountStatus({ playlistId }: { playlistId: number }) {
  const { data, isError } = useQuery({
    queryKey: ["account", playlistId],
    queryFn: () => playlistsApi.account(playlistId),
    staleTime: 300_000,
    retry: 0,
  });
  if (isError)
    return (
      <p className="xpl__url" style={{ color: "var(--neg-500)" }}>
        account check failed — provider unreachable or credentials rejected
      </p>
    );
  if (!data) return null;
  const exp = data.exp_date ? new Date(data.exp_date * 1000) : null;
  const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null;
  const expSoon = days != null && days <= 14;
  const maxed =
    data.max_connections != null &&
    data.active_connections != null &&
    data.active_connections >= data.max_connections;
  return (
    <p className="xpl__url" style={{ maxWidth: "none" }}>
      <span style={{ color: data.status === "Active" ? "var(--pos-500)" : "var(--warn-500)" }}>
        {data.status || "Unknown"}
        {data.is_trial ? " · trial" : ""}
      </span>
      {exp && (
        <span style={{ color: expSoon ? "var(--warn-500)" : undefined }}>
          {" "}· expires {exp.toLocaleDateString()}
          {days != null ? ` (${days}d)` : ""}
        </span>
      )}
      {data.max_connections != null && (
        <span style={{ color: maxed ? "var(--warn-500)" : undefined }}>
          {" "}· {data.active_connections ?? 0}/{data.max_connections} connections
        </span>
      )}
    </p>
  );
}

const SPEED_PRESETS: [number, string][] = [
  [0, "Max"],
  [1024 * 1024, "1MB/s"],
  [2 * 1024 * 1024, "2MB/s"],
  [5 * 1024 * 1024, "5MB/s"],
  [10 * 1024 * 1024, "10MB/s"],
];

function fmtAgo(date: string | null): string {
  if (!date) return "never";
  const min = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function statusBadge(p: Playlist) {
  if (p.sync_status === "syncing")
    return (
      <Badge variant="soft" style={{ color: "var(--warn-500)" }}>
        ● Syncing
      </Badge>
    );
  if (p.sync_status === "error")
    return (
      <Badge variant="soft" style={{ color: "var(--neg-500)" }}>
        ● Sync failed
      </Badge>
    );
  if (p.last_synced_at)
    return (
      <Badge variant="soft" style={{ color: "var(--pos-500)" }}>
        ● Synced
      </Badge>
    );
  return (
    <Badge variant="soft" style={{ color: "var(--warn-500)" }}>
      ● Needs sync
    </Badge>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editPlaylist, setEditPlaylist] = useState<Playlist | null>(null);
  const showAdult = useAppStore((s) => s.showAdult);
  const setShowAdult = useAppStore((s) => s.setShowAdult);

  const { data: playlists = [], refetch: refetchPlaylists } = usePlaylists();

  const { data: remoteSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [draft, setDraft] = useState<DownloadSettings | null>(null);
  useEffect(() => {
    if (remoteSettings && !draft) setDraft(remoteSettings);
  }, [remoteSettings, draft]);

  const dirty = !!draft && !!remoteSettings && JSON.stringify(draft) !== JSON.stringify(remoteSettings);

  const saveSettingsMutation = useMutation({
    mutationFn: (data: DownloadSettings) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Engine settings applied");
    },
    onError: () => {
      toast.error("Failed to save download settings");
    },
  });

  const set = (patch: Partial<DownloadSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleDelete = (id: number, name: string) => {
    toast(`Delete source "${name}"?`, {
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

  const customSpeed = draft && !SPEED_PRESETS.some(([v]) => v === draft.speed_limit_bps);

  return (
    <div className="xcontent" style={{ maxWidth: 980 }}>
      <div className="xpagehead">
        <div className="xpagehead__eyebrow">Sources · Engine</div>
        <h1 className="xpagehead__title">Settings</h1>
      </div>

      {/* servers */}
      <section className="xsec" style={{ marginTop: 8 }}>
        <SectionHead title="Playlist Sources" />
        <div className="xcard" style={{ padding: 8 }}>
          {playlists.map((p) => (
            <div key={p.id} className="xpl__row" style={{ cursor: "default" }}>
              <span
                className="xpl__dot"
                style={p.is_active ? { background: "var(--volt-500)", boxShadow: "0 0 0 4px var(--accent-soft)" } : {}}
              />
              <div style={{ minWidth: 0 }}>
                <div className="xpl__name">
                  {p.name}
                  {statusBadge(p)}
                </div>
                <div className="xpl__url">
                  {p.username}@{p.base_url.replace(/^https?:\/\//, "")}
                </div>
                <AccountStatus playlistId={p.id} />
              </div>
              <div className="xpl__meta">
                <span className="xpl__sync">{p.sync_status === "syncing" ? "Syncing…" : fmtAgo(p.last_synced_at)}</span>
                <button
                  className={"xrowbtn" + (p.sync_status === "syncing" ? " is-spinning" : "")}
                  onClick={() => handleSync(p.id)}
                  disabled={p.sync_status === "syncing"}
                  aria-label={`Sync ${p.name}`}
                >
                  <RefreshCw />
                </button>
                <button
                  className="xrowbtn"
                  onClick={() => {
                    setEditPlaylist(p);
                    setShowModal(true);
                  }}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil />
                </button>
                <button className="xrowbtn xrowbtn--danger" onClick={() => handleDelete(p.id, p.name)} aria-label={`Delete ${p.name}`}>
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
          <button
            className="xnavitem"
            style={{ margin: 8, width: "calc(100% - 16px)", color: "var(--volt-500)" }}
            onClick={() => {
              setEditPlaylist(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} style={{ color: "var(--volt-500)" }} />
            Add a new source
          </button>
        </div>
      </section>

      {/* content */}
      <section className="xsec">
        <SectionHead title="Content" />
        <div className="xcard xcard--pad">
          <label className="xcheckrow">
            <input type="checkbox" checked={showAdult} onChange={(e) => setShowAdult(e.target.checked)} />
            Show adult-flagged titles in the catalog
          </label>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12.5, margin: "8px 0 0 27px" }}>
            Titles the provider marks as adult are hidden by default.
          </p>
        </div>
      </section>

      {/* performance */}
      <section className="xsec">
        <SectionHead title="Performance" />
        <div className="xcard xcard--pad">
          {draft ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                <div className="xctrl">
                  <div className="xctrl__label">
                    <span>Concurrent downloads</span>
                    <span className="xctrl__val">{draft.max_concurrent_downloads}</span>
                  </div>
                  <input
                    className="xrange"
                    type="range"
                    min={1}
                    max={10}
                    value={draft.max_concurrent_downloads}
                    onChange={(e) => set({ max_concurrent_downloads: Number(e.target.value) })}
                  />
                  <span className="xctrl__hint">How many titles pull at once.</span>
                </div>

                <div className="xctrl">
                  <div className="xctrl__label">
                    <span>Chunks per download</span>
                    <span className="xctrl__val">{draft.download_chunks}</span>
                  </div>
                  <input
                    className="xrange"
                    type="range"
                    min={1}
                    max={16}
                    value={draft.download_chunks}
                    onChange={(e) => set({ download_chunks: Number(e.target.value) })}
                  />
                  <span className="xctrl__hint">Parallel segments per file — IDM-style.</span>
                </div>

                <div className="xctrl">
                  <div className="xctrl__label">
                    <span>Max retries</span>
                    <span className="xctrl__val">{draft.max_retries}</span>
                  </div>
                  <input
                    className="xrange"
                    type="range"
                    min={0}
                    max={5}
                    value={draft.max_retries}
                    onChange={(e) => set({ max_retries: Number(e.target.value) })}
                  />
                  <span className="xctrl__hint">Auto-retry on a failed segment.</span>
                </div>

                <div className="xctrl">
                  <div className="xctrl__label">
                    <span>Speed limit</span>
                  </div>
                  <div className="xseg">
                    {SPEED_PRESETS.map(([v, l]) => (
                      <button
                        key={v}
                        className={draft.speed_limit_bps === v ? "is-on" : ""}
                        onClick={() => set({ speed_limit_bps: v })}
                      >
                        {l}
                      </button>
                    ))}
                    {customSpeed && <button className="is-on">{formatBytes(draft.speed_limit_bps)}/s</button>}
                  </div>
                  <span className="xctrl__hint">Cap total bandwidth.</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <Button
                  variant="primary"
                  disabled={!dirty || saveSettingsMutation.isPending}
                  icon={<Check size={18} />}
                  onClick={() => draft && saveSettingsMutation.mutate(draft)}
                >
                  {saveSettingsMutation.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
                </Button>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Loading engine settings…</p>
          )}
        </div>
      </section>

      {showModal && <PlaylistModal existing={editPlaylist} onClose={() => setShowModal(false)} onSaved={refetchPlaylists} />}
    </div>
  );
}
