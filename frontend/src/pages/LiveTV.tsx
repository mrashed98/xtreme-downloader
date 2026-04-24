import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Tv } from "lucide-react";
import { liveApi } from "../api/client";
import { useAppStore } from "../store";
import { CategorySidebar } from "../components/ContentGrid/CategorySidebar";

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
      <div className="flex items-center justify-center h-full text-white/40">
        <div className="text-center">
          <Tv size={48} className="mx-auto mb-3 opacity-30" />
          <p>Select a playlist from the dashboard first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
      <CategorySidebar
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <div className="mt-5 flex min-w-0 flex-col lg:mt-0">
        <section className="glass-card page-hero">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="page-hero__eyebrow">Live TV</p>
              <h1 className="page-hero__title">Channel surfing, streamlined for every screen.</h1>
              <p className="page-hero__body">
                Browse synced channels fast, then jump straight into playback with a touch-friendly layout on mobile and a denser grid on desktop.
              </p>
            </div>
          </div>
        </section>

        <div className="relative mb-4 mt-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            className="w-full glass-input pl-11"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-purple-500" />
          </div>
        ) : streams.length === 0 ? (
          <div className="glass-card flex flex-1 items-center justify-center p-8 text-white/30">
            <div className="text-center">
              <Tv size={40} className="mx-auto mb-2 opacity-40" />
              <p>No channels found</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {streams.map((stream) => (
                <button
                  key={stream.stream_id}
                  onClick={() => handlePlay(stream.stream_id, stream.name)}
                  className="glass-card group flex flex-col items-center gap-3 p-4 text-center transition-all duration-300 hover:-translate-y-1"
                >
                  {stream.icon ? (
                    <img
                      src={stream.icon}
                      alt={stream.name}
                      className="h-14 w-14 rounded-2xl object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                      <Tv size={20} className="text-white/30" />
                    </div>
                  )}
                  <span className="line-clamp-2 text-sm leading-tight text-white/80 transition-colors group-hover:text-white">
                    {stream.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
