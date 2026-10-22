"use client";

import React from "react";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "indigo" | "teal" | "purple" | "slate" | "rose" | "sky" | "amber";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Chip({
  variant = "indigo",
  icon,
  children,
  className = "",
  ...props
}: ChipProps) {
  const variantClasses = {
    indigo: "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30",
    teal: "bg-[var(--teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30",
    purple: "bg-[var(--violet-soft)] text-[var(--secondary-violet)] border-[var(--secondary-violet)]/30",
    slate: "bg-[var(--bg-surface-2)] text-[var(--text-muted)] border-[var(--border-subtle)]",
    rose: "bg-[var(--error-soft)] text-[var(--error)] border-[var(--error)]/30",
    sky: "bg-[var(--sky-soft)] text-[var(--sky)] border-[var(--sky)]/30",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
