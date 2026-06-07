import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit,
  Folder,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Trash2,
  Tv,
} from "lucide-react";
import { downloadsApi, playlistsApi, seriesApi, vodApi, type Playlist, type Series, type VodStream } from "../api/client";
import { useAppStore } from "../store";
import { Badge, Button, Input, Modal, SectionHead, StatCard, TONE_BG, toneFg, toneFor } from "../components/ds";
import { usePlaylists } from "../components/Layout/TopNav";

interface PlaylistFormData {
  name: string;
  base_url: string;
  username: string;
  password: string;
}

export function PlaylistModal({
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

  const set = (k: keyof PlaylistFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.name.trim() && form.base_url.trim() && form.username.trim() && (existing || form.password);

  const handleSubmit = async () => {
    if (!valid) return;
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
    <Modal
      eyebrow={existing ? "Edit source" : "New source"}
      title={existing ? "Edit Playlist" : "Add Playlist"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || loading} onClick={handleSubmit}>
            {loading ? "Saving…" : existing ? "Save changes" : "Add playlist"}
          </Button>
        </>
      }
    >
      <Input label="Playlist name" placeholder="Main Provider" value={form.name} onChange={set("name")} />
      <Input
        label="Server URL"
        placeholder="http://line.provider.tv:8080"
        value={form.base_url}
        onChange={set("base_url")}
        icon={<LinkIcon size={18} />}
        hint="Xtream Codes base URL — host and port."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Input label="Username" placeholder="username" value={form.username} onChange={set("username")} />
        <Input
          label={existing ? "Password (blank = keep)" : "Password"}
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={set("password")}
        />
      </div>
      {error && <p className="xmodal__err">{error}</p>}
    </Modal>
  );
}

function fmtAgo(date: string | null): string {
  if (!date) return "never";
  const min = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function LatestPanel({
  title,
  items,
  to,
}: {
  title: string;
  items: { id: string; name: string; image: string | null; sub: string }[];
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="xcard xcard--pad">
      <SectionHead title={title} more="See all" onMore={() => navigate(to)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((m) => {
          const tone = toneFor(m.name);
          return (
            <div key={m.id} className="xmini" onClick={() => navigate(to)}>
              <div className="xmini__thumb" style={{ background: TONE_BG[tone] }}>
                {m.image ? (
                  <img src={m.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <span style={{ color: toneFg(tone) }}>{m.name.split(" ")[0]}</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="xmini__name">{m.name}</div>
                <div className="xmini__sub">{m.sub}</div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-tertiary)", flex: "none" }} />
            </div>
          );
        })}
        {items.length === 0 && (
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, padding: "10px 9px", margin: 0 }}>
            Nothing here yet. Go find something worth the bandwidth.
          </p>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { setActivePlaylistId, activePlaylistId } = useAppStore();

  const { data: playlists = [], refetch } = usePlaylists();

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

  const qc = useQueryClient();
  const counts = {
    downloading: downloads.filter((d) => d.status === "downloading").length,
    completed: downloads.filter((d) => d.status === "completed").length,
    failed: downloads.filter((d) => d.status === "failed").length,
  };

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
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  return (
    <div className="xcontent">
      {/* hero */}
      <div className="xherocard xrise" style={{ marginTop: 24 }}>
        <div className="xherocard__inner">
          <span className="xherocard__eyebrow">Self-hosted · Xtream Codes API</span>
          <h1 className="xherocard__title">
            Stream it raw.
            <br />
            <em>Download it all.</em>
          </h1>
          <p className="xherocard__tag">
            Browse every Xtream Codes playlist, watch straight in your browser, and run an IDM-grade download queue
            that never buffers.
          </p>
          <div className="xherocard__actions">
            <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => { setEditing(null); setShowModal(true); }}>
              Add Playlist
            </Button>
            <Button variant="outline" size="lg" icon={<Tv size={18} />} onClick={() => navigate("/live")}>
              Browse Live TV
            </Button>
            <span className="xherocard__count">
              <Folder size={14} />
              <b>{playlists.length}</b> playlists connected
            </span>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="xstats" style={{ marginTop: 20 }}>
        <StatCard icon={<Folder />} tone="volt" num={playlists.length} label="Playlists" />
        <StatCard icon={<Download />} tone="surge" num={counts.downloading} label="Downloading" />
        <StatCard icon={<CheckCircle2 />} tone="pos" num={counts.completed} label="Completed" />
        <StatCard icon={<AlertTriangle />} tone="neg" num={counts.failed} label="Failed" />
      </div>

      {/* playlists */}
      <section className="xsec">
        <SectionHead title="Your Playlists" more="Manage in settings" onMore={() => navigate("/settings")} />
        <div className="xcard xpl" style={{ padding: 8 }}>
          {playlists.map((p) => (
            <div
              key={p.id}
              className={"xpl__row" + (p.id === activePlaylistId ? " is-active" : "")}
              onClick={() => setActivePlaylistId(p.id)}
            >
              <span className="xpl__dot" />
              <div style={{ minWidth: 0 }}>
                <div className="xpl__name">
                  {p.name}
                  {p.id === activePlaylistId ? <Badge variant="top">Active</Badge> : null}
                  {p.sync_status === "error" ? (
                    <Badge variant="soft" style={{ color: "var(--neg-500)" }}>
                      Sync failed
                    </Badge>
                  ) : null}
                </div>
                <div className="xpl__url">
                  {p.base_url} · {p.username}
                </div>
              </div>
              <div className="xpl__meta" onClick={(e) => e.stopPropagation()}>
                <span className="xpl__sync">
                  {p.sync_status === "syncing" ? "Syncing…" : "Synced " + fmtAgo(p.last_synced_at)}
                </span>
                <button
                  className={"xrowbtn" + (p.sync_status === "syncing" ? " is-spinning" : "")}
                  onClick={() => handleSync(p.id)}
                  disabled={p.sync_status === "syncing"}
                  aria-label={`Sync playlist ${p.name}`}
                >
                  <RefreshCw />
                </button>
                <button
                  className="xrowbtn"
                  onClick={() => {
                    setEditing(p);
                    setShowModal(true);
                  }}
                  aria-label={`Edit playlist ${p.name}`}
                >
                  <Edit />
                </button>
                <button
                  className="xrowbtn xrowbtn--danger"
                  onClick={() => handleDelete(p.id, p.name)}
                  aria-label={`Delete playlist ${p.name}`}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
          {playlists.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 14.5 }}>
              No playlists yet. Add one to get started.
            </div>
          )}
        </div>
      </section>

      {/* latest media */}
      <div className="xgrid2" style={{ marginTop: 38 }}>
        <LatestPanel
          title="Latest Movies"
          to="/movies"
          items={latestMovies.map((m: VodStream) => ({
            id: m.stream_id,
            name: m.name,
            image: m.icon,
            sub: (m.genre || "No genre yet").toUpperCase(),
          }))}
        />
        <LatestPanel
          title="Latest Series"
          to="/series"
          items={latestSeries.map((s: Series) => ({
            id: s.series_id,
            name: s.name,
            image: s.cover,
            sub: s.last_modified
              ? `UPDATED ${new Date(Number(s.last_modified) * 1000).toLocaleDateString()}${s.genre ? " · " + s.genre.toUpperCase() : ""}`
              : (s.genre || "—").toUpperCase(),
          }))}
        />
      </div>

      {/* analytics readiness */}
      <section className="xsec">
        <SectionHead title="Analytics Readiness" />
        <div className="xanalytics">
          <div className="xanalytics__viz" aria-hidden="true">
            {[40, 70, 52, 88, 64, 96, 78].map((h, i) => (
              <div key={i} className="xanalytics__bar" style={{ height: h + "%", opacity: 0.4 + i * 0.08 }} />
            ))}
          </div>
          <div className="xanalytics__body">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge variant="new">Coming soon</Badge>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                Playback history
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: 22,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Your watch data, visualized.
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, margin: 0, maxWidth: 520, textWrap: "pretty" }}>
              Playback-history tracking is on the roadmap — top genres, peak streaming hours, codec breakdowns, and
              which playlists pull their weight. Hang tight.
            </p>
          </div>
          <Link
            to="/downloads"
            className="xsec__more"
            style={{ alignSelf: "center", flex: "none" }}
          >
            Open downloads
            <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {showModal && <PlaylistModal existing={editing} onClose={() => setShowModal(false)} onSaved={refetch} />}
    </div>
  );
}
