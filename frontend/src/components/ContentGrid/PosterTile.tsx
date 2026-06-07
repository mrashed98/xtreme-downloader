import { Heart, Play } from "lucide-react";
import { PosterCard, toneFor } from "../ds";

/** Poster grid tile — DS PosterCard + favorite heart + hover play overlay. */
export function PosterTile({
  title,
  eyebrow,
  image,
  rating,
  isFavorited,
  onFavorite,
  onOpen,
  onPlay,
}: {
  title: string;
  eyebrow?: string;
  image?: string | null;
  rating?: number | null;
  isFavorited?: boolean;
  onFavorite?: () => void;
  onOpen?: () => void;
  onPlay?: () => void;
}) {
  return (
    <div className="xpos-wrap xrise">
      <PosterCard
        title={title}
        eyebrow={eyebrow}
        tone={toneFor(title)}
        image={image}
        badge={rating != null && rating > 0 ? { variant: "top", label: `★ ${rating.toFixed(1)}` } : undefined}
        onClick={onOpen}
      />
      {onFavorite ? (
        <button
          className={"xpos-heart" + (isFavorited ? " is-fav" : "")}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart fill={isFavorited ? "currentColor" : "none"} />
        </button>
      ) : null}
      {onPlay ? (
        <div className="xpos-play">
          <div
            className="xpos-play__btn"
            role="button"
            aria-label="Play"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            <Play fill="currentColor" stroke="none" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
