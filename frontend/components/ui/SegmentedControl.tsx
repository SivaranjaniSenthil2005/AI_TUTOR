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
      className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-[#070b14] border-2 border-slate-800 ${className}`}
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
            className={`min-h-[56px] px-3 py-2 rounded-xl text-sm font-bold flex flex-col items-center justify-center text-center select-none cursor-pointer calm-fade border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 ${
              isSelected
                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.3)] font-black"
                : "bg-[#0d1527] text-slate-300 border-slate-700/80 hover:border-slate-500 hover:text-white"
            }`}
          >
            {opt.icon && <span className="mb-0.5 text-base" aria-hidden="true">{opt.icon}</span>}
            <span className="truncate w-full leading-tight">{opt.label}</span>
            {opt.subtitle && (
              <span className={`text-[10px] mt-0.5 leading-tight ${isSelected ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                {opt.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
