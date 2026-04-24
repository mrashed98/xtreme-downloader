import {
  Clapperboard,
  Download,
  Film,
  LayoutDashboard,
  SlidersHorizontal,
  Tv,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export const navItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/live", icon: Tv, label: "Live TV" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/series", icon: Clapperboard, label: "Series" },
  { to: "/downloads", icon: Download, label: "Downloads" },
  { to: "/settings", icon: SlidersHorizontal, label: "Settings" },
];

// Bottom nav omits Settings — accessible via sidebar drawer
export const bottomNavItems: NavItem[] = navItems.filter((n) => n.to !== "/settings");
