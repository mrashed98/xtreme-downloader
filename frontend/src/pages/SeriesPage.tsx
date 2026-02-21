import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Clapperboard, X, Download, BookmarkPlus, BookmarkCheck,
  ChevronDown, ChevronRight, Heart, ExternalLink, Star, Users, Play, Check,
} from "lucide-react";
import { seriesApi, favoritesApi, type Series, type Season, type Episode } from "../api/client";
import { useAppStore, type PlayerItem } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { ContentCard } from "../components/ContentGrid/ContentCard";
import { TrackingDialog } from "../components/TrackingDialog/TrackingDialog";

const LANGUAGES = ["Arabic", "English", "Turkish", "French", "Spanish"];

// ─── Detail Modal ────────────────────────────────────────────────────────────

function SeriesDetailModal({
  series,
  playlistId,
  isFavorited,
  onToggleFavorite,
  onClose,
}: {
  series: Series;
  playlistId: number;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { openQueue } = useAppStore();
  const [showTracking, setShowTracking] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));
  const [downloadLanguage, setDownloadLanguage] = useState("English");
  const [downloadingEps, setDownloadingEps] = useState<Set<string>>(new Set());
  const [playingEps, setPlayingEps] = useState<Set<string>>(new Set());

  const { data: detail } = useQuery({
    queryKey: ["series-detail", playlistId, series.series_id],
    queryFn: () => seriesApi.get(playlistId, series.series_id),
  });

  const { data: tracking } = useQuery({
    queryKey: ["series-tracking", playlistId, series.series_id],
    queryFn: () => seriesApi.tracking(playlistId, series.series_id),
  });

  const seasons = detail?.seasons || [];

  const toggleSeason = (num: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const handleDownloadEpisode = async (ep: Episode) => {
    setDownloadingEps((prev) => new Set(prev).add(ep.episode_id));
    try {
      await seriesApi.download(playlistId, series.series_id, {
        language: downloadLanguage,
        episode_ids: [ep.episode_id],
      });
      qc.invalidateQueries({ queryKey: ["downloads"] });
    } finally {
      setDownloadingEps((prev) => {
        const next = new Set(prev);
        next.delete(ep.episode_id);
        return next;
      });
    }
  };

  const handleDownloadSeason = async (seasonNum: number) => {
    await seriesApi.download(playlistId, series.series_id, {
      language: downloadLanguage,
      season_num: seasonNum,
    });
    qc.invalidateQueries({ queryKey: ["downloads"] });
  };

  const handlePlayEpisode = async (ep: Episode, season: Season) => {
    setPlayingEps((prev) => new Set(prev).add(ep.episode_id));
    try {
      // Build a queue of all remaining episodes in this season starting from ep
      const allEps = season.episodes || [];
      const startIdx = allEps.findIndex((e) => e.episode_id === ep.episode_id);
      const toFetch = startIdx >= 0 ? allEps.slice(startIdx) : [ep];

      // Fetch watch URLs in parallel (capped to avoid flooding the backend)
      const items: PlayerItem[] = await Promise.all(
        toFetch.map(async (e) => {
          const { url, stream_type } = await seriesApi.watchEpisode(playlistId, series.series_id, e.episode_id);
          const label = e.title || `Episode ${e.episode_num ?? ""}`;
          return { url, title: `${series.name} · ${label}`, type: stream_type === "hls" ? "hls" : "mp4" } as PlayerItem;
        })
      );

      openQueue(items, 0);
    } finally {
      setPlayingEps((prev) => {
        const next = new Set(prev);
        next.delete(ep.episode_id);
        return next;
      });
    }
  };

  const trailerUrl = series.youtube_trailer
    ? `https://www.youtube.com/watch?v=${series.youtube_trailer}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-3xl mx-4 animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex gap-4">
          {series.cover && (
            <img
              src={series.cover}
              alt={series.name}
              className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold text-white">{series.name}</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={onToggleFavorite}
                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isFavorited ? "text-pink-400 bg-pink-500/20" : "text-white/40 hover:text-pink-400 hover:bg-white/10"
                  }`}
                >
                  <Heart size={16} fill={isFavorited ? "currentColor" : "none"} />
                </button>
                <button onClick={onClose} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {series.genre && <span className="badge badge-purple">{series.genre}</span>}
              {series.language && <span className="badge badge-gray">{series.language}</span>}
              {series.rating != null && series.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm text-yellow-400">{series.rating.toFixed(1)}</span>
                </div>
              )}
              {series.release_date && (
                <span className="text-xs text-white/30">{series.release_date}</span>
              )}
            </div>

            {/* Plot */}
            {series.plot && (
              <p className="text-sm text-white/60 mt-2 line-clamp-3 leading-relaxed">{series.plot}</p>
            )}

            {/* Cast */}
            {series.cast && (
              <p className="text-xs text-white/40 mt-1.5 line-clamp-1">
                <Users size={10} className="inline mr-1 opacity-60" />
                {series.cast}
              </p>
            )}

            {/* Director */}
            {series.director && (
              <p className="text-xs text-white/40 mt-0.5">
                <span className="text-white/25">Dir:</span> {series.director}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <select
                value={downloadLanguage}
                onChange={(e) => setDownloadLanguage(e.target.value)}
                className="glass-input text-sm py-1.5"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} className="bg-gray-900">{l}</option>
                ))}
              </select>

              <button
                onClick={() => setShowTracking(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tracking
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "btn-accent"
                }`}
              >
                {tracking ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
                {tracking ? "Tracking" : "Track"}
              </button>

              {trailerUrl && (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  <ExternalLink size={14} />
                  Trailer
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Seasons */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {seasons.map((season: Season) => (
            <div key={season.season_num} className="glass-card rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                onClick={() => toggleSeason(season.season_num)}
              >
                <div className="flex items-center gap-3">
                  {expandedSeasons.has(season.season_num) ? (
                    <ChevronDown size={16} className="text-white/50" />
                  ) : (
                    <ChevronRight size={16} className="text-white/50" />
                  )}
                  <span className="font-medium text-white">
                    {season.name || `Season ${season.season_num}`}
                  </span>
                  <span className="text-xs text-white/40">
                    {season.episodes?.length || 0} episodes
                  </span>
                  {season.air_date && (
                    <span className="text-xs text-white/25 hidden sm:block">{season.air_date}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadSeason(season.season_num); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-xs transition-colors"
                >
                  <Download size={12} />
                  All
                </button>
              </button>

              {expandedSeasons.has(season.season_num) && (
                <div className="border-t border-white/5">
                  {(season.episodes || []).map((ep: Episode) => (
                    <div
                      key={ep.episode_id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 border-b border-white/3 last:border-0 group/ep"
                    >
                      <span className="text-xs text-white/30 w-8 text-right flex-shrink-0">
                        {ep.episode_num != null ? `E${ep.episode_num.toString().padStart(2, "0")}` : "—"}
                      </span>
                      <span className="flex-1 text-sm text-white/80 truncate">
                        {ep.title || `Episode ${ep.episode_num}`}
                      </span>
                      {ep.duration && (
                        <span className="text-xs text-white/30 hidden sm:block">{ep.duration}</span>
                      )}
                      <button
                        onClick={() => handlePlayEpisode(ep, season)}
                        disabled={playingEps.has(ep.episode_id)}
                        className="p-1.5 rounded-lg hover:bg-purple-500/20 text-white/40 hover:text-purple-300 transition-colors disabled:opacity-50"
                        title="Play"
                      >
                        {playingEps.has(ep.episode_id)
                          ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                          : <Play size={12} fill="currentColor" />
                        }
                      </button>
                      <button
                        onClick={() => handleDownloadEpisode(ep)}
                        disabled={downloadingEps.has(ep.episode_id)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-50"
                        title="Download"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {seasons.length === 0 && (
            <div className="text-center py-10 text-white/30">
              <p>No episodes data. Open the series to load episodes from the provider.</p>
            </div>
          )}
        </div>
      </div>

      {showTracking && (
        <TrackingDialog
          series={series}
          seasons={seasons}
          tracking={tracking}
          onClose={() => setShowTracking(false)}
          onTracked={() => qc.invalidateQueries({ queryKey: ["series-tracking"] })}
        />
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SeriesPage() {
  const { activePlaylistId } = useAppStore();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [genre, setGenre] = useState("");
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [actorSearch, setActorSearch] = useState("");
  const [actorOpen, setActorOpen] = useState(false);
  const actorRef = useRef<HTMLDivElement>(null);
  const [ratingMin, setRatingMin] = useState<number | undefined>();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [page, setPage] = useState(0);
  const limit = 60;

  useEffect(() => {
    if (!actorOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (actorRef.current && !actorRef.current.contains(e.target as Node)) {
        setActorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actorOpen]);

  const { data: categories = [] } = useQuery({
    queryKey: ["series-cats", activePlaylistId],
    queryFn: () => seriesApi.categories(activePlaylistId!),
    enabled: !!activePlaylistId,
  });

  const { data: seriesList = [], isLoading } = useQuery({
    queryKey: ["series-list", activePlaylistId, selectedCategory, search, language, genre, selectedActors, ratingMin, page],
    queryFn: () =>
      seriesApi.list(activePlaylistId!, {
        category_id: selectedCategory || undefined,
        search: search || undefined,
        language: language || undefined,
        genre: genre || undefined,
        cast: selectedActors.length ? selectedActors.join(",") : undefined,
        rating_min: ratingMin,
        limit,
        offset: page * limit,
      }),
    enabled: !!activePlaylistId,
    staleTime: 60_000,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", activePlaylistId, "series"],
    queryFn: () => favoritesApi.list(activePlaylistId!, "series"),
    enabled: !!activePlaylistId,
  });

  const favoritedIds = useMemo(
    () => new Set(favorites.map((f) => f.item_id)),
    [favorites],
  );

  const favIds = favorites.map((f) => f.item_id);

  const { data: favSeries = [], isLoading: favLoading } = useQuery({
    queryKey: ["series-favorites", activePlaylistId, favIds.join(",")],
    queryFn: () => seriesApi.list(activePlaylistId!, { ids: favIds.join(","), limit: 1000 }),
    enabled: !!activePlaylistId && favoritesOnly && favIds.length > 0,
    staleTime: 60_000,
  });

  const { data: genres = [] } = useQuery({
    queryKey: ["series-genres", activePlaylistId],
    queryFn: () => seriesApi.genres(activePlaylistId!),
    enabled: !!activePlaylistId,
    staleTime: 300_000,
  });

  const { data: actors = [] } = useQuery({
    queryKey: ["series-actors", activePlaylistId],
    queryFn: () => seriesApi.actors(activePlaylistId!),
    enabled: !!activePlaylistId,
    staleTime: 300_000,
  });

  const displayedSeries = favoritesOnly ? favSeries : seriesList;
  const isLoadingDisplay = favoritesOnly ? favLoading : isLoading;

  const handleToggleFavorite = async (s: Series) => {
    if (!activePlaylistId) return;
    if (favoritedIds.has(s.series_id)) {
      await favoritesApi.remove({ playlist_id: activePlaylistId, content_type: "series", item_id: s.series_id });
    } else {
      await favoritesApi.add({ playlist_id: activePlaylistId, content_type: "series", item_id: s.series_id });
    }
    qc.invalidateQueries({ queryKey: ["favorites", activePlaylistId, "series"] });
  };

  if (!activePlaylistId) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <div className="text-center">
          <Clapperboard size={48} className="mx-auto mb-3 opacity-30" />
          <p>Select a playlist from the dashboard first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <CategorySidebar
        categories={categories}
        selected={selectedCategory}
        onSelect={(id) => { setSelectedCategory(id); setPage(0); }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="w-full glass-input pl-9 text-sm"
              placeholder="Search series..."
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
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-gray-900">{l}</option>
            ))}
          </select>

          <select
            className="glass-input text-sm"
            value={genre}
            onChange={(e) => { setGenre(e.target.value); setPage(0); }}
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g} className="bg-gray-900">{g}</option>
            ))}
          </select>

          <div className="relative" ref={actorRef}>
            <button
              onClick={() => setActorOpen((v) => !v)}
              className={`glass-input text-sm flex items-center gap-2 min-w-36 ${
                selectedActors.length ? "text-white" : "text-white/50"
              }`}
            >
              <Users size={13} className="flex-shrink-0" />
              <span className="truncate">
                {selectedActors.length === 0
                  ? "All actors"
                  : selectedActors.length === 1
                  ? selectedActors[0]
                  : `${selectedActors.length} actors`}
              </span>
              <ChevronDown size={12} className="ml-auto flex-shrink-0" />
            </button>

            {actorOpen && (
              <div className="absolute top-full mt-1 left-0 z-30 w-64 glass-card rounded-xl shadow-xl border border-white/10 overflow-hidden">
                <div className="p-2 border-b border-white/10 space-y-1.5">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      className="w-full glass-input pl-8 py-1.5 text-xs"
                      placeholder="Search actors..."
                      value={actorSearch}
                      onChange={(e) => setActorSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {selectedActors.length > 0 && (
                    <button
                      onClick={() => { setSelectedActors([]); setPage(0); }}
                      className="text-xs text-white/40 hover:text-white px-1"
                    >
                      Clear all ({selectedActors.length})
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {(actorSearch
                    ? actors.filter((a) => a.toLowerCase().includes(actorSearch.toLowerCase()))
                    : actors
                  ).map((actor) => (
                    <button
                      key={actor}
                      onClick={() => {
                        setSelectedActors((prev) =>
                          prev.includes(actor) ? prev.filter((a) => a !== actor) : [...prev, actor]
                        );
                        setPage(0);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/5 ${
                        selectedActors.includes(actor) ? "text-purple-300" : "text-white/70"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        selectedActors.includes(actor)
                          ? "bg-purple-500 border-purple-500"
                          : "border-white/20"
                      }`}>
                        {selectedActors.includes(actor) && <Check size={10} className="text-white" />}
                      </div>
                      <span className="truncate">{actor}</span>
                    </button>
                  ))}
                  {actors.filter((a) => a.toLowerCase().includes(actorSearch.toLowerCase())).length === 0 && actorSearch && (
                    <p className="text-xs text-white/30 text-center py-4">No actors found</p>
                  )}
                </div>
              </div>
            )}
          </div>

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

        {isLoadingDisplay ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500" />
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayedSeries.map((s) => (
                  <ContentCard
                    key={s.series_id}
                    title={s.name}
                    subtitle={s.genre || undefined}
                    image={s.cover}
                    rating={s.rating}
                    badge={s.language || undefined}
                    isFavorited={favoritedIds.has(s.series_id)}
                    onFavorite={() => handleToggleFavorite(s)}
                    onClick={() => setSelectedSeries(s)}
                  />
                ))}
                {displayedSeries.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-20 text-white/30">
                    <div className="text-center">
                      <Clapperboard size={40} className="mx-auto mb-2 opacity-40" />
                      <p>{favoritesOnly ? "No favorites yet" : "No series found"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!favoritesOnly && (seriesList.length === limit || page > 0) && (
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
                  disabled={seriesList.length < limit}
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

      {selectedSeries && (
        <SeriesDetailModal
          series={selectedSeries}
          playlistId={activePlaylistId}
          isFavorited={favoritedIds.has(selectedSeries.series_id)}
          onToggleFavorite={() => handleToggleFavorite(selectedSeries)}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </div>
  );
}
