"use client";

import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "secondary" | "accent";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      size = "md",
      variant = "secondary",
      className = "",
      disabled = false,
      onClick,
      ...props
    },
    ref
  ) {
    const sizeClasses = {
      sm: "w-9 h-9 text-xs rounded-xl",
      md: "w-11 h-11 text-sm rounded-xl",
      lg: "w-13 h-13 text-base rounded-2xl",
    }[size];

    const variantClasses = {
      ghost:
        "bg-transparent text-[var(--text-muted)] border-0 hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
      secondary:
        "bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--bg-surface)]",
      accent:
        "bg-brand-gradient text-white border-0 hover:brightness-105 shadow-sm",
    }[variant];

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.currentTarget.focus({ preventScroll: true });
          if (!disabled && onClick) onClick(e);
        }}
        className={`inline-flex items-center justify-center select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  }
);
