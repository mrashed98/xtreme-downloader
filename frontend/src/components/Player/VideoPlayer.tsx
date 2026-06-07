import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  AlertCircle,
  ChevronDown,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAppStore } from "../../store";
import { Button } from "../ds";

const LOAD_TIMEOUT_MS = 15000;
const CHROME_HIDE_MS = 3200;

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function VideoPlayer() {
  const { player, closePlayer, nextTrack, prevTrack } = useAppStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showUpNext, setShowUpNext] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChrome, setShowChrome] = useState(true);

  const currentItem = player.queue[player.queueIndex] ?? null;
  const hasNext = player.queueIndex < player.queue.length - 1;
  const hasPrev = player.queueIndex > 0;
  const nextItem = hasNext ? player.queue[player.queueIndex + 1] : null;
  const isLive = !Number.isFinite(duration) || duration === 0;

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

  /* chrome auto-hide */
  const wake = useCallback(() => {
    setShowChrome(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowChrome(false), CHROME_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!player.isOpen) return;
    wake();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [player.isOpen, player.queueIndex, wake]);

  /* load + attach stream */
  useEffect(() => {
    if (!player.isOpen || !currentItem || !videoRef.current) return;

    const video = videoRef.current;
    setShowUpNext(false);
    setIsLoading(true);
    setPlaybackError(null);
    setElapsed(0);
    setDuration(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isOpen, player.queueIndex, currentItem?.url, currentItem?.fallbackUrl, currentItem?.type, retryNonce]);

  /* playback state + progress + up-next */
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
      setElapsed(video.currentTime);
      if (hasNext && Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 15) {
        setShowUpNext((prev) => prev || true);
      }
    };

    const handleDuration = () => setDuration(video.duration);
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDuration);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDuration);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [hasNext, nextTrack, player.queueIndex]);

  if (!player.isOpen || !currentItem) return null;

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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    wake();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(duration) || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const pct = !isLive && duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const chromeVisible = showChrome || !playing || isLoading || !!playbackError;

  return (
    <div className="xplayover" ref={rootRef} onMouseMove={wake} onTouchStart={wake}>
      <video ref={videoRef} className="xplay__video" playsInline onClick={togglePlay} />

      {isLoading && !playbackError && (
        <div className="xplay__loading">
          <div className="xplay__spinner" />
          <div className="xplay__loadtxt">Loading the good stuff…</div>
        </div>
      )}

      {!isLoading && !playing && !playbackError && !showUpNext && (
        <div className="xplay__center">
          <button className="xplay__big" onClick={togglePlay} aria-label="Play">
            <Play fill="currentColor" stroke="none" />
          </button>
        </div>
      )}

      <div className={"xplay__chrome" + (chromeVisible ? "" : " is-hidden")}>
        <div className="xplay__top">
          <button className="xplay__close" onClick={closePlayer} aria-label="Close player">
            <ChevronDown size={22} />
          </button>
          <div className="xplay__heading">
            <span className="xplay__eyebrow">
              {isLive
                ? "● Live · Streaming now"
                : player.queue.length > 1
                ? `Now playing · ${player.queueIndex + 1}/${player.queue.length}`
                : "Now playing"}
            </span>
            <span className="xplay__name">{currentItem.title}</span>
          </div>
        </div>

        <div className="xplay__bottom">
          {!isLive && (
            <div className="xplay__scrub" onClick={scrub}>
              <div className="xplay__scrubfill" style={{ width: pct + "%" }} />
              <div className="xplay__knob" style={{ left: pct + "%" }} />
            </div>
          )}
          <div className="xplay__ctlrow">
            <div className="xplay__ctll">
              <button className="xpc" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause /> : <Play fill="currentColor" stroke="none" />}
              </button>
              {player.queue.length > 1 && (
                <>
                  <button className="xpc" onClick={handlePrev} disabled={!hasPrev} aria-label="Previous">
                    <SkipBack fill="currentColor" stroke="none" />
                  </button>
                  <button className="xpc" onClick={handleNext} disabled={!hasNext} aria-label="Next">
                    <SkipForward fill="currentColor" stroke="none" />
                  </button>
                </>
              )}
              {isLive ? (
                <span className="xplay__eyebrow" style={{ color: "var(--hot-500)" }}>
                  ● LIVE
                </span>
              ) : (
                <span className="xplay__time">
                  {fmtTime(elapsed)} <span>/ {fmtTime(duration)}</span>
                </span>
              )}
            </div>
            <div className="xplay__ctlr">
              <button className="xpc" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX /> : <Volume2 />}
              </button>
              <button className="xpc" onClick={toggleFullscreen} aria-label="Fullscreen">
                <Maximize />
              </button>
            </div>
          </div>
        </div>
      </div>

      {playbackError && (
        <div className="xplay__err">
          <div className="xplay__errcard">
            <span className="xplay__errico">
              <AlertCircle size={24} />
            </span>
            <h4>Playback could not start</h4>
            <p>{playbackError}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <Button variant="outline" icon={<RotateCcw size={16} />} onClick={handleRetry}>
                Retry
              </Button>
              <Button variant="primary" onClick={closePlayer}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showUpNext && nextItem && !playbackError && (
        <div className="xupnext">
          <div className="xupnext__eyebrow">
            <span>Up Next · auto-play in {countdown}s</span>
            <span className="xupnext__count">
              {player.queueIndex + 2}/{player.queue.length}
            </span>
          </div>
          <div className="xupnext__body">
            <div className="xupnext__thumb" />
            <div style={{ minWidth: 0 }}>
              <div className="xupnext__title">{nextItem.title}</div>
              <div className="xupnext__sub">Episode {player.queueIndex + 2} of {player.queue.length}</div>
            </div>
          </div>
          <div className="xupnext__actions">
            <Button variant="primary" size="sm" block icon={<Play size={16} fill="currentColor" stroke="none" />} onClick={handleNext}>
              Play now
            </Button>
            <Button variant="outline" size="sm" onClick={handleDismissUpNext}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
