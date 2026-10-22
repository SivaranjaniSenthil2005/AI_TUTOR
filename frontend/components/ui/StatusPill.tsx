"use client";

import React from "react";

export type StatusVariant = "success" | "warning" | "danger" | "neutral";

export interface StatusPillProps {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  value: string;
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
    success: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    warning: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
    danger: "bg-rose-500 shadow-[0_0_8px_#f43f5e]",
    neutral: "bg-slate-500",
  }[variant];

  const textColor = {
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
    neutral: "text-slate-300",
  }[variant];

  const content = (
    <div
      id={id}
      title={`${label}: ${value}`}
      className={`h-8 px-2 rounded-xl bg-[#0d1527] border border-slate-700/80 flex items-center gap-1.5 select-none text-[11px] font-semibold w-[108px] min-w-[108px] max-w-[108px] flex-shrink-0 ${
        onClick ? "cursor-pointer hover:border-slate-500" : ""
      } ${className}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
      {icon && <span className="flex-shrink-0 text-slate-400 text-sm" aria-hidden="true">{icon}</span>}
      <span className="truncate flex-1 min-w-0 text-left">
        <span className={textColor}>{value}</span>
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
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl"
      >
        {content}
      </button>
    );
  }

  return content;
}
