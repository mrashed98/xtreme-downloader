import { Download, Film, Home, Layers, Settings, Tv, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export const navItems: NavItem[] = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/series", icon: Layers, label: "Series" },
  { to: "/downloads", icon: Download, label: "Downloads" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

// Bottom nav omits Settings — reachable from the mobile top bar
export const bottomNavItems: NavItem[] = navItems.filter((n) => n.to !== "/settings");
