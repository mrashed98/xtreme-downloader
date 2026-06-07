/* ============================================================
   Xtreme Design System — React primitives.
   Visuals live in styles/globals.css; these are thin wrappers
   ported from the design-system bundle (XtremeDesignSystem_511240).
   ============================================================ */
import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type CSSProperties } from "react";
import { ChevronDown, Search as SearchIcon, X, ArrowRight } from "lucide-react";

/* ---------------- Button ---------------- */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "hot";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  icon = null,
  iconRight = null,
  className = "",
  ...rest
}: ButtonProps) {
  const cls = ["xbtn", `xbtn--${variant}`, `xbtn--${size}`, block ? "xbtn--block" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {icon ? <span className="xbtn__ico" aria-hidden="true">{icon}</span> : null}
      {children}
      {iconRight ? <span className="xbtn__ico" aria-hidden="true">{iconRight}</span> : null}
    </button>
  );
}

/* ---------------- IconButton ---------------- */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "solid" | "plain";
  label: string;
}

export function IconButton({ children, size = "md", variant = "glass", label, className = "", ...rest }: IconButtonProps) {
  const cls = ["xicobtn", `xicobtn--${size}`, `xicobtn--${variant}`, className].filter(Boolean).join(" ");
  return (
    <button className={cls} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/* ---------------- Input ---------------- */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  hint?: string;
  error?: string;
  pill?: boolean;
}

export function Input({ label, icon = null, hint, error, pill = false, id, className = "", ...rest }: InputProps) {
  const inputCls = ["xinput", icon ? "xinput--ico" : "", pill ? "xinput--pill" : "", error ? "xinput--err" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="xfield">
      {label ? (
        <label className="xfield__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="xinput-wrap">
        {icon ? <span className="xinput-wrap__ico" aria-hidden="true">{icon}</span> : null}
        <input id={id} className={inputCls} aria-invalid={!!error} {...rest} />
      </div>
      {error ? (
        <span className="xfield__hint xfield__hint--err">{error}</span>
      ) : hint ? (
        <span className="xfield__hint">{hint}</span>
      ) : null}
    </div>
  );
}

/* search input shorthand (pill + icon) */
export function SearchInput(props: Omit<InputProps, "icon" | "pill">) {
  return <Input pill icon={<SearchIcon size={18} />} {...props} />;
}

/* ---------------- Select (native, pill) ---------------- */
interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  width,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (SelectOption | string)[];
  width?: number | string;
  ariaLabel?: string;
}) {
  return (
    <div className="xselect" style={{ width }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <ChevronDown className="xselect__caret" aria-hidden="true" />
    </div>
  );
}

/* ---------------- Tabs ---------------- */
interface TabItem {
  value: string;
  label: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
}: {
  items: (TabItem | string)[];
  value: string;
  onChange: (v: string) => void;
  variant?: "underline" | "segmented";
}) {
  const cls = ["xtabs", variant === "segmented" ? "xtabs--seg" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} role="tablist">
      {items.map((it) => {
        const val = typeof it === "string" ? it : it.value;
        const label = typeof it === "string" ? it : it.label;
        const active = val === value;
        return (
          <button
            key={val}
            role="tab"
            aria-selected={active}
            className={["xtab", active ? "xtab--active" : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(val)}
          >
            {label}
            <span className="xtab__ink" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Badge / CodecTag ---------------- */
export function Badge({
  variant = "soft",
  children,
  style,
}: {
  variant?: "live" | "new" | "top" | "soft";
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`xbadge xbadge--${variant}`} style={style}>
      {variant === "live" ? <span className="xbadge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function CodecTag({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "accent" | "solid";
}) {
  if (!items.length) return null;
  return (
    <span className="xcodecs">
      {items.map((c, i) => (
        <span key={i} className={`xcodec xcodec--${variant}`}>
          {c}
        </span>
      ))}
    </span>
  );
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  value = 0,
  height = 4,
  variant = "volt",
}: {
  value?: number;
  height?: number;
  variant?: "volt" | "hot";
}) {
  const cls = ["xprog", variant === "hot" ? "xprog--hot" : ""].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      style={{ "--_h": `${height}px` } as CSSProperties}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="xprog__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ---------------- Avatar ---------------- */
const PROFILE_TONES = ["var(--volt-500)", "var(--hot-500)", "var(--surge-500)", "var(--warn-500)", "var(--pos-500)"];

export function Avatar({
  name = "",
  size = 44,
  round = false,
  tone,
}: {
  name?: string;
  size?: number;
  round?: boolean;
  tone?: string;
}) {
  const initial = (name.trim()[0] || "X").toUpperCase();
  const idx = name ? name.charCodeAt(0) % PROFILE_TONES.length : 0;
  const bg = tone || PROFILE_TONES[idx];
  return (
    <span
      className={["xavatar", round ? "xavatar--round" : ""].filter(Boolean).join(" ")}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}

/* ---------------- Tones (typographic poster placeholders) ---------------- */
export const TONE_BG: Record<string, string> = {
  ink: "var(--ink-800)",
  volt: "var(--volt-500)",
  hot: "var(--hot-500)",
  surge: "var(--surge-500)",
  warn: "var(--warn-500)",
  pos: "var(--pos-500)",
};
const LIGHT_TONES = new Set(["volt", "hot", "warn", "pos"]);
const TONE_KEYS = ["volt", "hot", "surge", "warn", "pos", "ink"];

export function toneFor(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return TONE_KEYS[Math.abs(h) % TONE_KEYS.length];
}

export function toneFg(tone: string): string {
  return LIGHT_TONES.has(tone) ? "var(--ink-1000)" : "var(--ink-50)";
}

/* ---------------- PosterCard ---------------- */
interface PosterBadge {
  variant?: "live" | "new" | "top";
  label: string;
}

export function PosterCard({
  title,
  eyebrow,
  tone = "ink",
  image,
  badge,
  titleSize = 22,
  onClick,
}: {
  title: string;
  eyebrow?: string;
  tone?: string;
  image?: string | null;
  badge?: PosterBadge;
  titleSize?: number;
  onClick?: () => void;
}) {
  const onLight = !image && LIGHT_TONES.has(tone);
  const cls = ["xposter", onLight ? "xposter--onlight" : ""].filter(Boolean).join(" ");
  return (
    <button
      className={cls}
      style={{ "--_title": `${titleSize}px`, background: image ? undefined : TONE_BG[tone] } as CSSProperties}
      onClick={onClick}
    >
      {image ? <span className="xposter__art" style={{ backgroundImage: `url(${image})` }} /> : null}
      {!onLight ? <span className="xposter__scrim" /> : null}
      <span className="xposter__top">
        <span />
        {badge ? <span className={`xposter__badge xposter__badge--${badge.variant || "top"}`}>{badge.label}</span> : null}
      </span>
      <span className="xposter__body">
        {eyebrow ? <span className="xposter__eyebrow">{eyebrow}</span> : null}
        <span className="xposter__title">{title}</span>
      </span>
    </button>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  wide,
}: {
  title?: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="xoverlay" onClick={onClose}>
      <div className={"xmodal" + (wide ? " xmodal--detail" : "")} onClick={(e) => e.stopPropagation()}>
        {!wide ? (
          <>
            <div className="xmodal__head">
              <div className="xmodal__titles">
                {eyebrow ? <span className="xmodal__eyebrow">{eyebrow}</span> : null}
                <h3 className="xmodal__title">{title}</h3>
              </div>
              <button className="xmodal__close" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="xmodal__body">{children}</div>
            {footer ? <div className="xmodal__foot">{footer}</div> : null}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/* ---------------- StatCard / SectionHead / EmptyState ---------------- */
export function StatCard({ icon, tone, num, label }: { icon: ReactNode; tone: string; num: number | string; label: string }) {
  return (
    <div className="xstat">
      <div className={"xstat__ico tone-" + tone}>{icon}</div>
      <div className="xstat__num">{num}</div>
      <div className="xstat__lbl">{label}</div>
    </div>
  );
}

export function SectionHead({ title, more, onMore }: { title: string; more?: string; onMore?: () => void }) {
  return (
    <div className="xsec__head">
      <h2 className="xsec__title">{title}</h2>
      {more ? (
        <button className="xsec__more" onClick={onMore}>
          {more}
          <ArrowRight size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="xempty">
      <div className="xempty__ico">{icon}</div>
      <div className="xempty__title">{title}</div>
      {sub ? <div className="xempty__sub">{sub}</div> : null}
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="xloading">
      <div className="xspinner" />
    </div>
  );
}

/* ---------------- Bolt (logo mark) ---------------- */
export function Bolt({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M18 2 6 18h7l-3 12 16-18h-8z" fill="var(--volt-500)" />
    </svg>
  );
}
