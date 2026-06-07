import { useState } from "react";
import { toast } from "sonner";
import type { Series, Season, Tracking } from "../../api/client";
import { seriesApi } from "../../api/client";
import { Button, Modal, Select } from "../ds";

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
    setSelectedSeasons((prev) => (prev.includes(num) ? prev.filter((s) => s !== num) : [...prev, num]));
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
    <Modal
      eyebrow="Auto-download"
      title="Track Series"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={loading || (!trackAll && selectedSeasons.length === 0)} onClick={handleSubmit}>
            {loading ? "Saving…" : "Track series"}
          </Button>
        </>
      }
    >
      <p style={{ color: "var(--text-secondary)", fontSize: 14.5, margin: 0 }}>
        New episodes of <b style={{ color: "var(--text-primary)" }}>{series.name}</b> will queue automatically.
      </p>

      <div className="xfield">
        <span className="xfield__label">Download language</span>
        <Select value={language} onChange={setLanguage} options={LANGUAGES} ariaLabel="Download language" />
      </div>

      <div className="xfield">
        <span className="xfield__label">Seasons</span>
        <label className="xcheckrow">
          <input type="checkbox" checked={trackAll} onChange={(e) => setTrackAll(e.target.checked)} />
          Track all seasons (including future)
        </label>

        {!trackAll && (
          <div className="xseasonchips" style={{ marginTop: 6 }}>
            {seasons.map((s) => (
              <button
                key={s.season_num}
                className={"xseasonchip" + (selectedSeasons.includes(s.season_num) ? " is-on" : "")}
                onClick={() => toggleSeason(s.season_num)}
              >
                S{s.season_num}
              </button>
            ))}
            {seasons.length === 0 && (
              <p style={{ gridColumn: "1/-1", fontSize: 13.5, color: "var(--text-tertiary)", margin: 0 }}>
                No seasons available
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
