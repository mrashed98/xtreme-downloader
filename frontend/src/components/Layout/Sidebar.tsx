import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAppStore } from "../../store";
import { navItems } from "./navItems";

interface NavListProps {
  expanded: boolean;
  activeDownloadCount: number;
  onNavigate?: () => void;
}

function NavList({ expanded, activeDownloadCount, onNavigate }: NavListProps) {
  return (
    <nav className="flex-1 space-y-1 px-2">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200 group ${
              isActive
                ? "bg-white text-slate-900 shadow-[0_14px_34px_rgba(255,255,255,0.12)]"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`
          }
          aria-label={label}
          title={expanded ? undefined : label}
        >
          <div className="relative">
            <Icon size={18} />
            {label === "Downloads" && activeDownloadCount > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.65rem] font-bold text-slate-950"
                aria-label={`${activeDownloadCount} active downloads`}
              >
                {activeDownloadCount > 9 ? "9+" : activeDownloadCount}
              </span>
            )}
          </div>
          {expanded && <span className="text-sm font-semibold">{label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const activeDownloadCount = useAppStore((s) => s.activeDownloadCount);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarMobileOpen = useAppStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useAppStore((s) => s.setSidebarMobileOpen);
  const location = useLocation();

  useEffect(() => {
    if (sidebarMobileOpen) setSidebarMobileOpen(false);
  }, [location.pathname, setSidebarMobileOpen, sidebarMobileOpen]);

  useEffect(() => {
    if (!sidebarMobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarMobileOpen, setSidebarMobileOpen]);

  const desktopExpanded = !sidebarCollapsed;

  return (
    <>
      <aside
        className={`app-sidebar app-sidebar--desktop hidden flex-shrink-0 flex-col py-6 transition-[width] duration-300 lg:flex ${
          desktopExpanded ? "w-64" : "w-20"
        }`}
      >
        {desktopExpanded ? (
          <div className="mb-8 px-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.34em] text-white/35">
              Streaming Suite
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">Xtreme DL</h1>
            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Sync playlists, explore channels, and control downloads from one elegant workspace.
            </p>
          </div>
        ) : (
          <div className="mb-8 flex justify-center px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
              <span className="text-sm font-semibold text-white">X</span>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          <NavList expanded={desktopExpanded} activeDownloadCount={activeDownloadCount} />

          <div className="mt-2 px-2">
            <button
              onClick={toggleSidebar}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={desktopExpanded ? "Collapse sidebar" : "Expand sidebar"}
              title={desktopExpanded ? "Collapse" : "Expand"}
            >
              {desktopExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar fixed left-0 top-0 z-50 flex h-full w-[88vw] max-w-sm flex-col py-6 transition-transform duration-300 lg:hidden ${
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="mb-6 flex items-center justify-between px-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.34em] text-white/35">
              Mobile Menu
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">Xtreme DL</h1>
            <p className="mt-1 text-sm text-white/45">Quick access to your media control hub.</p>
          </div>
          <button
            onClick={() => setSidebarMobileOpen(false)}
            className="rounded-2xl p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <NavList
          expanded
          activeDownloadCount={activeDownloadCount}
          onNavigate={() => setSidebarMobileOpen(false)}
        />
      </aside>
    </>
  );
}
