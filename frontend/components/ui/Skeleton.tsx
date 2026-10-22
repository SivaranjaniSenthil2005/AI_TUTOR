"use client";

import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rectangular",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: "h-4 rounded-md",
    rectangular: "rounded-2xl",
    circular: "rounded-full",
  }[variant];

  return (
    <div
      className={`bg-slate-800/60 border border-slate-700/40 animate-gentle-pulse ${variantClasses} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
