"use client";

import React from "react";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "amber" | "teal" | "purple" | "slate" | "rose" | "cyan";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Chip({
  variant = "amber",
  icon,
  children,
  className = "",
  ...props
}: ChipProps) {
  const variantClasses = {
    amber: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    teal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
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
