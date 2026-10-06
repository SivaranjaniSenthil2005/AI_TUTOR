"use client";

import React, { useRef, useState, useEffect } from "react";
import { useGazeTarget } from "@/lib/gazeui/useGazeTarget";
import { globalSoundEffects } from "@/lib/gazeui/sound";

export interface GazeButtonProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  label?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  tag?: string;
  variant?: "primary" | "secondary" | "accent" | "danger" | "outline" | "card" | "active";
  size?: "default" | "large" | "compact";
  dwellMs?: number;
  priority?: number;
  disabled?: boolean;
  className?: string;
  progressType?: "ring" | "bar" | "both";
  ariaLabel?: string;
}

export function GazeButton({
  id,
  onClick,
  children,
  label,
  icon,
  subtitle,
  tag,
  variant = "primary",
  size = "default",
  dwellMs,
  priority = 0,
  disabled = false,
  className = "",
  progressType = "ring",
  ariaLabel,
}: GazeButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  const handleActivate = () => {
    setIsFlashActive(true);
    onClick();
  };

  const { progress, isGrace, isDwelling, isActivated } = useGazeTarget(
    buttonRef,
    {
      id,
      onActivate: handleActivate,
      dwellMs,
      priority,
      disabled,
    }
  );

  // Trigger flash animation when activated
  useEffect(() => {
    if (isActivated) {
      const timer = setTimeout(() => {
        setIsFlashActive(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isActivated]);

  // Click & Keyboard handler for fallback
  const handleClick = () => {
    if (disabled) return;
    globalSoundEffects.playActivationChime();
    handleActivate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) {
        globalSoundEffects.playActivationChime();
        handleActivate();
      }
    }
  };

  // Base sizing (min 72px height for accessibility)
  const sizeClasses =
    size === "large"
      ? "min-h-[84px] p-6 text-xl"
      : size === "compact"
      ? "min-h-[64px] px-5 py-3 text-base"
      : "min-h-[72px] p-5 text-lg";

  // Variant styling
  let variantClasses = "";
  switch (variant) {
    case "accent":
      variantClasses =
        "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:bg-amber-300";
      break;
    case "active":
      variantClasses =
        "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.5)] ring-4 ring-amber-400/50 scale-[1.02]";
      break;
    case "secondary":
      variantClasses =
        "bg-[#131f38] text-white border-slate-600 hover:border-amber-400 hover:bg-[#1a2b4c]";
      break;
    case "danger":
      variantClasses =
        "bg-rose-600/90 text-white border-rose-500 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]";
      break;
    case "outline":
      variantClasses =
        "bg-transparent text-slate-200 border-slate-600 hover:border-amber-400 hover:bg-slate-800/60";
      break;
    case "card":
      variantClasses =
        "bg-[#0d1527] text-white border-slate-700 hover:border-amber-400 hover:bg-[#131f38] shadow-lg";
      break;
    case "primary":
    default:
      variantClasses =
        "bg-[#0f172a] text-white border-slate-700 hover:border-amber-400 hover:bg-[#1e293b]";
      break;
  }

  // Circular progress math
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel || label || (typeof children === "string" ? children : id)}
      className={`relative group flex items-center justify-between rounded-2xl border-4 font-bold transition-all duration-150 select-none cursor-pointer focus:outline-none focus:ring-8 focus:ring-amber-400/80 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-700 ${sizeClasses} ${variantClasses} ${
        isDwelling
          ? "border-amber-400 ring-4 ring-amber-400/40 shadow-[0_0_24px_rgba(251,191,36,0.45)] scale-[1.02]"
          : ""
      } ${
        isFlashActive
          ? "bg-amber-300 text-slate-950 border-amber-200 shadow-[0_0_35px_#fde047] scale-105"
          : ""
      } ${className}`}
    >
      {/* Linear dwell progress bar along top edge */}
      {(progressType === "bar" || progressType === "both") && progress > 0 && (
        <div
          className="absolute top-0 left-0 right-0 h-2 bg-slate-800/80 overflow-hidden rounded-t-xl pointer-events-none"
          aria-hidden="true"
        >
          <div
            className={`h-full transition-[width] duration-75 ${
              isGrace ? "bg-amber-500 animate-pulse" : "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
            }`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex items-center gap-4 flex-1 text-left min-w-0">
        {icon && (
          <span
            className="text-3xl sm:text-4xl flex-shrink-0 transition-transform group-hover:scale-110"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {label && (
            <div className="text-xl sm:text-2xl font-black tracking-tight truncate leading-tight">
              {label}
            </div>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm font-semibold text-slate-400 line-clamp-2 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>

      {/* Right-hand side Tag & Circular Dwell Progress Ring */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        {tag && (
          <span className="hidden sm:inline-block text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
            {tag}
          </span>
        )}

        {/* Circular Dwell Progress Ring */}
        {(progressType === "ring" || progressType === "both") && (
          <div
            className="relative w-12 h-12 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 52 52">
              {/* Background track */}
              <circle
                cx="26"
                cy="26"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-15 text-slate-400"
              />
              {/* Animated dwell progress ring */}
              <circle
                cx="26"
                cy="26"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`transition-[stroke-dashoffset] duration-75 ${
                  isDwelling || isFlashActive
                    ? isGrace
                      ? "text-amber-500 animate-pulse"
                      : "text-amber-400 shadow-[0_0_12px_#fbbf24]"
                    : "text-slate-600 opacity-40"
                }`}
              />
            </svg>

            {/* Inner Center Icon / Dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isFlashActive ? (
                <span className="text-base font-black text-slate-950">✓</span>
              ) : isDwelling ? (
                <span className="text-xs font-extrabold text-amber-300">
                  {Math.round(progress * 100)}%
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500/50 group-hover:bg-amber-400/80 transition-colors" />
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
