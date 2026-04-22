import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Tv, Film, Clapperboard, Download,
  PanelLeftClose, PanelLeftOpen, X,
} from "lucide-react";
import { useAppStore } from "../../store";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/series", icon: Clapperboard, label: "Series" },
  { to: "/downloads", icon: Download, label: "Downloads" },
];

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
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
              isActive
                ? "bg-gradient-accent text-white shadow-lg"
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
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-pink-500 rounded-full text-xs flex items-center justify-center text-white font-bold"
                aria-label={`${activeDownloadCount} active downloads`}
              >
                {activeDownloadCount > 9 ? "9+" : activeDownloadCount}
              </span>
            )}
          </div>
          {expanded && <span className="text-sm font-medium">{label}</span>}
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

  // Close mobile drawer on route change as safety net.
  useEffect(() => {
    if (sidebarMobileOpen) setSidebarMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close mobile drawer on Escape.
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
      {/* Desktop aside — lg+ only, always in flex flow */}
      <aside
        className={`hidden lg:flex flex-shrink-0 glass-card rounded-none border-r border-white/10 flex-col py-6 transition-[width] duration-200 ${
          desktopExpanded ? "w-56" : "w-16"
        }`}
      >
        {/* Logo */}
        {desktopExpanded ? (
          <div className="px-4 mb-8">
            <h1 className="text-lg font-bold gradient-text">Xtreme DL</h1>
            <p className="text-xs text-white/40 mt-0.5">IPTV Manager</p>
          </div>
        ) : (
          <div className="px-2 mb-8 flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">X</span>
            </div>
          </div>
        )}

        <NavList expanded={desktopExpanded} activeDownloadCount={activeDownloadCount} />

        {/* Collapse toggle */}
        <div className="px-2 mt-2">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={desktopExpanded ? "Collapse sidebar" : "Expand sidebar"}
            title={desktopExpanded ? "Collapse" : "Expand"}
          >
            {desktopExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>
      </aside>

      {/* Mobile drawer — overlay, below lg */}
      {sidebarMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSidebarMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-64 z-50 glass-card rounded-none border-r border-white/10 flex flex-col py-6 transition-transform duration-300 ${
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="px-4 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold gradient-text">Xtreme DL</h1>
            <p className="text-xs text-white/40 mt-0.5">IPTV Manager</p>
          </div>
          <button
            onClick={() => setSidebarMobileOpen(false)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
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
