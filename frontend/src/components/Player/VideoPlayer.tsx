import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, ChevronRight, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
import { useAppStore } from "../../store";

const LOAD_TIMEOUT_MS = 15000;

export function VideoPlayer() {
  const { player, closePlayer, nextTrack, prevTrack } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showUpNext, setShowUpNext] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const currentItem = player.queue[player.queueIndex] ?? null;
  const hasNext = player.queueIndex < player.queue.length - 1;
  const hasPrev = player.queueIndex > 0;
  const nextItem = hasNext ? player.queue[player.queueIndex + 1] : null;

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const teardownPlayback = () => {
    clearLoadTimeout();

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  };

  useEffect(() => {
    if (!player.isOpen || !currentItem || !videoRef.current) return;

    const video = videoRef.current;
    setShowUpNext(false);
    setIsLoading(true);
    setPlaybackError(null);
    clearCountdown();
    teardownPlayback();

    const failPlayback = (message: string) => {
      clearLoadTimeout();
      setIsLoading(false);
      setPlaybackError(message);
    };

    const markLoaded = () => {
      clearLoadTimeout();
      setIsLoading(false);
      setPlaybackError(null);
    };

    const tryPlay = () => {
      video.play().catch(() => {});
    };

    const videoErrorHandler = () => {
      failPlayback("This stream could not be played. The provider URL may be invalid, blocked, or unsupported.");
    };

    video.addEventListener("loadedmetadata", markLoaded);
    video.addEventListener("canplay", markLoaded);
    video.addEventListener("error", videoErrorHandler);

    loadTimeoutRef.current = setTimeout(() => {
      failPlayback("The player timed out while loading this stream.");
    }, LOAD_TIMEOUT_MS);

    if (currentItem.type === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        markLoaded();
        tryPlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && currentItem.fallbackUrl) {
          teardownPlayback();
          video.src = currentItem.fallbackUrl;
          video.addEventListener("loadedmetadata", markLoaded, { once: true });
          video.addEventListener("canplay", markLoaded, { once: true });
          tryPlay();
          return;
        }

        failPlayback(`Playback failed: ${data.details || "stream error"}.`);
      });

      hls.loadSource(currentItem.url);
      hls.attachMedia(video);
    } else if (currentItem.type === "hls" && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = currentItem.url;
      tryPlay();
    } else {
      video.src = currentItem.url;
      tryPlay();
    }

    return () => {
      video.removeEventListener("loadedmetadata", markLoaded);
      video.removeEventListener("canplay", markLoaded);
      video.removeEventListener("error", videoErrorHandler);
      teardownPlayback();
    };
  }, [player.isOpen, player.queueIndex, currentItem?.url, currentItem?.fallbackUrl, currentItem?.type, retryNonce]);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const handleEnded = () => {
      if (hasNext) {
        setShowUpNext(true);
        setCountdown(8);
        clearCountdown();
        let n = 8;
        countdownRef.current = setInterval(() => {
          n--;
          setCountdown(n);
          if (n <= 0) {
            clearCountdown();
            nextTrack();
          }
        }, 1000);
      }
    };

    const handleTimeUpdate = () => {
      if (hasNext && video.duration > 0 && video.currentTime >= video.duration - 15) {
        setShowUpNext((prev) => prev || true);
      }
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [hasNext, nextTrack, player.queueIndex]);

  const handleNext = () => {
    clearCountdown();
    setShowUpNext(false);
    nextTrack();
  };

  const handlePrev = () => {
    clearCountdown();
    setShowUpNext(false);
    prevTrack();
  };

  const handleDismissUpNext = () => {
    clearCountdown();
    setShowUpNext(false);
  };

  const handleRetry = () => {
    teardownPlayback();
    setRetryNonce((n) => n + 1);
  };

  if (!player.isOpen || !currentItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
      <div
        className="relative mx-4 w-full max-w-5xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-player-title"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {player.queue.length > 1 && (
              <span className="flex-shrink-0 text-xs text-white/40">
                {player.queueIndex + 1} / {player.queue.length}
              </span>
            )}
            <h3 id="video-player-title" className="truncate font-medium text-white">{currentItem.title}</h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {hasPrev && (
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Previous"
                aria-label="Play previous item"
              >
                <SkipBack size={18} />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Next episode"
                aria-label="Play next item"
              >
                <SkipForward size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={closePlayer}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close player"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls
            playsInline
          />

          {isLoading && !playbackError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-sm text-white/70">Loading stream…</p>
            </div>
          )}

          {playbackError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/72 p-6">
              <div className="glass-card max-w-md p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                  <AlertCircle size={22} />
                </div>
                <h4 className="text-base font-semibold text-white">Playback could not start</h4>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{playbackError}</p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                  >
                    <RotateCcw size={14} />
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={closePlayer}
                    className="rounded-xl px-4 py-2 text-sm font-medium btn-accent"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showUpNext && nextItem && !playbackError && (
            <div className="absolute bottom-16 right-4 w-64 animate-slide-up glass-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="mb-0.5 text-xs text-white/50">Up Next in {countdown}s</p>
                  <p className="truncate text-sm font-medium text-white">{nextItem.title}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDismissUpNext}
                  className="flex-shrink-0 text-white/40 hover:text-white"
                  aria-label="Dismiss up next"
                >
                  <X size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium btn-accent"
              >
                <ChevronRight size={14} />
                Play Now
              </button>
            </div>
          )}
        </div>

        {player.queue.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {player.queue.map((item, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  clearCountdown();
                  setShowUpNext(false);
                  setRetryNonce(0);
                  const store = useAppStore.getState();
                  store.openQueue(store.player.queue, i);
                }}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  i === player.queueIndex
                    ? "btn-accent font-medium"
                    : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
