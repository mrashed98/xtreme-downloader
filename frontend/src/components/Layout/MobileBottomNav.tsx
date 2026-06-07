import { NavLink } from "react-router-dom";
import { useAppStore } from "../../store";
import { bottomNavItems } from "./navItems";

export function MobileBottomNav() {
  const activeDownloadCount = useAppStore((s) => s.activeDownloadCount);

  return (
    <nav className="xbottomnav" aria-label="Primary">
      <div className="xbottomnav__row">
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "xbnav" + (isActive ? " is-active" : "")} aria-label={label}>
            <Icon size={23} className="xbnav__ico" />
            <span className="xbnav__lbl">{label}</span>
            {label === "Downloads" && activeDownloadCount > 0 && (
              <span className="xbnav__badge">{activeDownloadCount > 9 ? "9+" : activeDownloadCount}</span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
