import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, SkipForward, SkipBack, ChevronRight } from "lucide-react";
import { useAppStore } from "../../store";

export function VideoPlayer() {
  const { player, closePlayer, nextTrack, prevTrack } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showUpNext, setShowUpNext] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentItem = player.queue[player.queueIndex] ?? null;
  const hasNext = player.queueIndex < player.queue.length - 1;
  const hasPrev = player.queueIndex > 0;
  const nextItem = hasNext ? player.queue[player.queueIndex + 1] : null;

  // Load the current item whenever it changes
  useEffect(() => {
    if (!player.isOpen || !currentItem || !videoRef.current) return;

    const video = videoRef.current;
    setShowUpNext(false);
    clearCountdown();

    // Tear down previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentItem.type === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(currentItem.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hlsRef.current = hls;
    } else if (currentItem.type === "hls" && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = currentItem.url;
      video.play().catch(() => {});
    } else {
      video.src = currentItem.url;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [player.isOpen, player.queueIndex, currentItem?.url]);

  // "Up Next" countdown when video ends
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const handleEnded = () => {
      if (hasNext) {
        setShowUpNext(true);
        setCountdown(8);
        startCountdown();
      }
    };
    const handleTimeUpdate = () => {
      // Show "up next" card in the last 15 seconds
      if (hasNext && video.duration > 0 && video.currentTime >= video.duration - 15) {
        if (!showUpNext) setShowUpNext(true);
      }
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [hasNext, showUpNext, player.queueIndex]);

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = () => {
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
  };

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

  if (!player.isOpen || !currentItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {player.queue.length > 1 && (
              <span className="text-xs text-white/40 flex-shrink-0">
                {player.queueIndex + 1} / {player.queue.length}
              </span>
            )}
            <h3 className="text-white font-medium truncate">{currentItem.title}</h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasPrev && (
              <button
                onClick={handlePrev}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Previous"
              >
                <SkipBack size={18} />
              </button>
            )}
            {hasNext && (
              <button
                onClick={handleNext}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Next episode"
              >
                <SkipForward size={18} />
              </button>
            )}
            <button
              onClick={closePlayer}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            playsInline
          />

          {/* "Up Next" overlay */}
          {showUpNext && nextItem && (
            <div className="absolute bottom-16 right-4 glass-card p-3 w-64 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-white/50 mb-0.5">Up Next in {countdown}s</p>
                  <p className="text-sm text-white font-medium truncate">{nextItem.title}</p>
                </div>
                <button
                  onClick={handleDismissUpNext}
                  className="text-white/40 hover:text-white flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              <button
                onClick={handleNext}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg btn-accent text-sm font-medium"
              >
                <ChevronRight size={14} />
                Play Now
              </button>
            </div>
          )}
        </div>

        {/* Episode strip for queue with > 1 item */}
        {player.queue.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {player.queue.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  clearCountdown();
                  setShowUpNext(false);
                  // Jump to arbitrary queue index
                  const store = useAppStore.getState();
                  store.openQueue(store.player.queue, i);
                }}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors ${
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
