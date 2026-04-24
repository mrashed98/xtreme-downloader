import { NavLink } from "react-router-dom";
import { useAppStore } from "../../store";
import { navItems } from "./navItems";

export function MobileBottomNav() {
  const activeDownloadCount = useAppStore((s) => s.activeDownloadCount);

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
      <div className="mobile-bottom-nav__inner">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `mobile-bottom-nav__item ${isActive ? "mobile-bottom-nav__item--active" : ""}`
            }
            aria-label={label}
          >
            <span className="relative">
              <Icon size={18} />
              {label === "Downloads" && activeDownloadCount > 0 && (
                <span className="mobile-bottom-nav__badge">
                  {activeDownloadCount > 9 ? "9+" : activeDownloadCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
