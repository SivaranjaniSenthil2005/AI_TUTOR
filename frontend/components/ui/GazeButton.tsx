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

  // Brief success-green flash on activation without ANY movement or transform scale
  useEffect(() => {
    if (isActivated) {
      const timer = setTimeout(() => {
        setIsFlashActive(false);
      }, 300);
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

  // Standard sizes with min-w-0 for flex/grid responsiveness
  const sizeClasses = {
    compact: "h-9 min-h-[36px] min-w-0 px-3 py-1 text-xs",
    default: "h-[76px] min-w-0 px-4 py-2.5 text-sm sm:text-base",
    large: "h-[84px] min-w-0 px-5 py-3 text-base sm:text-lg",
    xl: "h-[92px] min-w-0 px-5 py-3.5 text-base sm:text-lg",
  }[size];

  // Visual variants using exact Bright tokens
  let variantClasses = "";
  switch (variant) {
    case "primary":
      variantClasses =
        "bg-brand-gradient text-white border-transparent shadow-[0_4px_16px_rgba(79,70,229,0.25)] hover:brightness-105";
      break;
    case "active":
      variantClasses =
        "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)] ring-2 ring-[var(--primary)]/40 font-semibold shadow-xs";
      break;
    case "accent":
      variantClasses =
        "bg-[var(--teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/40 hover:border-[var(--accent-teal)] shadow-xs";
      break;
    case "dock":
      variantClasses =
        "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/30 shadow-xs";
      break;
    case "danger":
      variantClasses =
        "bg-[var(--error-soft)] text-[var(--error)] border-[var(--error)]/30 hover:border-[var(--error)] shadow-xs";
      break;
    case "outline":
      variantClasses =
        "bg-transparent text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/20";
      break;
    case "card":
    case "secondary":
    default:
      variantClasses =
        "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/30 shadow-xs";
      break;
  }

  // Dwell state visual feedback (ring, border highlight, green flash - NO MOVEMENT)
  const dwellStateClasses = isFlashActive
    ? "!bg-[var(--success-soft)] !text-[var(--success)] !border-[var(--success)] ring-3 ring-[var(--success)]/60 shadow-[0_0_20px_rgba(21,128,61,0.25)]"
    : isDwelling
    ? "!border-[var(--primary)] ring-3 ring-[var(--focus-ring)]/40 !bg-[var(--primary-soft)]/30 shadow-[0_4px_16px_rgba(79,70,229,0.15)]"
    : "";

  // Progress ring math around icon container
  const radius = size === "compact" ? 11 : 16;
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
      className={`relative inline-flex items-center justify-between rounded-[20px] border font-semibold select-none cursor-pointer focus:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed calm-fade ${sizeClasses} ${variantClasses} ${dwellStateClasses} ${className}`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Bottom dwell progress bar INSIDE button box */}
      {(progressType === "bar" || progressType === "both") && progress > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5 dark:bg-white/10 overflow-hidden rounded-b-[19px] pointer-events-none"
          aria-hidden="true"
        >
          <div
            className={`h-full calm-fade ${
              isGrace ? "bg-[var(--dwell-ring)] animate-gentle-pulse" : "bg-[var(--dwell-ring)]"
            }`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {/* Main Content: Left Icon (in a soft circle) and Label */}
      <div className={`flex items-center ${size === "compact" ? "gap-2" : "gap-3"} flex-1 text-left min-w-0 pointer-events-none`}>
        {icon && (
          <div
            className={`relative flex-shrink-0 ${
              size === "compact" ? "w-6 h-6 min-w-[24px]" : "w-9 h-9 min-w-[36px]"
            } rounded-full flex items-center justify-center ${
              variant === "primary"
                ? "bg-white/20 text-white"
                : "bg-[var(--primary-soft)] text-[var(--primary)]"
            }`}
          >
            {/* Amber Dwell Ring directly wrapping the icon */}
            {(isDwelling || isFlashActive) && progressType !== "bar" && (
              <svg
                className={`absolute -inset-1 ${
                  size === "compact" ? "w-8 h-8" : "w-11 h-11"
                } -rotate-90 pointer-events-none`}
                viewBox={size === "compact" ? "0 0 26 26" : "0 0 38 38"}
              >
                <circle
                  cx={size === "compact" ? 13 : 19}
                  cy={size === "compact" ? 13 : 19}
                  r={radius}
                  fill="none"
                  stroke="var(--dwell-ring)"
                  strokeWidth={size === "compact" ? "2" : "3"}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={isGrace ? "animate-gentle-pulse" : ""}
                />
              </svg>
            )}
            <div className="relative z-10 flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {label && (
            <div
              className={`font-semibold tracking-normal leading-snug break-normal ${
                size === "compact" ? "whitespace-nowrap" : ""
              } ${variant === "primary" ? "text-white" : ""}`}
              style={{
                textWrap: size === "compact" ? "nowrap" : "balance",
                fontSize: size === "compact" ? "0.8125rem" : "clamp(0.8125rem, 0.95vw, 1.0625rem)",
              }}
            >
              {label}
            </div>
          )}
          {subtitle && (
            <p
              className={`text-xs font-normal line-clamp-1 mt-0.5 leading-tight ${
                variant === "primary" ? "text-white/80" : "text-[var(--text-muted)]"
              }`}
            >
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>

      {/* Right-hand side: Tag, Checkmark badge for active, or Progress ring */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2 pointer-events-none">
        {variant === "active" && (
          <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
            ✓
          </span>
        )}
        {tag && (
          <span className="text-[11px] font-medium tracking-normal px-2.5 py-0.5 rounded-full bg-[var(--surface-2,var(--primary-soft))] text-[var(--text-primary)] border border-[var(--border-subtle)]">
            {tag}
          </span>
        )}

        {/* Circular Dwell Progress Ring if standalone ring requested and no icon */}
        {!icon && (progressType === "ring" || progressType === "both") && (
          <div
            className="relative w-8 h-8 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 38 38">
              <circle
                cx="19"
                cy="19"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="opacity-15 text-[var(--text-muted)]"
              />
              <circle
                cx="19"
                cy="19"
                r={radius}
                fill="none"
                stroke="var(--dwell-ring)"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`calm-fade ${
                  isDwelling || isFlashActive
                    ? isGrace
                      ? "animate-gentle-pulse"
                      : ""
                    : "opacity-0"
                }`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {isFlashActive ? (
                <span className="text-xs font-bold text-[var(--success)]">✓</span>
              ) : isDwelling ? (
                <span className="text-[10px] font-bold text-[var(--text-primary)]">
                  {Math.round(progress * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </button>
  );
});
