import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Layers,
  Play,
  Star,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { seriesApi, favoritesApi, type Series, type Season, type Episode } from "../api/client";
import { useAppStore, type PlayerItem } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { PosterTile } from "../components/ContentGrid/PosterTile";
import { TrackingDialog } from "../components/TrackingDialog/TrackingDialog";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Loading,
  SearchInput,
  Select,
  TONE_BG,
  toneFg,
  toneFor,
} from "../components/ds";
import { LANGUAGES } from "./Movies";

/* ─── Detail Modal ─────────────────────────────────────────────────────────── */

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
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(new Set([1]));
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
  const tone = toneFor(series.name);

  const toggleSeason = (num: number) => {
    setOpenSeasons((prev) => {
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
      toast.success("Episode queued");
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
    toast.success(`Season ${seasonNum} queued`);
    qc.invalidateQueries({ queryKey: ["downloads"] });
  };

  const handlePlayEpisode = async (ep: Episode, season: Season) => {
    setPlayingEps((prev) => new Set(prev).add(ep.episode_id));
    try {
      const allEps = season.episodes || [];
      const startIdx = allEps.findIndex((e) => e.episode_id === ep.episode_id);
      const toFetch = startIdx >= 0 ? allEps.slice(startIdx) : [ep];

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

  const handlePlayFirst = () => {
    const first = seasons[0];
    if (first?.episodes?.length) handlePlayEpisode(first.episodes[0], first);
  };

  const handleToggleMonitored = async (ep: Episode, season: Season) => {
    const newVal = !ep.monitored;
    qc.setQueryData(["series-detail", playlistId, series.series_id], (old: Series | undefined) => {
      if (!old?.seasons) return old;
      return {
        ...old,
        seasons: old.seasons.map((s) =>
          s.season_num !== season.season_num
            ? s
            : {
                ...s,
                episodes: s.episodes.map((e) => (e.episode_id === ep.episode_id ? { ...e, monitored: newVal } : e)),
              }
        ),
      };
    });
    try {
      await seriesApi.patchEpisode(playlistId, series.series_id, ep.episode_id, { monitored: newVal });
      if (newVal) toast.success("Episode queued for download");
      qc.invalidateQueries({ queryKey: ["downloads"] });
    } catch {
      toast.error("Failed to update episode");
      qc.invalidateQueries({ queryKey: ["series-detail", playlistId, series.series_id] });
    }
  };

  const trailerUrl = series.youtube_trailer ? `https://www.youtube.com/watch?v=${series.youtube_trailer}` : null;

  return (
    <div className="xoverlay" onClick={onClose}>
      <div className="xmodal xmodal--detail" onClick={(e) => e.stopPropagation()}>
        <div
          className="xvod__hero"
          style={
            series.backdrop || series.cover
              ? { backgroundImage: `url(${series.backdrop || series.cover})`, minHeight: 280 }
              : { background: `radial-gradient(120% 130% at 78% 12%, ${TONE_BG[tone]}, var(--ink-1000) 64%)`, minHeight: 280 }
          }
        >
          <div className="xvod__heroscrim" />
          <button className="xmodal__close xvod__heroclose" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
          <div className="xvod__herobody">
            <div className="xvod__poster" style={{ background: series.cover ? undefined : TONE_BG[tone] }}>
              {series.cover ? (
                <img src={series.cover} alt={series.name} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : (
                <span style={{ color: toneFg(tone) }}>{series.name}</span>
              )}
            </div>
            <div className="xvod__headmeta">
              <span className="xmodal__eyebrow">Series · Xtream Codes API</span>
              <h2 className="xvod__title">{series.name}</h2>
              <div className="xvod__badges">
                {series.rating != null && series.rating > 0 && (
                  <span className="xrating">
                    <Star fill="currentColor" stroke="none" />
                    {series.rating.toFixed(1)}
                  </span>
                )}
                {series.release_date && <span className="meta">{series.release_date}</span>}
                {series.genre && (
                  <>
                    <span className="sep">·</span>
                    <span className="meta">{series.genre}</span>
                  </>
                )}
                {seasons.length > 0 && <Badge variant="soft">{seasons.length} seasons</Badge>}
                {series.episode_run_time && <Badge variant="soft">{series.episode_run_time} min/ep</Badge>}
                {series.language && <Badge variant="soft">{series.language}</Badge>}
                {tracking ? <Badge variant="new">Tracking</Badge> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="xvod__body">
          <div className="xvod__actions">
            <Button
              variant="primary"
              size="lg"
              icon={<Play size={18} fill="currentColor" stroke="none" />}
              disabled={!seasons[0]?.episodes?.length}
              onClick={handlePlayFirst}
            >
              Play
            </Button>
            <Button variant={tracking ? "hot" : "outline"} size="lg" icon={<Bell size={18} />} onClick={() => setShowTracking(true)}>
              {tracking ? "Tracking" : "Track series"}
            </Button>
            <IconButton
              variant="glass"
              size="lg"
              label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              onClick={onToggleFavorite}
              style={isFavorited ? { color: "var(--hot-500)" } : undefined}
            >
              <Heart size={22} fill={isFavorited ? "currentColor" : "none"} />
            </IconButton>
            <div className="xvod__links" style={{ alignItems: "center" }}>
              {trailerUrl && (
                <a className="xlinkbtn" href={trailerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Trailer
                </a>
              )}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                Audio
              </span>
              <Select value={downloadLanguage} onChange={setDownloadLanguage} options={LANGUAGES} ariaLabel="Download language" />
            </div>
          </div>

          {series.plot && <p className="xvod__plot">{series.plot}</p>}

          <div className="xvod__credits">
            {series.director && (
              <div className="xvod__credit">
                <span className="k">Director</span>
                <span className="v">{series.director}</span>
              </div>
            )}
            {series.cast && (
              <div className="xvod__credit">
                <span className="k">Cast</span>
                <span className="v">{series.cast}</span>
              </div>
            )}
          </div>

          {seasons.map((season) => {
            const open = openSeasons.has(season.season_num);
            return (
              <div key={season.season_num} className={"xseason" + (open ? " is-open" : "")}>
                <button className="xseason__head" onClick={() => toggleSeason(season.season_num)}>
                  <span className="xseason__num">S{String(season.season_num).padStart(2, "0")}</span>
                  <span className="xseason__title">
                    {season.name || `Season ${season.season_num}`}
                    <span className="xseason__count">{season.episodes?.length || 0} episodes</span>
                  </span>
                  <span
                    className="xlinkbtn"
                    style={{ marginLeft: "auto", height: 38 }}
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSeason(season.season_num);
                    }}
                  >
                    <Download />
                    Season
                  </span>
                  <ChevronDown size={20} className="xseason__chev" />
                </button>
                {open && (
                  <div className="xseason__body">
                    {(season.episodes || []).map((ep) => (
                      <div key={ep.episode_id} className={"xepisode" + (!ep.monitored ? " is-unmonitored" : "")}>
                        <span className="xepisode__no">
                          {ep.episode_num != null ? `E${String(ep.episode_num).padStart(2, "0")}` : "—"}
                        </span>
                        <button
                          className="xepisode__play"
                          onClick={() => handlePlayEpisode(ep, season)}
                          disabled={playingEps.has(ep.episode_id)}
                          aria-label="Play"
                        >
                          {playingEps.has(ep.episode_id) ? (
                            <span className="xspinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          ) : (
                            <Play fill="currentColor" stroke="none" />
                          )}
                        </button>
                        <div className="xepisode__info">
                          <div className="xepisode__title">{ep.title || `Episode ${ep.episode_num}`}</div>
                          {ep.duration && <div className="xepisode__desc">{ep.duration}</div>}
                        </div>
                        <div className="xepisode__actions">
                          <button
                            className={"xeyebtn" + (ep.monitored ? " is-on" : "")}
                            onClick={() => handleToggleMonitored(ep, season)}
                            aria-label={ep.monitored ? "Unmonitor episode" : "Monitor episode"}
                            title={ep.monitored ? "Monitored" : "Not monitored"}
                          >
                            {ep.monitored ? <Eye /> : <EyeOff />}
                          </button>
                          <button
                            className="xrowbtn"
                            onClick={() => handleDownloadEpisode(ep)}
                            disabled={downloadingEps.has(ep.episode_id)}
                            aria-label="Download episode"
                          >
                            <Download />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {seasons.length === 0 && (
            <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "24px 0" }}>
              No episodes data. Open the series to load episodes from the provider.
            </p>
          )}
        </div>
      </div>

      {showTracking && (
        <TrackingDialog
          series={series}
          seasons={seasons}
          tracking={tracking}
          onClose={() => setShowTracking(false)}
          onTracked={() => {
            qc.invalidateQueries({ queryKey: ["series-tracking"] });
            qc.invalidateQueries({ queryKey: ["downloads"] });
          }}
        />
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

const RATINGS: [string, string][] = [
  ["0", "Any rating"],
  ["5", "5+"],
  ["6", "6+"],
  ["7", "7+"],
  ["8", "8+"],
];

export function SeriesPage() {
  const { activePlaylistId } = useAppStore();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [genre, setGenre] = useState("all");
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [actorSearch, setActorSearch] = useState("");
  const [actorOpen, setActorOpen] = useState(false);
  const actorRef = useRef<HTMLDivElement>(null);
  const [ratingMin, setRatingMin] = useState("0");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [page, setPage] = useState(0);
  const limit = 60;

  const resetPage = () => setPage(0);

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

  const seriesCategories = [
    {
      id: -1,
      playlist_id: activePlaylistId ?? 0,
      type: "series",
      category_id: "__latest__",
      name: "Latest 50",
    },
    ...categories,
  ];

  const { data: seriesList = [], isLoading } = useQuery({
    queryKey: ["series-list", activePlaylistId, selectedCategory, search, language, genre, selectedActors, ratingMin, page],
    queryFn: () =>
      seriesApi.list(activePlaylistId!, {
        category_id: selectedCategory === "__latest__" ? undefined : selectedCategory || undefined,
        latest: selectedCategory === "__latest__",
        search: search || undefined,
        language: language === "all" ? undefined : language,
        genre: genre === "all" ? undefined : genre,
        cast: selectedActors.length ? selectedActors.join(",") : undefined,
        rating_min: ratingMin === "0" ? undefined : Number(ratingMin),
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

  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.item_id)), [favorites]);
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
      <div className="xcontent">
        <EmptyState icon={<Layers />} title="Select a playlist first" sub="Set an active playlist to browse series." />
      </div>
    );
  }

  const filteredActors = actorSearch
    ? actors.filter((a) => a.toLowerCase().includes(actorSearch.toLowerCase()))
    : actors;

  return (
    <div className="xcontent">
      <div className="xpagehead">
        <div className="xpagehead__eyebrow">Binge · Auto-download</div>
        <h1 className="xpagehead__title">Series</h1>
      </div>
      <div className="xbrowse">
        <CategorySidebar
          categories={seriesCategories}
          selected={selectedCategory}
          onSelect={(id) => {
            setSelectedCategory(id);
            resetPage();
          }}
          allLabel="All Series"
        />
        <div className="xbrowse__main">
          <div className="xfilter">
            <div className="xfilter__search">
              <SearchInput
                placeholder="Search series…"
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

            <Select
              value={genre}
              onChange={(v) => {
                setGenre(v);
                resetPage();
              }}
              options={[{ value: "all", label: "All genres" }, ...genres]}
              ariaLabel="Genre"
            />

            <div style={{ position: "relative" }} ref={actorRef}>
              <button
                className={"xfav-toggle" + (selectedActors.length ? " is-on-volt" : "")}
                onClick={() => setActorOpen((v) => !v)}
              >
                <Users />
                {selectedActors.length === 0
                  ? "Actors"
                  : selectedActors.length === 1
                  ? selectedActors[0]
                  : `${selectedActors.length} actors`}
                <ChevronDown size={14} />
              </button>

              {actorOpen && (
                <div
                  className="xlangsel__pop"
                  style={{ top: "calc(100% + 8px)", bottom: "auto", minWidth: 240, maxHeight: 300, overflowY: "auto" }}
                >
                  <div style={{ padding: "4px 4px 8px" }}>
                    <input
                      className="xinput"
                      style={{ height: 40, fontSize: 14 }}
                      placeholder="Search actors…"
                      value={actorSearch}
                      onChange={(e) => setActorSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {selectedActors.length > 0 && (
                    <button
                      className="xlangsel__opt"
                      style={{ color: "var(--hot-500)" }}
                      onClick={() => {
                        setSelectedActors([]);
                        resetPage();
                      }}
                    >
                      Clear all ({selectedActors.length})
                    </button>
                  )}
                  {filteredActors.map((actor) => {
                    const on = selectedActors.includes(actor);
                    return (
                      <button
                        key={actor}
                        className={"xlangsel__opt" + (on ? " is-on" : "")}
                        onClick={() => {
                          setSelectedActors((prev) => (on ? prev.filter((a) => a !== actor) : [...prev, actor]));
                          resetPage();
                        }}
                      >
                        {on ? <Check /> : <span style={{ width: 15 }} />}
                        {actor}
                      </button>
                    );
                  })}
                  {filteredActors.length === 0 && actorSearch && (
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0", margin: 0 }}>
                      No actors found
                    </p>
                  )}
                </div>
              )}
            </div>

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

          {isLoadingDisplay ? (
            <Loading />
          ) : displayedSeries.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title={favoritesOnly ? "No favorites yet" : "No series found"}
              sub="Nothing here yet. Go find something worth the bandwidth."
            />
          ) : (
            <>
              <div className="xposgrid">
                {displayedSeries.map((s) => (
                  <PosterTile
                    key={s.series_id}
                    title={s.name}
                    eyebrow={(s.genre || s.language || "Series").toUpperCase()}
                    image={s.cover}
                    rating={s.rating}
                    isFavorited={favoritedIds.has(s.series_id)}
                    onFavorite={() => handleToggleFavorite(s)}
                    onOpen={() => setSelectedSeries(s)}
                  />
                ))}
              </div>

              {!favoritesOnly && (seriesList.length === limit || page > 0) && (
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
                    disabled={seriesList.length < limit}
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
