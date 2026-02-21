import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Film, X, Play, Download, Star, Heart } from "lucide-react";
import { vodApi, favoritesApi, type VodStream } from "../api/client";
import { useAppStore } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { ContentCard } from "../components/ContentGrid/ContentCard";

const LANGUAGES = ["", "Arabic", "English", "Turkish", "French", "Spanish"];

function VodInfoModal({
  stream,
  playlistId,
  onClose,
}: {
  stream: VodStream;
  playlistId: number;
  onClose: () => void;
}) {
  const { openPlayer } = useAppStore();
  const qc = useQueryClient();
  const [language, setLanguage] = useState("English");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  const handleWatch = async () => {
    setWatching(true);
    setWatchError(null);
    try {
      const { url, stream_type } = await vodApi.watch(playlistId, stream.stream_id);
      openPlayer(url, stream.name, stream_type === "hls" ? "hls" : "mp4");
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
      <div className="glass-card w-full max-w-2xl mx-4 p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex gap-5">
          {stream.icon && (
            <img
              src={stream.icon}
              alt={stream.name}
              className="w-32 h-48 object-cover rounded-xl flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-white">{stream.name}</h2>
              <button onClick={onClose} className="text-white/50 hover:text-white flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {stream.rating != null && stream.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm text-white/70">{stream.rating.toFixed(1)}</span>
                </div>
              )}
              {stream.genre && <span className="badge badge-purple">{stream.genre}</span>}
              {stream.language && <span className="badge badge-gray">{stream.language}</span>}
              {stream.duration && <span className="text-xs text-white/40">{stream.duration}</span>}
            </div>

            {stream.director && (
              <p className="text-xs text-white/50 mt-2">
                <span className="text-white/30">Director:</span> {stream.director}
              </p>
            )}
            {stream.cast && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2">
                <span className="text-white/30">Cast:</span> {stream.cast}
              </p>
            )}
            {stream.plot && (
              <p className="text-sm text-white/60 mt-3 leading-relaxed line-clamp-4">{stream.plot}</p>
            )}

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
      </div>
    </div>
  );
}

export function Movies() {
  const { activePlaylistId, openPlayer } = useAppStore();
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

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ["vod-streams", activePlaylistId, selectedCategory, search, language, genre, ratingMin, page],
    queryFn: () =>
      vodApi.streams(activePlaylistId!, {
        category_id: selectedCategory || undefined,
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
    <div className="flex h-full gap-4 p-4">
      <CategorySidebar categories={categories} selected={selectedCategory} onSelect={(id) => { setSelectedCategory(id); setPage(0); }} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="w-full glass-input pl-9 text-sm"
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
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                        openPlayer(url, stream.name, stream_type === "hls" ? "hls" : "mp4");
                      } catch {
                        setSelectedStream(stream);
                      }
                    }}
                  />
                ))}
                {displayedStreams.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-20 text-white/30">
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
                  className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-white/40">Page {page + 1}</span>
                <button
                  disabled={streams.length < limit}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 disabled:opacity-30 transition-colors"
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
