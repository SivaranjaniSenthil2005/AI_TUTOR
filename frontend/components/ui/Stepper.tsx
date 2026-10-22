"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

export interface StepperProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (val: number) => string;
  unit?: string;
  helperText?: string;
  onChange: (val: number) => void;
  className?: string;
}

export function Stepper({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  unit,
  helperText,
  onChange,
  className = "",
}: StepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  const handleDecrease = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    if (canDecrease) {
      const next = Math.max(min, Math.round((value - step) * 100) / 100);
      onChange(next);
    }
  };

  const handleIncrease = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.focus({ preventScroll: true });
    if (canIncrease) {
      const next = Math.min(max, Math.round((value + step) * 100) / 100);
      onChange(next);
    }
  };

  const displayString = formatValue ? formatValue(value) : `${value}${unit ? ` ${unit}` : ""}`;

  return (
    <div
      id={id}
      className={`p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] flex flex-col gap-2.5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-[var(--text-primary)]">{label}</label>
        {helperText && <span className="text-xs text-[var(--text-muted)]">{helperText}</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Big Minus Button */}
        <button
          type="button"
          onClick={handleDecrease}
          disabled={!canDecrease}
          aria-label={`Decrease ${label}`}
          className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/30 text-[var(--text-primary)] flex items-center justify-center select-none cursor-pointer calm-fade disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)]"
        >
          <Minus className="w-6 h-6 text-[var(--primary)]" />
        </button>

        {/* Value Display in Center */}
        <div className="flex-1 text-center py-2 px-4 rounded-xl bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]">
          <span className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {displayString}
          </span>
        </div>

        {/* Big Plus Button */}
        <button
          type="button"
          onClick={handleIncrease}
          disabled={!canIncrease}
          aria-label={`Increase ${label}`}
          className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/30 text-[var(--text-primary)] flex items-center justify-center select-none cursor-pointer calm-fade disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)]"
        >
          <Plus className="w-6 h-6 text-[var(--primary)]" />
        </button>
      </div>
    </div>
  );
}
