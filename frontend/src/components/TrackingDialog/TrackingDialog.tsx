import { useState } from "react";
import { X, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import type { Series, Season, Tracking } from "../../api/client";
import { seriesApi } from "../../api/client";

interface TrackingDialogProps {
  series: Series;
  seasons: Season[];
  tracking?: Tracking | null;
  onClose: () => void;
  onTracked: () => void;
}

const LANGUAGES = ["Arabic", "English", "Turkish", "French", "Spanish", "German", "Italian", "Portuguese", "Other"];

export function TrackingDialog({ series, seasons, tracking, onClose, onTracked }: TrackingDialogProps) {
  const [language, setLanguage] = useState(tracking?.language ?? "English");
  const [trackAll, setTrackAll] = useState(tracking?.track_all_seasons ?? true);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>(tracking?.seasons_json ?? []);
  const [loading, setLoading] = useState(false);

  const toggleSeason = (num: number) => {
    setSelectedSeasons((prev) =>
      prev.includes(num) ? prev.filter((s) => s !== num) : [...prev, num]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await seriesApi.track(series.playlist_id, series.series_id, {
        language,
        seasons: trackAll ? "all" : selectedSeasons,
      });
      const count = result.queued_count ?? 0;
      toast.success(
        count > 0
          ? `Now tracking ${series.name} · ${count} episode${count === 1 ? "" : "s"} queued`
          : `Now tracking ${series.name}`
      );
      onTracked();
      onClose();
    } catch {
      toast.error("Failed to save tracking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md mx-4 p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookmarkPlus size={18} className="text-purple-400" />
            <h2 className="text-white font-semibold">Track Series</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-white/70 text-sm mb-5 line-clamp-2">{series.name}</p>

        {/* Language */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Download Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full glass-input"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-gray-900">
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Season selection */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Seasons
          </label>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={trackAll}
              onChange={(e) => setTrackAll(e.target.checked)}
              className="accent-purple-500"
            />
            <span className="text-sm text-white/80">Track all seasons (including future)</span>
          </label>

          {!trackAll && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {seasons.map((s) => (
                <button
                  key={s.season_num}
                  onClick={() => toggleSeason(s.season_num)}
                  className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSeasons.includes(s.season_num)
                      ? "btn-accent"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  S{s.season_num}
                </button>
              ))}
              {seasons.length === 0 && (
                <p className="col-span-4 text-sm text-white/40">No seasons available</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (!trackAll && selectedSeasons.length === 0)}
            className="flex-1 py-2.5 rounded-lg btn-accent text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Saving..." : "Track Series"}
          </button>
        </div>
      </div>
    </div>
  );
}
