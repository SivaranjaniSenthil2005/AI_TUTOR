"use client";

import React, { useRef, useEffect } from "react";
import type { GazePoint } from "@/hooks/useGazePoint";

export interface GazeDotProps {
  gazePointRef: React.RefObject<GazePoint>;
  visible?: boolean;
}

export function GazeDot({ gazePointRef, visible = true }: GazeDotProps) {
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;

    let animId: number;

    function renderLoop() {
      const el = dotRef.current;
      const pt = gazePointRef.current;

      if (el && pt) {
        if (pt.valid) {
          el.style.opacity = "1";
          el.style.transform = `translate3d(${pt.xPx}px, ${pt.yPx}px, 0) translate(-50%, -50%)`;
        } else {
          el.style.opacity = "0";
        }
      }

      animId = requestAnimationFrame(renderLoop);
    }

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gazePointRef, visible]);

  if (!visible) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999] opacity-0 transition-opacity duration-150 will-change-transform flex items-center justify-center"
      style={{
        transform: "translate3d(-100px, -100px, 0)",
      }}
    >
      {/* Outer Glowing Ring */}
      <div className="absolute inset-0 rounded-full bg-amber-400/30 border-2 border-amber-300 shadow-[0_0_15px_#fbbf24] animate-pulse" />
      {/* Inner Pupil Center Dot */}
      <div className="w-2.5 h-2.5 rounded-full bg-amber-300 shadow-md border border-slate-950" />
    </div>
  );
}
