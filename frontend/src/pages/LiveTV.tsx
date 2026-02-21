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
    <div className="flex h-full gap-4 p-4">
      <CategorySidebar
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            className="w-full glass-input pl-9"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Channel grid */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500" />
          </div>
        ) : streams.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-white/30">
            <div className="text-center">
              <Tv size={40} className="mx-auto mb-2 opacity-40" />
              <p>No channels found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {streams.map((stream) => (
                <button
                  key={stream.stream_id}
                  onClick={() => handlePlay(stream.stream_id, stream.name)}
                  className="glass-card p-3 flex flex-col items-center gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/20 group"
                >
                  {stream.icon ? (
                    <img
                      src={stream.icon}
                      alt={stream.name}
                      className="w-12 h-12 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                      <Tv size={20} className="text-white/30" />
                    </div>
                  )}
                  <span className="text-xs text-white/80 text-center line-clamp-2 leading-tight group-hover:text-white transition-colors">
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
