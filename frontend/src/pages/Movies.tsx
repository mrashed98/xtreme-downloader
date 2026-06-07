import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Film,
  Heart,
  Play,
  Star,
  X,
} from "lucide-react";
import { vodApi, favoritesApi, type VodStream } from "../api/client";
import { useAppStore } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { PosterTile } from "../components/ContentGrid/PosterTile";
import {
  Badge,
  Button,
  CodecTag,
  EmptyState,
  IconButton,
  Loading,
  SearchInput,
  Select,
  TONE_BG,
  toneFg,
  toneFor,
} from "../components/ds";

export const LANGUAGES = ["Arabic", "English", "Turkish", "French", "Spanish"];

/* ---------------- formatters ---------------- */
const DASH = "—";
const fb = <T,>(v: T | null | undefined, fmt?: (v: T) => string | null): string =>
  v === null || v === undefined || v === "" ? DASH : fmt ? fmt(v) ?? DASH : String(v);

function formatAdded(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed * 1000).toLocaleDateString();
}

function formatReleaseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatBitrate(value?: number | null) {
  if (!value) return null;
  return `${value.toLocaleString()} kb/s`;
}

function formatBps(value?: string | null) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} Mbps`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} kbps`;
  return `${n} bps`;
}

function formatFrameRate(value?: string | null) {
  if (!value) return null;
  if (value.includes("/")) {
    const [a, b] = value.split("/").map(Number);
    if (b) return `${(a / b).toFixed(2)} fps`;
  }
  return value;
}

function formatSampleRate(value?: string | null) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  return `${(n / 1000).toFixed(1)} kHz`;
}

/** Codec chips from real stream metadata — the Xtreme Codecs API signature. */
export function buildCodecs(d: VodStream): string[] {
  const out: string[] = [];
  if (d.video_height) out.push(d.video_height >= 2000 ? "4K" : `${d.video_height}P`);
  if (d.video_codec) out.push(d.video_codec.toUpperCase());
  if (d.audio_codec) out.push(d.audio_codec.toUpperCase());
  if (d.container_extension) out.push(d.container_extension.toUpperCase());
  return out.slice(0, 4);
}

/* ---------------- language-select download control ---------------- */
export function DownloadCtl({
  language,
  onLanguage,
  onDownload,
  state,
  label = "Download",
}: {
  language: string;
  onLanguage: (l: string) => void;
  onDownload: () => void;
  state: "idle" | "busy" | "done";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xlangsel">
      <Button
        variant="primary"
        icon={<Download size={18} />}
        disabled={state !== "idle"}
        onClick={onDownload}
      >
        {state === "done" ? "Queued!" : state === "busy" ? "Queuing…" : label}
      </Button>
      <button className="xlinkbtn" style={{ height: 46, paddingRight: 12 }} onClick={() => setOpen((o) => !o)}>
        {language}
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="xlangsel__pop" style={{ left: "auto", right: 0 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l}
              className={"xlangsel__opt" + (l === language ? " is-on" : "")}
              onClick={() => {
                onLanguage(l);
                setOpen(false);
              }}
            >
              {l === language ? <Check /> : <span style={{ width: 15 }} />}
              {l}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Fact({ h, rows }: { h: string; rows: [string, string][] }) {
  return (
    <div className="xfact">
      <div className="xfact__h">{h}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="xfact__row">
          <span className="k">{k}</span>
          <span className="v">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- VOD detail modal ---------------- */
function VodInfoModal({
  stream,
  playlistId,
  isFavorited,
  onToggleFavorite,
  onClose,
}: {
  stream: VodStream;
  playlistId: number;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const { openQueue } = useAppStore();
  const qc = useQueryClient();
  const [language, setLanguage] = useState("English");
  const [dlState, setDlState] = useState<"idle" | "busy" | "done">("idle");
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  const { data: fullStream } = useQuery({
    queryKey: ["vod-detail", playlistId, stream.stream_id],
    queryFn: () => vodApi.get(playlistId, stream.stream_id),
    initialData: stream,
  });

  const detail = fullStream ?? stream;
  const tone = toneFor(detail.name);
  const posterSrc = detail.movie_image || detail.icon;
  const backdropSrc = detail.backdrop || detail.movie_image || detail.icon;
  const imdbUrl = detail.imdb_id ? `https://www.imdb.com/title/${detail.imdb_id}` : null;
  const tmdbUrl = detail.tmdb_id ? `https://www.themoviedb.org/movie/${detail.tmdb_id}` : null;
  const trailerUrl = detail.youtube_trailer ? `https://www.youtube.com/watch?v=${detail.youtube_trailer}` : null;
  const resolution =
    detail.video_width && detail.video_height ? `${detail.video_width} × ${detail.video_height}` : null;
  const codecs = buildCodecs(detail);

  const handleWatch = async () => {
    setWatching(true);
    setWatchError(null);
    try {
      const { url, stream_type } = await vodApi.watch(playlistId, stream.stream_id);
      const fallbackUrl =
        detail.container_extension && url.endsWith(".m3u8")
          ? url.replace(/\.m3u8(?:\?.*)?$/, `.${detail.container_extension}`)
          : undefined;
      openQueue([{ url, title: stream.name, type: stream_type === "hls" ? "hls" : "mp4", fallbackUrl }], 0);
    } catch (e: unknown) {
      setWatchError(e instanceof Error ? e.message : "Failed to load stream");
    } finally {
      setWatching(false);
    }
  };

  const handleDownload = async () => {
    setDlState("busy");
    try {
      await vodApi.download(playlistId, stream.stream_id, language);
      setDlState("done");
      qc.invalidateQueries({ queryKey: ["downloads"] });
    } catch {
      setDlState("idle");
    }
  };

  return (
    <div className="xoverlay" onClick={onClose}>
      <div className="xmodal xmodal--detail" onClick={(e) => e.stopPropagation()}>
        <div
          className="xvod__hero"
          style={
            backdropSrc
              ? { backgroundImage: `url(${backdropSrc})` }
              : { background: `radial-gradient(120% 130% at 78% 12%, ${TONE_BG[tone]}, var(--ink-1000) 64%)` }
          }
        >
          <div className="xvod__heroscrim" />
          <button className="xmodal__close xvod__heroclose" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
          <div className="xvod__herobody">
            <div className="xvod__poster" style={{ background: posterSrc ? undefined : TONE_BG[tone] }}>
              {posterSrc ? (
                <img src={posterSrc} alt={detail.name} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : (
                <span style={{ color: toneFg(tone) }}>{detail.name}</span>
              )}
            </div>
            <div className="xvod__headmeta">
              <span className="xmodal__eyebrow">Movie · Xtream Codes API</span>
              <h2 className="xvod__title">{detail.name}</h2>
              <div className="xvod__badges">
                {detail.rating != null && detail.rating > 0 && (
                  <span className="xrating">
                    <Star fill="currentColor" stroke="none" />
                    {detail.rating.toFixed(1)}
                  </span>
                )}
                {detail.release_date && <span className="meta">{formatReleaseDate(detail.release_date)}</span>}
                {detail.genre && (
                  <>
                    <span className="sep">·</span>
                    <span className="meta">{detail.genre}</span>
                  </>
                )}
                {detail.duration && (
                  <>
                    <span className="sep">·</span>
                    <span className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      {detail.duration}
                    </span>
                  </>
                )}
                {detail.language && <Badge variant="soft">{detail.language}</Badge>}
              </div>
              {codecs.length > 0 && <CodecTag items={codecs} variant="accent" />}
            </div>
          </div>
        </div>

        <div className="xvod__body">
          <div className="xvod__actions">
            <Button
              variant="primary"
              size="lg"
              icon={watching ? undefined : <Play size={18} fill="currentColor" stroke="none" />}
              disabled={watching}
              onClick={handleWatch}
            >
              {watching ? "Loading…" : "Play"}
            </Button>
            <DownloadCtl language={language} onLanguage={setLanguage} onDownload={handleDownload} state={dlState} />
            <IconButton
              variant="glass"
              size="lg"
              label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              onClick={onToggleFavorite}
              style={isFavorited ? { color: "var(--hot-500)" } : undefined}
            >
              <Heart size={22} fill={isFavorited ? "currentColor" : "none"} />
            </IconButton>
            <div className="xvod__links">
              {trailerUrl && (
                <a className="xlinkbtn" href={trailerUrl} target="_blank" rel="noreferrer">
                  <Play />
                  Trailer
                </a>
              )}
              {imdbUrl && (
                <a className="xlinkbtn" href={imdbUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  IMDb
                </a>
              )}
              {tmdbUrl && (
                <a className="xlinkbtn" href={tmdbUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  TMDB
                </a>
              )}
            </div>
          </div>

          {watchError && <p className="xmodal__err" style={{ marginBottom: 16 }}>{watchError}</p>}

          <p className="xvod__plot">{detail.plot || "No plot available."}</p>

          <div className="xvod__credits">
            <div className="xvod__credit">
              <span className="k">Director</span>
              <span className="v">{fb(detail.director)}</span>
            </div>
            <div className="xvod__credit">
              <span className="k">Cast</span>
              <span className="v">{fb(detail.cast)}</span>
            </div>
          </div>

          <div className="xfactgrid">
            <Fact
              h="Overview"
              rows={[
                ["Release", fb(detail.release_date, formatReleaseDate)],
                ["Runtime", fb(detail.duration)],
                ["Genre", fb(detail.genre)],
                ["Rating", fb(detail.rating, (v) => v.toFixed(1))],
                ["Added", fb(detail.added, formatAdded)],
                ["Bitrate", fb(detail.bitrate, formatBitrate)],
              ]}
            />
            <Fact
              h="Video"
              rows={[
                ["Codec", fb(detail.video_codec, (v) => v.toUpperCase())],
                ["Resolution", fb(resolution)],
                ["FPS", fb(detail.video_frame_rate, formatFrameRate)],
                ["Profile", fb(detail.video_profile)],
                ["Aspect", fb(detail.video_aspect_ratio)],
                ["Bit depth", fb(detail.video_bits_per_raw_sample)],
              ]}
            />
            <Fact
              h="Audio"
              rows={[
                ["Codec", fb(detail.audio_codec, (v) => v.toUpperCase())],
                ["Channels", fb(detail.audio_channels)],
                ["Bitrate", fb(detail.audio_bitrate, formatBps)],
                ["Sample rate", fb(detail.audio_sample_rate, formatSampleRate)],
                ["Lang", fb(detail.audio_language)],
                ["Profile", fb(detail.audio_profile)],
              ]}
            />
            <Fact
              h="Identifiers"
              rows={[
                ["IMDb", fb(detail.imdb_id)],
                ["TMDB", fb(detail.tmdb_id)],
                ["Stream ID", fb(detail.stream_id)],
                ["Category", fb(detail.category_id)],
                ["Format", fb(detail.container_extension, (v) => v.toUpperCase())],
              ]}
            />
          </div>

          {detail.backdrop_path && detail.backdrop_path.length > 0 && (
            <div className="xgallery">
              {detail.backdrop_path.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`backdrop ${i + 1}`}
                  className="xgallery__item"
                  loading="lazy"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Movies page ---------------- */
const RATINGS: [string, string][] = [
  ["0", "Any rating"],
  ["5", "5+"],
  ["6", "6+"],
  ["7", "7+"],
  ["8", "8+"],
];

export function Movies() {
  const { activePlaylistId, showAdult } = useAppStore();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>("__latest__");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [genre, setGenre] = useState("");
  const [ratingMin, setRatingMin] = useState("0");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedStream, setSelectedStream] = useState<VodStream | null>(null);
  const [page, setPage] = useState(0);
  const limit = 60;

  const resetPage = () => setPage(0);

  const { data: categories = [] } = useQuery({
    queryKey: ["vod-cats", activePlaylistId],
    queryFn: () => vodApi.categories(activePlaylistId!),
    enabled: !!activePlaylistId,
  });

  const movieCategories = [
    {
      id: -1,
      playlist_id: activePlaylistId ?? 0,
      type: "vod",
      category_id: "__latest__",
      name: "Latest 50",
    },
    ...categories,
  ];

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ["vod-streams", activePlaylistId, selectedCategory, search, language, genre, ratingMin, showAdult, page],
    queryFn: () =>
      vodApi.streams(activePlaylistId!, {
        category_id: selectedCategory === "__latest__" ? undefined : selectedCategory || undefined,
        latest: selectedCategory === "__latest__",
        search: search || undefined,
        language: language === "all" ? undefined : language,
        genre: genre || undefined,
        rating_min: ratingMin === "0" ? undefined : Number(ratingMin),
        include_adult: showAdult || undefined,
        limit,
        offset: page * limit,
      }),
    enabled: !!activePlaylistId,
    staleTime: 60_000,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", activePlaylistId, "vod"],
    queryFn: () => favoritesApi.list(activePlaylistId!, "vod"),
    enabled: !!activePlaylistId,
  });

  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.item_id)), [favorites]);

  const displayedStreams = favoritesOnly ? streams.filter((s) => favoritedIds.has(s.stream_id)) : streams;

  const handleToggleFavorite = async (stream: VodStream) => {
    if (!activePlaylistId) return;
    if (favoritedIds.has(stream.stream_id)) {
      await favoritesApi.remove({ playlist_id: activePlaylistId, content_type: "vod", item_id: stream.stream_id });
    } else {
      await favoritesApi.add({ playlist_id: activePlaylistId, content_type: "vod", item_id: stream.stream_id });
    }
    qc.invalidateQueries({ queryKey: ["favorites", activePlaylistId, "vod"] });
  };

  const handlePlay = async (stream: VodStream) => {
    if (!activePlaylistId) return;
    try {
      const { url, stream_type } = await vodApi.watch(activePlaylistId, stream.stream_id);
      const fallbackUrl =
        stream.container_extension && url.endsWith(".m3u8")
          ? url.replace(/\.m3u8(?:\?.*)?$/, `.${stream.container_extension}`)
          : undefined;
      useAppStore
        .getState()
        .openQueue([{ url, title: stream.name, type: stream_type === "hls" ? "hls" : "mp4", fallbackUrl }], 0);
    } catch {
      setSelectedStream(stream);
    }
  };

  if (!activePlaylistId) {
    return (
      <div className="xcontent">
        <EmptyState icon={<Film />} title="Select a playlist first" sub="Set an active playlist to browse the VOD library." />
      </div>
    );
  }

  return (
    <div className="xcontent">
      <div className="xpagehead">
        <div className="xpagehead__eyebrow">Video on demand · Xtream Codes</div>
        <h1 className="xpagehead__title">Movies</h1>
      </div>
      <div className="xbrowse">
        <CategorySidebar
          categories={movieCategories}
          selected={selectedCategory}
          onSelect={(id) => {
            setSelectedCategory(id);
            resetPage();
          }}
          allLabel="All Movies"
        />
        <div className="xbrowse__main">
          <div className="xfilter">
            <div className="xfilter__search">
              <SearchInput
                placeholder="Search movies…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
              />
            </div>
            <Select
              value={language}
              onChange={(v) => {
                setLanguage(v);
                resetPage();
              }}
              options={[{ value: "all", label: "All languages" }, ...LANGUAGES]}
              ariaLabel="Language"
            />
            <input
              className="xinput xinput--pill"
              style={{ width: 140, height: 44 }}
              placeholder="Genre…"
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                resetPage();
              }}
            />
            <Select
              value={ratingMin}
              onChange={(v) => {
                setRatingMin(v);
                resetPage();
              }}
              options={RATINGS.map(([value, label]) => ({ value, label }))}
              ariaLabel="Minimum rating"
            />
            <button className={"xfav-toggle" + (favoritesOnly ? " is-on" : "")} onClick={() => setFavoritesOnly((v) => !v)}>
              <Heart fill={favoritesOnly ? "currentColor" : "none"} />
              Favorites
            </button>
          </div>

          {isLoading ? (
            <Loading />
          ) : displayedStreams.length === 0 ? (
            <EmptyState
              icon={<Film />}
              title={favoritesOnly ? "No favorites yet" : "No movies found"}
              sub="Nothing here yet. Go find something worth the bandwidth."
            />
          ) : (
            <>
              <div className="xposgrid">
                {displayedStreams.map((stream) => (
                  <PosterTile
                    key={stream.stream_id}
                    title={stream.name}
                    eyebrow={(stream.genre || stream.language || "").toUpperCase() || undefined}
                    image={stream.icon}
                    rating={stream.rating}
                    isFavorited={favoritedIds.has(stream.stream_id)}
                    onFavorite={() => handleToggleFavorite(stream)}
                    onOpen={() => setSelectedStream(stream)}
                    onPlay={() => handlePlay(stream)}
                  />
                ))}
              </div>

              {!favoritesOnly && (streams.length === limit || page > 0) && (
                <div className="xpager">
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    icon={<ChevronLeft size={16} />}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="xpager__info">Page {page + 1}</span>
                  <Button
                    variant="outline"
                    disabled={streams.length < limit}
                    iconRight={<ChevronRight size={16} />}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedStream && (
        <VodInfoModal
          stream={selectedStream}
          playlistId={activePlaylistId}
          isFavorited={favoritedIds.has(selectedStream.stream_id)}
          onToggleFavorite={() => handleToggleFavorite(selectedStream)}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </div>
  );
}
