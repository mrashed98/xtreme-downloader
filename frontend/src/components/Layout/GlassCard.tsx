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
      className={`glass-card ${hoverable ? "cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(6,10,18,0.34)]" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
