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
    surface: "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-sm",
    raised: "bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-md",
    outline: "bg-transparent border border-[var(--border-subtle)] text-[var(--text-primary)]",
    highlight:
      "bg-[var(--primary-soft)]/40 border border-[var(--primary)]/40 text-[var(--text-primary)] shadow-sm",
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
