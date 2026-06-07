import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Bolt, Button } from "../ds";

const DISMISS_KEY = "xtreme-a2hs-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac — check touch points too
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 900px)").matches;
}

/** Prompts mobile visitors to install the app to their home screen.
 *  Android/Chrome: native install via beforeinstallprompt.
 *  iOS Safari: instructional banner (no install API exists). */
export function AddToHomeScreen() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    if (isIos() && isMobileViewport()) {
      setIos(true);
      // Give the user a beat before nudging
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      if (!isMobileViewport()) return;
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  };

  if (!visible) return null;

  return (
    <div className="xa2hs" role="dialog" aria-label="Add to home screen">
      <span className="xa2hs__ico">
        <Bolt size={26} />
      </span>
      <div className="xa2hs__body">
        <div className="xa2hs__title">Get the full-screen app</div>
        {ios ? (
          <div className="xa2hs__sub">
            Tap <Share size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Share, then{" "}
            <b>
              <SquarePlus size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Add to Home Screen
            </b>
          </div>
        ) : (
          <div className="xa2hs__sub">Install Xtreme on your home screen — no buffering, no browser chrome.</div>
        )}
      </div>
      {!ios && (
        <Button variant="primary" size="sm" onClick={install}>
          Install
        </Button>
      )}
      <button className="xa2hs__close" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
