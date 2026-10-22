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
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "danger"
    | "outline"
    | "card"
    | "active"
    | "dock";
  size?: "default" | "large" | "compact" | "xl";
  dwellMs?: number;
  priority?: number;
  disabled?: boolean;
  className?: string;
  progressType?: "ring" | "bar" | "both";
  ariaLabel?: string;
}

export const GazeButton = React.memo(function GazeButton({
  id,
  onClick,
  children,
  label,
  icon,
  subtitle,
  tag,
  variant = "secondary",
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

  const { progress, isGrace, isDwelling, isActivated } = useGazeTarget(buttonRef, {
    id,
    onActivate: handleActivate,
    dwellMs,
    priority,
    disabled,
  });

  // Brief flash on activation without ANY movement or transform scale
  useEffect(() => {
    if (isActivated) {
      const timer = setTimeout(() => {
        setIsFlashActive(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isActivated]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus({ preventScroll: true });
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

  // Dimensions: 88px standard, 104px for xl (primary dock action), min width 176px
  const sizeClasses = {
    compact: "h-[64px] min-w-[150px] px-4 py-2 text-sm",
    default: "h-[88px] min-w-[176px] px-5 py-3 text-base",
    large: "h-[88px] min-w-[190px] px-6 py-3 text-lg",
    xl: "h-[104px] min-w-[210px] px-6 py-4 text-xl",
  }[size];

  // Visual variants: Show state changes via background, border color, box-shadow, rings ONLY (ZERO transforms)
  let variantClasses = "";
  switch (variant) {
    case "accent":
      variantClasses =
        "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.25)] hover:bg-amber-300";
      break;
    case "active":
      variantClasses =
        "bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-400/40 font-black shadow-[0_0_24px_rgba(251,191,36,0.3)]";
      break;
    case "dock":
      variantClasses =
        "bg-[#0d1527] text-white border-slate-700 hover:border-amber-400 hover:bg-[#131f38] shadow-md";
      break;
    case "danger":
      variantClasses =
        "bg-rose-950/80 text-rose-100 border-rose-600 hover:bg-rose-900 shadow-md";
      break;
    case "outline":
      variantClasses =
        "bg-transparent text-slate-200 border-slate-700 hover:border-amber-400 hover:bg-slate-800/40";
      break;
    case "card":
      variantClasses =
        "bg-[#0b1120] text-white border-slate-700 hover:border-amber-400 hover:bg-[#131f38] shadow-md";
      break;
    case "primary":
      variantClasses =
        "bg-amber-400 text-slate-950 font-black border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.35)] hover:bg-amber-300";
      break;
    case "secondary":
    default:
      variantClasses =
        "bg-[#0d1527] text-white border-slate-700 hover:border-slate-500 hover:bg-[#131f38]";
      break;
  }

  // Dwell state visual feedback (ring, border highlight, glow - NO MOVEMENT)
  const dwellStateClasses = isFlashActive
    ? "!bg-amber-300 !text-slate-950 !border-amber-100 ring-4 ring-amber-300/80 shadow-[0_0_30px_#fde047]"
    : isDwelling
    ? "!border-amber-400 ring-4 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
    : "";

  // Progress ring math
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <button
      ref={buttonRef}
      id={id}
      data-gaze-id={id}
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel || label || (typeof children === "string" ? children : id)}
      className={`relative inline-flex items-center justify-between rounded-[20px] border-4 font-bold select-none cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/90 disabled:opacity-40 disabled:cursor-not-allowed calm-fade ${sizeClasses} ${variantClasses} ${dwellStateClasses} ${className}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Bottom dwell progress bar INSIDE button box */}
      {(progressType === "bar" || progressType === "both") && progress > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 bg-slate-800/80 overflow-hidden rounded-b-[16px] pointer-events-none"
          aria-hidden="true"
        >
          <div
            className={`h-full calm-fade ${
              isGrace ? "bg-amber-500 animate-gentle-pulse" : "bg-amber-400"
            }`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* Main Content: Icon and Label */}
      <div className="flex items-center gap-3.5 flex-1 text-left min-w-0 pointer-events-none">
        {icon && (
          <div className="flex-shrink-0 flex items-center justify-center text-amber-300">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {label && (
            <div className="font-black tracking-tight truncate leading-tight">
              {label}
            </div>
          )}
          {subtitle && (
            <p className="text-xs font-medium text-slate-400 line-clamp-1 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>

      {/* Right-hand side: Tag and Progress Ring */}
      <div className="flex items-center gap-2.5 flex-shrink-0 ml-3 pointer-events-none">
        {tag && (
          <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
            {tag}
          </span>
        )}

        {/* Circular Dwell Progress Ring */}
        {(progressType === "ring" || progressType === "both") && (
          <div
            className="relative w-10 h-10 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 48 48">
              {/* Background track */}
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="opacity-20 text-slate-500"
              />
              {/* Animated progress ring */}
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`calm-fade ${
                  isDwelling || isFlashActive
                    ? isGrace
                      ? "text-amber-500 animate-gentle-pulse"
                      : "text-amber-400"
                    : "text-slate-600 opacity-30"
                }`}
              />
            </svg>

            {/* Inner Center Indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isFlashActive ? (
                <span className="text-xs font-black text-slate-950">✓</span>
              ) : isDwelling ? (
                <span className="text-[10px] font-black text-amber-300">
                  {Math.round(progress * 100)}%
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500/60" />
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
});
