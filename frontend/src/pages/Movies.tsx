import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, ExternalLink, Film, Heart, Play, Search, Star, X } from "lucide-react";
import { vodApi, favoritesApi, type VodStream } from "../api/client";
import { useAppStore } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { ContentCard } from "../components/ContentGrid/ContentCard";

const LANGUAGES = ["", "Arabic", "English", "Turkish", "French", "Spanish"];

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

const DASH = "—";
const fb = <T,>(v: T | null | undefined, fmt?: (v: T) => string | null): string =>
  v === null || v === undefined || v === "" ? DASH : (fmt ? (fmt(v) ?? DASH) : String(v));

function VodInfoModal({
  stream,
  playlistId,
  onClose,
}: {
  stream: VodStream;
  playlistId: number;
  onClose: () => void;
}) {
  const { openQueue } = useAppStore();
  const qc = useQueryClient();
  const [language, setLanguage] = useState("English");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const { data: fullStream } = useQuery({
    queryKey: ["vod-detail", playlistId, stream.stream_id],
    queryFn: () => vodApi.get(playlistId, stream.stream_id),
    initialData: stream,
  });

  const detail = fullStream ?? stream;
  const posterSrc = detail.movie_image || detail.icon;
  const backdropSrc = detail.backdrop || detail.movie_image || detail.icon;
  const imdbUrl = detail.imdb_id ? `https://www.imdb.com/title/${detail.imdb_id}` : null;
  const tmdbUrl = detail.tmdb_id ? `https://www.themoviedb.org/movie/${detail.tmdb_id}` : null;
  const trailerUrl = detail.youtube_trailer ? `https://www.youtube.com/watch?v=${detail.youtube_trailer}` : null;
  const resolution = detail.video_width && detail.video_height
    ? `${detail.video_width} × ${detail.video_height}`
    : null;

  const overviewFacts: { label: string; value: string }[] = [
    { label: "Release", value: fb(detail.release_date, formatReleaseDate) },
    { label: "Runtime", value: fb(detail.duration) },
    { label: "Duration (s)", value: fb(detail.duration_secs, (v) => v.toLocaleString()) },
    { label: "Language", value: fb(detail.language) },
    { label: "Genre", value: fb(detail.genre) },
    { label: "Rating", value: fb(detail.rating, (v) => v.toFixed(1)) },
    { label: "Rating /5", value: fb(detail.rating_5based, (v) => v.toFixed(1)) },
    { label: "Added", value: fb(detail.added, (v) => formatAdded(v)) },
    { label: "Format", value: fb(detail.container_extension, (v) => v.toUpperCase()) },
    { label: "Overall bitrate", value: fb(detail.bitrate, formatBitrate) },
  ];

  const videoFacts: { label: string; value: string }[] = [
    { label: "Resolution", value: fb(resolution) },
    { label: "Codec", value: fb(detail.video_codec, (v) => v.toUpperCase()) },
    { label: "Codec (long)", value: fb(detail.video_codec_long) },
    { label: "Profile", value: fb(detail.video_profile) },
    { label: "Level", value: fb(detail.video_level) },
    { label: "Aspect ratio", value: fb(detail.video_aspect_ratio) },
    { label: "Pixel format", value: fb(detail.video_pix_fmt) },
    { label: "Frame rate", value: fb(detail.video_frame_rate, formatFrameRate) },
    { label: "Field order", value: fb(detail.video_field_order) },
    { label: "Bit depth", value: fb(detail.video_bits_per_raw_sample) },
  ];

  const audioFacts: { label: string; value: string }[] = [
    { label: "Codec", value: fb(detail.audio_codec, (v) => v.toUpperCase()) },
    { label: "Codec (long)", value: fb(detail.audio_codec_long) },
    { label: "Profile", value: fb(detail.audio_profile) },
    { label: "Channel layout", value: fb(detail.audio_channels) },
    { label: "Channels", value: fb(detail.audio_channel_count) },
    { label: "Sample rate", value: fb(detail.audio_sample_rate, formatSampleRate) },
    { label: "Language", value: fb(detail.audio_language) },
    { label: "Bitrate", value: fb(detail.audio_bitrate, formatBps) },
  ];

  const idFacts: { label: string; value: string }[] = [
    { label: "IMDb", value: fb(detail.imdb_id) },
    { label: "TMDB", value: fb(detail.tmdb_id) },
    { label: "Stream ID", value: fb(detail.stream_id) },
    { label: "Category", value: fb(detail.category_id) },
  ];

  const handleWatch = async () => {
    setWatching(true);
    setWatchError(null);
    try {
      const { url, stream_type } = await vodApi.watch(playlistId, stream.stream_id);
      const fallbackUrl = detail.container_extension && url.endsWith(".m3u8")
        ? url.replace(/\.m3u8(?:\?.*)?$/, `.${detail.container_extension}`)
        : undefined;
      openQueue([{ url, title: stream.name, type: stream_type === "hls" ? "hls" : "mp4", fallbackUrl }], 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load stream";
      setWatchError(msg);
    } finally {
      setWatching(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await vodApi.download(playlistId, stream.stream_id, language);
      setDownloaded(true);
      qc.invalidateQueries({ queryKey: ["downloads"] });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-4xl mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        {backdropSrc && (
          <div className="relative h-52 overflow-hidden rounded-t-[1.5rem] sm:h-64">
            <img
              src={backdropSrc}
              alt={detail.name}
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,12,18,0.96)] via-[rgba(8,12,18,0.48)] to-[rgba(8,12,18,0.12)]" />
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            {posterSrc && (
              <img
                src={posterSrc}
                alt={detail.name}
                className="h-52 w-36 rounded-2xl object-cover flex-shrink-0 shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="page-hero__eyebrow">VOD Details</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">{detail.name}</h2>
                </div>
                <button onClick={onClose} className="text-white/50 hover:text-white flex-shrink-0">
                  <X size={20} />
                </button>
              </div>

              {detail.release_date && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <CalendarDays size={12} />
                  {formatReleaseDate(detail.release_date)}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
              {detail.rating != null && detail.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm text-white/70">{detail.rating.toFixed(1)}</span>
                </div>
              )}
              {detail.genre && <span className="badge badge-purple">{detail.genre}</span>}
              {detail.language && <span className="badge badge-gray">{detail.language}</span>}
              {detail.duration && <span className="text-xs text-white/40">{detail.duration}</span>}
              </div>

              <p className="text-xs text-white/50 mt-3">
                <span className="text-white/30">Director:</span> {fb(detail.director)}
              </p>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                <span className="text-white/30">Cast:</span> {fb(detail.cast)}
              </p>
              <p className="text-sm text-white/60 mt-4 leading-relaxed">
                {detail.plot || <span className="text-white/30">No plot available.</span>}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {trailerUrl && (
                  <a
                    href={trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200"
                  >
                    <ExternalLink size={14} />
                    Watch trailer
                  </a>
                )}
                {imdbUrl && (
                  <a
                    href={imdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200"
                  >
                    <ExternalLink size={14} />
                    Open IMDb entry
                  </a>
                )}
                {tmdbUrl && (
                  <a
                    href={tmdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200"
                  >
                    <ExternalLink size={14} />
                    Open TMDB entry
                  </a>
                )}
              </div>

              {watchError && (
                <p className="text-xs text-red-400 mt-3">{watchError}</p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleWatch}
                  disabled={watching}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg btn-accent text-sm font-medium disabled:opacity-60"
                >
                  {watching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Play size={14} fill="white" />
                  )}
                  {watching ? "Loading…" : "Watch"}
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="glass-input text-sm py-1.5"
                  >
                    {LANGUAGES.filter(Boolean).map((l) => (
                      <option key={l} value={l} className="bg-gray-900">{l}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleDownload}
                    disabled={downloading || downloaded}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Download size={14} />
                    {downloaded ? "Queued!" : downloading ? "..." : "Download"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <FactSection title="Overview" facts={overviewFacts} />
          <FactSection title="Video" facts={videoFacts} />
          <FactSection title="Audio" facts={audioFacts} />
          <FactSection title="Identifiers" facts={idFacts} />

          {detail.backdrop_path && detail.backdrop_path.length > 0 && (
            <div className="mt-6">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/45">
                Backdrops
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {detail.backdrop_path.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`backdrop ${i + 1}`}
                    className="h-28 flex-shrink-0 rounded-xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FactSection({ title, facts }: { title: string; facts: { label: string; value: string }[] }) {
  return (
    <div className="mt-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/45">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/35">
              {fact.label}
            </p>
            <p className="mt-1 text-sm text-white/80 break-words">{fact.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Movies() {
  const { activePlaylistId } = useAppStore();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [genre, setGenre] = useState("");
  const [ratingMin, setRatingMin] = useState<number | undefined>();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedStream, setSelectedStream] = useState<VodStream | null>(null);
  const [page, setPage] = useState(0);
  const limit = 60;

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
    queryKey: ["vod-streams", activePlaylistId, selectedCategory, search, language, genre, ratingMin, page],
    queryFn: () =>
      vodApi.streams(activePlaylistId!, {
        category_id: selectedCategory === "__latest__" ? undefined : selectedCategory || undefined,
        latest: selectedCategory === "__latest__",
        search: search || undefined,
        language: language || undefined,
        genre: genre || undefined,
        rating_min: ratingMin,
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

  const displayedStreams = favoritesOnly
    ? streams.filter((s) => favoritedIds.has(s.stream_id))
    : streams;

  const handleToggleFavorite = async (stream: VodStream) => {
    if (!activePlaylistId) return;
    if (favoritedIds.has(stream.stream_id)) {
      await favoritesApi.remove({ playlist_id: activePlaylistId, content_type: "vod", item_id: stream.stream_id });
    } else {
      await favoritesApi.add({ playlist_id: activePlaylistId, content_type: "vod", item_id: stream.stream_id });
    }
    qc.invalidateQueries({ queryKey: ["favorites", activePlaylistId, "vod"] });
  };

  if (!activePlaylistId) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <div className="text-center">
          <Film size={48} className="mx-auto mb-3 opacity-30" />
          <p>Select a playlist from the dashboard first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
      <CategorySidebar categories={movieCategories} selected={selectedCategory} onSelect={(id) => { setSelectedCategory(id); setPage(0); }} />

      <div className="mt-5 flex min-w-0 flex-col lg:mt-0">
        <section className="glass-card page-hero">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="page-hero__eyebrow">Movies</p>
              <h1 className="page-hero__title">Elegant browsing for long movie nights.</h1>
              <p className="page-hero__body">
                Search, preview, favorite, and queue downloads with a calmer layout that works equally well on desktop and in your hand.
              </p>
            </div>
            <div className="page-actions">
              <span className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/55">
                {displayedStreams.length} titles
              </span>
            </div>
          </div>
        </section>

        <div className="mb-4 mt-5 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="w-full glass-input pl-11 text-sm"
              placeholder="Search movies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select
            className="glass-input text-sm"
            value={language}
            onChange={(e) => { setLanguage(e.target.value); setPage(0); }}
          >
            <option value="">All languages</option>
            {LANGUAGES.filter(Boolean).map((l) => (
              <option key={l} value={l} className="bg-gray-900">{l}</option>
            ))}
          </select>
          <input
            type="text"
            className="glass-input text-sm w-36"
            placeholder="Genre..."
            value={genre}
            onChange={(e) => { setGenre(e.target.value); setPage(0); }}
          />
          <select
            className="glass-input text-sm"
            value={ratingMin || ""}
            onChange={(e) => { setRatingMin(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
          >
            <option value="">Any rating</option>
            <option value="5">5+</option>
            <option value="6">6+</option>
            <option value="7">7+</option>
            <option value="8">8+</option>
          </select>

          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            title="Show favorites only"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              favoritesOnly
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "glass-input text-white/50 hover:text-white"
            }`}
          >
            <Heart size={13} fill={favoritesOnly ? "currentColor" : "none"} />
            Favorites
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                {displayedStreams.map((stream) => (
                  <ContentCard
                    key={stream.stream_id}
                    title={stream.name}
                    subtitle={stream.genre || undefined}
                    image={stream.icon}
                    rating={stream.rating}
                    badge={stream.language || undefined}
                    isFavorited={favoritedIds.has(stream.stream_id)}
                    onFavorite={() => handleToggleFavorite(stream)}
                    onClick={() => setSelectedStream(stream)}
                    onPlay={async () => {
                      try {
                        const { url, stream_type } = await vodApi.watch(activePlaylistId, stream.stream_id);
                        const fallbackUrl = stream.container_extension && url.endsWith(".m3u8")
                          ? url.replace(/\.m3u8(?:\?.*)?$/, `.${stream.container_extension}`)
                          : undefined;
                        const store = useAppStore.getState();
                        store.openQueue([{ url, title: stream.name, type: stream_type === "hls" ? "hls" : "mp4", fallbackUrl }], 0);
                      } catch {
                        setSelectedStream(stream);
                      }
                    }}
                  />
                ))}
                {displayedStreams.length === 0 && (
                  <div className="glass-card col-span-full flex items-center justify-center py-20 text-white/30">
                    <div className="text-center">
                      <Film size={40} className="mx-auto mb-2 opacity-40" />
                      <p>{favoritesOnly ? "No favorites yet" : "No movies found"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {!favoritesOnly && (streams.length === limit || page > 0) && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-sm text-white/40">Page {page + 1}</span>
                <button
                  disabled={streams.length < limit}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedStream && (
        <VodInfoModal
          stream={selectedStream}
          playlistId={activePlaylistId}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </div>
  );
}
