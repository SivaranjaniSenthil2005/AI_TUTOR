"use client";

import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    children,
    className = "",
    disabled = false,
    onClick,
    ...props
  },
  ref
) {
  const sizeClasses = {
    sm: "h-10 px-4 text-sm rounded-xl gap-2",
    md: "h-12 px-5 text-base rounded-2xl gap-2.5",
    lg: "h-14 px-6 text-lg rounded-2xl gap-3",
    xl: "h-16 px-8 text-xl rounded-2xl gap-3.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-brand-gradient text-white font-semibold border-0 hover:brightness-105 shadow-md",
    secondary:
      "bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--bg-surface)]",
    accent:
      "bg-[var(--accent-teal)] text-white font-semibold border-0 hover:brightness-105 shadow-md",
    outline:
      "bg-transparent text-[var(--text-primary)] font-semibold border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/20",
    ghost:
      "bg-transparent text-[var(--text-muted)] font-semibold border-0 hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
    danger:
      "bg-[var(--error-soft)] text-[var(--error)] font-semibold border border-[var(--error)]/30 hover:bg-[var(--error-soft)]/80",
  }[variant];

  return (
    <button
      ref={ref}
      disabled={disabled}
      onClick={(e) => {
        if (!disabled && onClick) onClick(e);
      }}
      className={`inline-flex items-center justify-center select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
});
