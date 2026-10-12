"use client";

import React, { useState, useEffect } from "react";
import type { GazePoint } from "@/hooks/useGazePoint";
import { GazeButton } from "./GazeButton";

export interface GazeSimulatorProps {
  gazePointRef: React.RefObject<GazePoint>;
}

export function GazeSimulator({ gazePointRef }: GazeSimulatorProps) {
  const isDevToolsEnabled =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DEV_TOOLS === "1" ||
      process.env.NODE_ENV !== "production");

  const [isActive, setIsActive] = useState<boolean>(false);

  useEffect(() => {
    if (!isActive) return;
    const ref = gazePointRef;

    const handleMouseMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.x = e.clientX / Math.max(1, window.innerWidth);
        ref.current.y = e.clientY / Math.max(1, window.innerHeight);
        ref.current.xPx = e.clientX;
        ref.current.yPx = e.clientY;
        ref.current.confidence = 1.0;
        ref.current.valid = true;
        ref.current.timestamp = performance.now();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (ref.current) {
        ref.current.valid = false;
      }
    };
  }, [isActive, gazePointRef]);

  if (!isDevToolsEnabled) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9990] flex items-center gap-2">
      <GazeButton
        id="toggle-gaze-simulator-btn"
        onClick={() => setIsActive((prev) => !prev)}
        label={isActive ? "Sim Gaze: ON 🖱️" : "Sim Gaze: OFF"}
        variant={isActive ? "active" : "outline"}
        size="compact"
        className="!min-h-[44px] text-xs font-black shadow-lg"
      />
      {isActive && (
        <span
          id="simulated-gaze-badge"
          className="bg-purple-600 border-2 border-purple-300 text-white font-black text-xs px-3 py-1.5 rounded-full shadow-xl animate-pulse"
        >
          Simulated gaze (Mouse Driven)
        </span>
      )}
    </div>
  );
}
