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
      className="glass-card overflow-hidden cursor-pointer group transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-900/20 animate-slide-up"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[2/3] bg-white/5 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-card">
            <Play size={32} className="text-white/30" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          {onPlay && (
            <button
              className="p-3 rounded-full btn-accent shadow-lg"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            >
              <Play size={16} fill="white" />
            </button>
          )}
          {onDownload && (
            <button
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
            >
              <Download size={16} />
            </button>
          )}
        </div>

        {/* Favorite button — always visible in top-left when onFavorite is provided */}
        {onFavorite && (
          <button
            className={`absolute top-2 left-2 p-1.5 rounded-full transition-colors z-10 ${
              isFavorited
                ? "bg-pink-500/80 text-white"
                : "bg-black/50 text-white/50 opacity-0 group-hover:opacity-100 hover:text-pink-400"
            }`}
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={12} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        )}

        {/* Badge */}
        {badge && (
          <div className={`absolute top-2 ${onFavorite ? "left-10" : "left-2"}`}>
            <span className={`badge badge-${badgeColor}`}>{badge}</span>
          </div>
        )}

        {/* Rating */}
        {rating != null && rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-white font-medium">{rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-snug">{title}</h3>
        {subtitle && (
          <p className="text-xs text-white/50 mt-1 line-clamp-1">{subtitle}</p>
        )}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
