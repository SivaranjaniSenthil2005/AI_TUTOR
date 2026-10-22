"use client";

import React from "react";

export interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  variant?: "amber" | "teal" | "cyan";
  className?: string;
  showText?: boolean;
}

export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  variant = "amber",
  className = "",
  showText = false,
}: ProgressRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - Math.max(0, Math.min(1, progress)) * circumference;

  const colorClass = {
    amber: "text-[var(--dwell-ring)]",
    teal: "text-[var(--accent-teal)]",
    cyan: "text-[var(--sky)]",
  }[variant];

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20 text-slate-500"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`calm-fade ${colorClass}`}
        />
      </svg>
      {showText && (
        <span className="absolute text-[10px] font-semibold text-[var(--text-primary)]">
          {Math.round(progress * 100)}%
        </span>
      )}
    </div>
  );
}
