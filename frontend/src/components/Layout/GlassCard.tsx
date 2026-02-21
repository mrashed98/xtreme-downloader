import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function GlassCard({ children, className = "", onClick, hoverable = false }: GlassCardProps) {
  return (
    <div
      className={`glass-card ${hoverable ? "cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-900/20" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
