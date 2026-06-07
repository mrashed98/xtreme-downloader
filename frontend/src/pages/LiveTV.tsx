import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tv } from "lucide-react";
import { liveApi } from "../api/client";
import { useAppStore } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";
import { EmptyState, Loading, SearchInput, TONE_BG, toneFg, toneFor } from "../components/ds";

export function LiveTV() {
  const { activePlaylistId, openPlayer } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["live-cats", activePlaylistId],
    queryFn: () => liveApi.categories(activePlaylistId!),
    enabled: !!activePlaylistId,
  });

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ["live-streams", activePlaylistId, selectedCategory, search],
    queryFn: () =>
      liveApi.streams(activePlaylistId!, {
        category_id: selectedCategory || undefined,
        search: search || undefined,
      }),
    enabled: !!activePlaylistId,
    staleTime: 30_000,
  });

  const handlePlay = async (streamId: string, name: string) => {
    if (!activePlaylistId) return;
    const { url } = await liveApi.url(activePlaylistId, streamId);
    openPlayer(url, name, "hls");
  };

  if (!activePlaylistId) {
    return (
      <div className="xcontent">
        <EmptyState
          icon={<Tv />}
          title="Select a playlist first"
          sub="Set an active playlist from the Dashboard to load live channels."
        />
      </div>
    );
  }

  return (
    <div className="xcontent">
      <div className="xpagehead">
        <div className="xpagehead__eyebrow">Live · Zero-buffer</div>
        <h1 className="xpagehead__title">Live TV</h1>
      </div>
      <div className="xbrowse">
        <CategorySidebar
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          allLabel="All Channels"
        />
        <div className="xbrowse__main">
          <div className="xfilter">
            <div className="xfilter__search">
              <SearchInput placeholder="Search channels…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <span className="xfilter__count">{streams.length} channels</span>
          </div>

          {isLoading ? (
            <Loading />
          ) : streams.length === 0 ? (
            <EmptyState icon={<Tv />} title="No channels found" sub="Nothing here yet. Go find something worth the bandwidth." />
          ) : (
            <div className="xchannelgrid">
              {streams.map((stream) => {
                const tone = toneFor(stream.name);
                return (
                  <button key={stream.stream_id} className="xchan xrise" onClick={() => handlePlay(stream.stream_id, stream.name)}>
                    <div className="xchan__logo" style={{ background: stream.icon ? "var(--ink-900)" : TONE_BG[tone], color: toneFg(tone) }}>
                      {stream.icon ? (
                        <img
                          src={stream.icon}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = "none";
                            const parent = img.parentElement;
                            if (parent) {
                              parent.style.background = TONE_BG[tone];
                              parent.textContent = stream.name
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2);
                            }
                          }}
                        />
                      ) : (
                        stream.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                      )}
                    </div>
                    <span className="xchan__name">{stream.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
