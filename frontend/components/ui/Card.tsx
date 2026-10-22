"use client";

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "raised" | "outline" | "highlight";
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Card({
  variant = "surface",
  padding = "md",
  children,
  className = "",
  ...props
}: CardProps) {
  const variantClasses = {
    surface: "bg-[#0b1120] border-2 border-slate-800 text-white shadow-lg",
    raised: "bg-[#0d1527] border-2 border-slate-700 text-white shadow-xl",
    outline: "bg-transparent border-2 border-slate-800 text-slate-100",
    highlight:
      "bg-[#0d1527] border-2 border-amber-400/50 text-white shadow-[0_0_24px_rgba(251,191,36,0.12)]",
  }[variant];

  const paddingClasses = {
    none: "p-0",
    sm: "p-3 sm:p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  }[padding];

  return (
    <div
      className={`rounded-[20px] transition-colors ${variantClasses} ${paddingClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
