"use client";

import React from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  subtitle?: string;
}

export interface SegmentedControlProps<T extends string> {
  id?: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  id,
  options,
  value,
  onChange,
  className = "",
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-subtle)] ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              onChange(opt.value);
            }}
            className={`min-h-[56px] px-3 py-2 rounded-xl text-sm font-semibold flex flex-col items-center justify-center text-center select-none cursor-pointer calm-fade border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] ${
              isSelected
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm font-semibold"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--primary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {opt.icon && <span className="mb-0.5 text-base" aria-hidden="true">{opt.icon}</span>}
            <span className="truncate w-full leading-tight">{opt.label}</span>
            {opt.subtitle && (
              <span className={`text-[10px] mt-0.5 leading-tight ${isSelected ? "text-white/90 dark:text-slate-900 font-semibold" : "text-[var(--text-muted)]"}`}>
                {opt.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
