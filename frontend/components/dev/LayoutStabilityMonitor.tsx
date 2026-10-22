"use client";

import React, { useEffect, useState, useRef } from "react";
import { Activity, X, AlertTriangle } from "lucide-react";

export interface TargetShiftLog {
  id: string;
  deltaX: number;
  deltaY: number;
  deltaW: number;
  deltaH: number;
  timestamp: number;
}

export interface LayoutStabilityMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  gazePointRef?: React.RefObject<{ xPx: number; yPx: number; valid: boolean }>;
}

export function LayoutStabilityMonitor({
  isOpen,
  onClose,
  gazePointRef,
}: LayoutStabilityMonitorProps) {
  const [clsScore, setClsScore] = useState<number>(0);
  const [shiftCount, setShiftCount] = useState<number>(0);
  const [shifts, setShifts] = useState<TargetShiftLog[]>([]);
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map());

  // Monitor PerformanceObserver for Cumulative Layout Shift (CLS)
  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    let cumulativeScore = 0;
    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // LayoutShift interface: entry has value
          const layoutShift = entry as unknown as { value: number; hadRecentInput: boolean };
          if (!layoutShift.hadRecentInput) {
            cumulativeScore += layoutShift.value;
            setClsScore(Math.round(cumulativeScore * 10000) / 10000);
            (window as unknown as { __AI_TUTOR_CLS__: number }).__AI_TUTOR_CLS__ = cumulativeScore;
          }
        }
      });

      observer.observe({ type: "layout-shift", buffered: true });
      return () => observer.disconnect();
    } catch {
      // Ignore browsers that don't support layout-shift entry
    }
  }, []);

  // Monitor all [data-gaze-id] targets for shifts > 1px
  useEffect(() => {
    let animId: number;
    let isMounted = true;

    const checkTargets = () => {
      if (!isMounted) return;

      const elements = document.querySelectorAll<HTMLElement>("[data-gaze-id]");
      const currentGaze = gazePointRef?.current;

      elements.forEach((el) => {
        const id = el.getAttribute("data-gaze-id");
        if (!id) return;

        const currentRect = el.getBoundingClientRect();
        const prevRect = previousRectsRef.current.get(id);

        if (prevRect) {
          const dx = Math.abs(currentRect.left - prevRect.left);
          const dy = Math.abs(currentRect.top - prevRect.top);
          const dw = Math.abs(currentRect.width - prevRect.width);
          const dh = Math.abs(currentRect.height - prevRect.height);

          // If moved more than 1px
          if (dx > 1 || dy > 1 || dw > 1 || dh > 1) {
            // Check if gaze is within 200px of target
            let nearGaze = true;
            if (currentGaze && currentGaze.valid) {
              const centerX = currentRect.left + currentRect.width / 2;
              const centerY = currentRect.top + currentRect.height / 2;
              const dist = Math.hypot(currentGaze.xPx - centerX, currentGaze.yPx - centerY);
              nearGaze = dist <= 200;
            }

            if (nearGaze) {
              const logEntry: TargetShiftLog = {
                id,
                deltaX: Math.round(dx * 10) / 10,
                deltaY: Math.round(dy * 10) / 10,
                deltaW: Math.round(dw * 10) / 10,
                deltaH: Math.round(dh * 10) / 10,
                timestamp: Date.now(),
              };

              setShiftCount((c) => c + 1);
              setShifts((prev) => [logEntry, ...prev.slice(0, 9)]);

              const win = window as unknown as { __AI_TUTOR_TARGET_SHIFTS__: TargetShiftLog[] };
              win.__AI_TUTOR_TARGET_SHIFTS__ = win.__AI_TUTOR_TARGET_SHIFTS__ || [];
              win.__AI_TUTOR_TARGET_SHIFTS__.push(logEntry);
            }
          }
        }

        previousRectsRef.current.set(id, currentRect);
      });

      animId = requestAnimationFrame(checkTargets);
    };

    animId = requestAnimationFrame(checkTargets);
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [gazePointRef]);

  if (!isOpen) return null;

  return (
    <div
      id="dev-stability-monitor-panel"
      role="complementary"
      aria-label="Layout Stability Monitor"
      className="fixed bottom-32 left-6 z-[9975] w-80 bg-[#0b1120] border-2 border-purple-500/80 rounded-2xl p-4 shadow-2xl space-y-3 select-none text-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 font-black text-purple-300">
          <Activity className="w-4 h-4 text-purple-400" />
          <span>Layout Stability Monitor</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-bold">CLS Score</div>
          <div
            className={`text-lg font-black ${
              clsScore < 0.02 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {clsScore}
          </div>
          <div className="text-[9px] text-slate-500">Target: &lt; 0.02</div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#070b14] border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Target Shifts</div>
          <div
            className={`text-lg font-black ${
              shiftCount === 0 ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {shiftCount}
          </div>
          <div className="text-[9px] text-slate-500">&gt; 1px while in gaze</div>
        </div>
      </div>

      {shifts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Recent Target Movements:</span>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
            {shifts.map((s, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[10px] text-rose-200"
              >
                <div className="font-bold truncate">{s.id}</div>
                <div className="text-slate-400 text-[9px]">
                  Δpos: ({s.deltaX}px, {s.deltaY}px) Δsize: ({s.deltaW}px, {s.deltaH}px)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
