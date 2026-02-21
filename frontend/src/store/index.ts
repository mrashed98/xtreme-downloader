import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Playlist {
  id: number;
  name: string;
  base_url: string;
  username: string;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface PlayerItem {
  url: string;
  title: string;
  type: "hls" | "mp4";
}

interface PlayerState {
  queue: PlayerItem[];
  queueIndex: number;
  isOpen: boolean;
}

interface AppState {
  // Active playlist
  activePlaylistId: number | null;
  setActivePlaylistId: (id: number | null) => void;

  // Playlists cache
  playlists: Playlist[];
  setPlaylists: (playlists: Playlist[]) => void;

  // Player
  player: PlayerState;
  openPlayer: (url: string, title: string, type: "hls" | "mp4") => void;
  openQueue: (items: PlayerItem[], startIndex?: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  closePlayer: () => void;

  // Download badge count
  activeDownloadCount: number;
  setActiveDownloadCount: (count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activePlaylistId: null,
      setActivePlaylistId: (id) => set({ activePlaylistId: id }),

      playlists: [],
      setPlaylists: (playlists) => set({ playlists }),

      player: { queue: [], queueIndex: 0, isOpen: false },

      openPlayer: (url, title, type) =>
        set({ player: { queue: [{ url, title, type }], queueIndex: 0, isOpen: true } }),

      openQueue: (items, startIndex = 0) =>
        set({ player: { queue: items, queueIndex: startIndex, isOpen: true } }),

      nextTrack: () =>
        set((s) => {
          const next = s.player.queueIndex + 1;
          if (next >= s.player.queue.length) return s;
          return { player: { ...s.player, queueIndex: next } };
        }),

      prevTrack: () =>
        set((s) => {
          const prev = s.player.queueIndex - 1;
          if (prev < 0) return s;
          return { player: { ...s.player, queueIndex: prev } };
        }),

      closePlayer: () =>
        set((s) => ({ player: { ...s.player, isOpen: false } })),

      activeDownloadCount: 0,
      setActiveDownloadCount: (count) => set({ activeDownloadCount: count }),
    }),
    {
      name: "xtreme-store",
      partialize: (state) => ({ activePlaylistId: state.activePlaylistId }),
    }
  )
);
