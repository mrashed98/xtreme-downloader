import { NavLink } from "react-router-dom";
import { LayoutDashboard, Tv, Film, Clapperboard, Download } from "lucide-react";
import { useAppStore } from "../../store";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/series", icon: Clapperboard, label: "Series" },
  { to: "/downloads", icon: Download, label: "Downloads" },
];

export function Sidebar() {
  const activeDownloadCount = useAppStore((s) => s.activeDownloadCount);

  return (
    <aside className="w-16 lg:w-56 flex-shrink-0 glass-card rounded-none border-r border-white/10 flex flex-col py-6">
      {/* Logo */}
      <div className="px-4 mb-8 hidden lg:block">
        <h1 className="text-lg font-bold gradient-text">Xtreme DL</h1>
        <p className="text-xs text-white/40 mt-0.5">IPTV Manager</p>
      </div>
      <div className="px-2 mb-8 block lg:hidden">
        <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
          <span className="text-white font-bold text-sm">X</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-accent text-white shadow-lg"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <div className="relative">
              <Icon size={18} />
              {label === "Downloads" && activeDownloadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-pink-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {activeDownloadCount > 9 ? "9+" : activeDownloadCount}
                </span>
              )}
            </div>
            <span className="hidden lg:block text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
