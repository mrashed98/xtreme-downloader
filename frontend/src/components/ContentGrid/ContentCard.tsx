import { Star, Play, Download, Heart } from "lucide-react";
import type { ReactNode } from "react";

interface ContentCardProps {
  title: string;
  subtitle?: string;
  image?: string | null;
  rating?: number | null;
  badge?: string;
  badgeColor?: "purple" | "pink" | "green" | "gray";
  isFavorited?: boolean;
  onPlay?: () => void;
  onDownload?: () => void;
  onFavorite?: () => void;
  onClick?: () => void;
  footer?: ReactNode;
}

export function ContentCard({
  title,
  subtitle,
  image,
  rating,
  badge,
  badgeColor = "purple",
  isFavorited,
  onPlay,
  onDownload,
  onFavorite,
  onClick,
  footer,
}: ContentCardProps) {
  return (
    <div
      className="glass-card group cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_60px_rgba(5,9,16,0.35)] animate-slide-up"
      onClick={onClick}
    >
      <div className="relative aspect-[0.75] overflow-hidden bg-white/5">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-card">
            <Play size={32} className="text-white/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,11,19,0.94)] via-[rgba(7,11,19,0.12)] to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_42%)] opacity-80" />

        <div className="hover-reveal absolute inset-0 flex items-center justify-center gap-3 bg-[rgba(8,13,22,0.35)]">
          {onPlay && (
            <button
              className="rounded-full p-3.5 shadow-lg btn-accent"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            >
              <Play size={16} fill="white" />
            </button>
          )}
          {onDownload && (
            <button
              className="rounded-full bg-white/20 p-3.5 text-white transition-colors hover:bg-white/30"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
            >
              <Download size={16} />
            </button>
          )}
        </div>

        {onFavorite && (
          <button
            className={`hover-reveal absolute left-3 top-3 z-10 rounded-full p-2 transition-colors ${
              isFavorited
                ? "!opacity-100 bg-rose-500/80 text-white"
                : "bg-black/45 text-white/55 hover:text-rose-300"
            }`}
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={12} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        )}

        {badge && (
          <div className={`absolute top-3 ${onFavorite ? "left-12" : "left-3"}`}>
            <span className={`badge badge-${badgeColor}`}>{badge}</span>
          </div>
        )}

        {rating != null && rating > 0 && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
            <Star size={10} className="fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-white">{rating.toFixed(1)}</span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="rounded-[1.35rem] border border-white/10 bg-[rgba(5,10,18,0.72)] px-3 py-2 backdrop-blur-md">
            <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
            {subtitle && <p className="mt-1 line-clamp-1 text-xs text-white/58">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="p-3 pt-2">
        {footer && <div>{footer}</div>}
      </div>
    </div>
  );
}
