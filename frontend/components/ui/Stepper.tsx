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
      className={`p-4 rounded-2xl bg-[#0b1120] border-2 border-slate-800 flex flex-col gap-2.5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-200">{label}</label>
        {helperText && <span className="text-xs text-slate-400">{helperText}</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Big Minus Button */}
        <button
          type="button"
          onClick={handleDecrease}
          disabled={!canDecrease}
          aria-label={`Decrease ${label}`}
          className="w-14 h-14 rounded-2xl bg-[#0d1527] border-2 border-slate-700 hover:border-amber-400 hover:bg-[#131f38] text-white flex items-center justify-center font-black select-none cursor-pointer calm-fade disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        >
          <Minus className="w-6 h-6 text-amber-300" />
        </button>

        {/* Value Display in Center */}
        <div className="flex-1 text-center py-2 px-4 rounded-xl bg-[#070b14] border border-slate-800/80">
          <span className="text-2xl font-black text-amber-300 tracking-tight">
            {displayString}
          </span>
        </div>

        {/* Big Plus Button */}
        <button
          type="button"
          onClick={handleIncrease}
          disabled={!canIncrease}
          aria-label={`Increase ${label}`}
          className="w-14 h-14 rounded-2xl bg-[#0d1527] border-2 border-slate-700 hover:border-amber-400 hover:bg-[#131f38] text-white flex items-center justify-center font-black select-none cursor-pointer calm-fade disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        >
          <Plus className="w-6 h-6 text-amber-300" />
        </button>
      </div>
    </div>
  );
}
