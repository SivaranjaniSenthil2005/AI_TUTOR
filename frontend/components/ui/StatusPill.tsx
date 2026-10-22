"use client";

import React from "react";

export type StatusVariant = "success" | "warning" | "danger" | "neutral";

export interface StatusPillProps {
  id?: string;
  icon?: React.ReactNode;
  label: string; // Short label <= 8 chars: "Server", "Camera", "Eyes", "Mic"
  value: string; // Detailed tooltip & popover value
  variant?: StatusVariant;
  onClick?: () => void;
  className?: string;
}

export function StatusPill({
  id,
  icon,
  label,
  value,
  variant = "neutral",
  onClick,
  className = "",
}: StatusPillProps) {
  const dotColor = {
    success: "bg-[#15803D] ring-2 ring-[#DCFCE7]",
    warning: "bg-[#B45309] ring-2 ring-[#FEF3C7]",
    danger: "bg-[#BE123C] ring-2 ring-[#FFE4E6]",
    neutral: "bg-[#5A6485] ring-2 ring-[#DDE3F5]",
  }[variant];

  const content = (
    <div
      id={id}
      suppressHydrationWarning
      title={`${label}: ${value}`}
      className={`h-8 px-2.5 rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center gap-1.5 select-none text-xs font-medium max-w-full flex-shrink-0 ${
        onClick ? "cursor-pointer hover:border-[var(--primary)]" : ""
      } ${className}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" suppressHydrationWarning />
      {icon && <span className="flex-shrink-0 text-[var(--text-muted)]" aria-hidden="true">{icon}</span>}
      <span className="font-semibold text-[var(--text-primary)] text-xs" suppressHydrationWarning>
        {label}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.focus({ preventScroll: true });
          onClick();
        }}
        aria-label={`${label}: ${value}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-full"
      >
        {content}
      </button>
    );
  }

  return content;
}
