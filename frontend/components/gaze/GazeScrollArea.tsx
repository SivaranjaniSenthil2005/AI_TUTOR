"use client";

import React, { useRef, useEffect, useState } from "react";
import { useGazeContext } from "@/lib/gazeui/GazeContext";

export interface GazeScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  scrollSpeedMin?: number; // Starting px/frame (default 3)
  scrollSpeedMax?: number; // Max px/frame (default 18)
  zoneHeight?: number;     // Height in px of top/bottom zones (default 56)
}

export function GazeScrollArea({
  children,
  className = "",
  scrollSpeedMin = 3,
  scrollSpeedMax = 18,
  zoneHeight = 56,
}: GazeScrollAreaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topZoneRef = useRef<HTMLDivElement | null>(null);
  const bottomZoneRef = useRef<HTMLDivElement | null>(null);

  const [isTopActive, setIsTopActive] = useState<boolean>(false);
  const [isBottomActive, setIsBottomActive] = useState<boolean>(false);

  const { gazePointRef, isPaused, autoPaused } = useGazeContext();

  useEffect(() => {
    let animId: number;
    let speed = scrollSpeedMin;
    let activeDirection: "up" | "down" | null = null;
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;

      const effectivelyPaused = isPaused || autoPaused;
      const pt = gazePointRef.current;
      const container = containerRef.current;

      let direction: "up" | "down" | null = null;

      if (!effectivelyPaused && pt && pt.valid && container) {
        const topEl = topZoneRef.current;
        const bottomEl = bottomZoneRef.current;

        if (topEl) {
          const rect = topEl.getBoundingClientRect();
          if (
            pt.xPx >= rect.left &&
            pt.xPx <= rect.right &&
            pt.yPx >= rect.top &&
            pt.yPx <= rect.bottom
          ) {
            direction = "up";
          }
        }

        if (bottomEl && !direction) {
          const rect = bottomEl.getBoundingClientRect();
          if (
            pt.xPx >= rect.left &&
            pt.xPx <= rect.right &&
            pt.yPx >= rect.top &&
            pt.yPx <= rect.bottom
          ) {
            direction = "down";
          }
        }
      }

      if (direction) {
        if (activeDirection === direction) {
          speed = Math.min(scrollSpeedMax, speed + 0.35); // Smooth ramp up
        } else {
          speed = scrollSpeedMin;
          activeDirection = direction;
        }

        if (container) {
          if (direction === "up") {
            container.scrollTop = Math.max(0, container.scrollTop - speed);
          } else if (direction === "down") {
            container.scrollTop = Math.min(
              container.scrollHeight - container.clientHeight,
              container.scrollTop + speed
            );
          }
        }

        setIsTopActive(direction === "up");
        setIsBottomActive(direction === "down");
      } else {
        speed = scrollSpeedMin;
        activeDirection = null;
        setIsTopActive(false);
        setIsBottomActive(false);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [gazePointRef, isPaused, autoPaused, scrollSpeedMin, scrollSpeedMax]);

  return (
    <div className={`relative flex flex-col overflow-hidden ${className}`}>
      {/* Top Gaze Scroll Zone Band */}
      <div
        ref={topZoneRef}
        aria-hidden="true"
        style={{ height: `${zoneHeight}px` }}
        className={`w-full flex items-center justify-center gap-2 border-b-2 font-black text-sm tracking-wide transition-all duration-200 select-none z-10 ${
          isTopActive
            ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_4px_15px_rgba(251,191,36,0.5)] opacity-100 scale-y-105"
            : "bg-[#0d1527]/90 text-slate-400 border-slate-800/80 hover:text-slate-200 opacity-75"
        }`}
      >
        <span className={`text-xl ${isTopActive ? "animate-bounce" : ""}`}>▲</span>
        <span>{isTopActive ? "Scrolling Up..." : "Look Here to Scroll Up"}</span>
      </div>

      {/* Main Scrollable Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 scroll-smooth focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        tabIndex={0}
      >
        {children}
      </div>

      {/* Bottom Gaze Scroll Zone Band */}
      <div
        ref={bottomZoneRef}
        aria-hidden="true"
        style={{ height: `${zoneHeight}px` }}
        className={`w-full flex items-center justify-center gap-2 border-t-2 font-black text-sm tracking-wide transition-all duration-200 select-none z-10 ${
          isBottomActive
            ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_-4px_15px_rgba(251,191,36,0.5)] opacity-100 scale-y-105"
            : "bg-[#0d1527]/90 text-slate-400 border-slate-800/80 hover:text-slate-200 opacity-75"
        }`}
      >
        <span className={`text-xl ${isBottomActive ? "animate-bounce" : ""}`}>▼</span>
        <span>{isBottomActive ? "Scrolling Down..." : "Look Here to Scroll Down"}</span>
      </div>
    </div>
  );
}
