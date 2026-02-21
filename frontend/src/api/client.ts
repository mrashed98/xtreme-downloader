import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

// Types
export interface Playlist {
  id: number;
  name: string;
  base_url: string;
  username: string;
  is_active: boolean;
  last_synced_at: string | null;
  sync_status: "idle" | "syncing" | "error";
  created_at: string;
}

export interface Category {
  id: number;
  playlist_id: number;
  type: string;
  category_id: string;
  name: string;
}

export interface LiveStream {
  id: number;
  playlist_id: number;
  stream_id: string;
  name: string;
  icon: string | null;
  category_id: string | null;
  epg_channel_id: string | null;
}

export interface VodStream {
  id: number;
  playlist_id: number;
  stream_id: string;
  name: string;
  icon: string | null;
  category_id: string | null;
  genre: string | null;
  rating: number | null;
  language: string | null;
  director: string | null;
  cast: string | null;
  plot: string | null;
  duration: string | null;
  container_extension: string | null;
}

export interface Episode {
  id: number;
  series_id: number;
  season_num: number;
  episode_id: string;
  episode_num: number | null;
  title: string | null;
  container_extension: string | null;
  duration: string | null;
  monitored: boolean;
}

export interface Season {
  id: number;
  series_id: number;
  season_num: number;
  name: string | null;
  cover: string | null;
  air_date: string | null;
  episodes: Episode[];
}

export interface Series {
  id: number;
  playlist_id: number;
  series_id: string;
  name: string;
  cover: string | null;
  category_id: string | null;
  genre: string | null;
  rating: number | null;
  language: string | null;
  cast: string | null;
  director: string | null;
  plot: string | null;
  youtube_trailer: string | null;
  release_date: string | null;
  seasons?: Season[];
}

export interface Favorite {
  id: number;
  playlist_id: number;
  content_type: "series" | "vod";
  item_id: string;
  created_at: string;
}

export interface Download {
  id: number;
  playlist_id: number;
  content_type: string;
  stream_id: string;
  title: string;
  language: string | null;
  file_path: string | null;
  status: "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled";
  progress_pct: number;
  speed_bps: number;
  total_bytes: number;
  downloaded_bytes: number;
  error_message: string | null;
  created_at: string;
}

export interface Tracking {
  id: number;
  series_id: number;
  playlist_id: number;
  language: string;
  track_all_seasons: boolean;
  seasons_json: number[] | null;
  last_checked_at: string | null;
  queued_count?: number;
}

// Playlist API
export const playlistsApi = {
  list: () => api.get<Playlist[]>("/playlists").then((r) => r.data),
  create: (data: { name: string; base_url: string; username: string; password: string }) =>
    api.post<Playlist>("/playlists", data).then((r) => r.data),
  update: (id: number, data: Partial<Playlist & { password: string }>) =>
    api.put<Playlist>(`/playlists/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/playlists/${id}`),
  sync: (id: number) => api.post<Playlist>(`/playlists/${id}/sync`).then((r) => r.data),
};

// Live API
export const liveApi = {
  categories: (playlistId: number) =>
    api.get<Category[]>(`/live/${playlistId}/categories`).then((r) => r.data),
  streams: (playlistId: number, params?: { category_id?: string; search?: string }) =>
    api.get<LiveStream[]>(`/live/${playlistId}/streams`, { params }).then((r) => r.data),
  url: (playlistId: number, streamId: string) =>
    api.get<{ url: string; stream_type: string }>(`/live/${playlistId}/streams/${streamId}/url`).then((r) => r.data),
};

// VOD API
export const vodApi = {
  categories: (playlistId: number) =>
    api.get<Category[]>(`/vod/${playlistId}/categories`).then((r) => r.data),
  streams: (
    playlistId: number,
    params?: {
      category_id?: string;
      language?: string;
      genre?: string;
      cast?: string;
      rating_min?: number;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) => api.get<VodStream[]>(`/vod/${playlistId}/streams`, { params }).then((r) => r.data),
  get: (playlistId: number, streamId: string) =>
    api.get<VodStream>(`/vod/${playlistId}/streams/${streamId}`).then((r) => r.data),
  watch: (playlistId: number, streamId: string) =>
    api.get<{ url: string; stream_type: string }>(`/vod/${playlistId}/streams/${streamId}/watch`).then((r) => r.data),
  download: (playlistId: number, streamId: string, language: string) =>
    api.post<Download>(`/vod/${playlistId}/streams/${streamId}/download`, { language }).then((r) => r.data),
};

// Series API
export const seriesApi = {
  categories: (playlistId: number) =>
    api.get<Category[]>(`/series/${playlistId}/categories`).then((r) => r.data),
  list: (
    playlistId: number,
    params?: { category_id?: string; language?: string; genre?: string; cast?: string; rating_min?: number; search?: string; limit?: number; offset?: number; ids?: string }
  ) => api.get<Series[]>(`/series/${playlistId}`, { params }).then((r) => r.data),
  genres: (playlistId: number) =>
    api.get<string[]>(`/series/${playlistId}/genres`).then((r) => r.data),
  actors: (playlistId: number) =>
    api.get<string[]>(`/series/${playlistId}/actors`).then((r) => r.data),
  get: (playlistId: number, seriesId: string) =>
    api.get<Series>(`/series/${playlistId}/${seriesId}`).then((r) => r.data),
  tracking: (playlistId: number, seriesId: string) =>
    api.get<Tracking | null>(`/series/${playlistId}/${seriesId}/tracking`).then((r) => r.data),
  track: (playlistId: number, seriesId: string, data: { language: string; seasons: number[] | string }) =>
    api.post<Tracking>(`/series/${playlistId}/${seriesId}/track`, data).then((r) => r.data),
  untrack: (playlistId: number, seriesId: string) =>
    api.delete(`/series/${playlistId}/${seriesId}/track`),
  watchEpisode: (playlistId: number, seriesId: string, episodeId: string) =>
    api.get<{ url: string; stream_type: string }>(`/series/${playlistId}/${seriesId}/episodes/${episodeId}/watch`).then((r) => r.data),
  download: (
    playlistId: number,
    seriesId: string,
    data: { language: string; season_num?: number; episode_ids?: string[] }
  ) => api.post<Download[]>(`/series/${playlistId}/${seriesId}/download`, data).then((r) => r.data),
  patchEpisode: (playlistId: number, seriesId: string, episodeId: string, data: { monitored: boolean }) =>
    api.patch<Episode>(`/series/${playlistId}/${seriesId}/episodes/${episodeId}`, data).then((r) => r.data),
};

// Favorites API
export const favoritesApi = {
  list: (playlistId: number, contentType?: "series" | "vod") =>
    api.get<Favorite[]>("/favorites", { params: { playlist_id: playlistId, content_type: contentType } }).then((r) => r.data),
  add: (data: { playlist_id: number; content_type: "series" | "vod"; item_id: string }) =>
    api.post<Favorite>("/favorites", data).then((r) => r.data),
  remove: (params: { playlist_id: number; content_type: "series" | "vod"; item_id: string }) =>
    api.delete("/favorites", { params }),
};

// Downloads API
export const downloadsApi = {
  list: (params?: { status?: string; content_type?: string }) =>
    api.get<Download[]>("/downloads", { params }).then((r) => r.data),
  pause: (id: number) => api.post<Download>(`/downloads/${id}/pause`).then((r) => r.data),
  resume: (id: number) => api.post<Download>(`/downloads/${id}/resume`).then((r) => r.data),
  delete: (id: number, deleteFile = false) =>
    api.delete(`/downloads/${id}`, { params: { delete_file: deleteFile } }),
};

// Settings API
export interface DownloadSettings {
  max_concurrent_downloads: number;
  download_chunks: number;
  speed_limit_bps: number;
}

export const settingsApi = {
  get: () => api.get<DownloadSettings>("/settings").then((r) => r.data),
  update: (data: DownloadSettings) => api.put<DownloadSettings>("/settings", data).then((r) => r.data),
};

// Helpers
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`;
}
