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
        "bg-transparent text-slate-300 border-2 border-transparent hover:bg-slate-800/60 hover:text-white",
      secondary:
        "bg-[#0d1527] text-slate-200 border-2 border-slate-700 hover:border-slate-500 hover:bg-[#131f38]",
      accent:
        "bg-amber-400 text-slate-950 border-2 border-amber-300 hover:bg-amber-300 shadow-sm",
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
        className={`inline-flex items-center justify-center select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/80 disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  }
);
