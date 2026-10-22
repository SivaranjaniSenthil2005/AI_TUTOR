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
      "bg-amber-400 text-slate-950 font-bold border-2 border-amber-300 hover:bg-amber-300 shadow-md",
    secondary:
      "bg-[#0d1527] text-white font-semibold border-2 border-slate-700 hover:border-slate-500 hover:bg-[#131f38]",
    accent:
      "bg-amber-400 text-slate-950 font-black border-2 border-amber-300 hover:bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.25)]",
    outline:
      "bg-transparent text-slate-200 font-semibold border-2 border-slate-600 hover:border-amber-400 hover:bg-slate-800/40",
    ghost:
      "bg-transparent text-slate-300 font-semibold border-2 border-transparent hover:bg-slate-800/60 hover:text-white",
    danger:
      "bg-rose-950/80 text-rose-200 font-bold border-2 border-rose-600 hover:bg-rose-900",
  }[variant];

  return (
    <button
      ref={ref}
      disabled={disabled}
      onClick={(e) => {
        if (!disabled && onClick) onClick(e);
      }}
      className={`inline-flex items-center justify-center select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/80 disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
});
