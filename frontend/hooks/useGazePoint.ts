"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { GazeFrameState } from "./useGaze";
import { GazeMapper } from "@/lib/calibration/mapper";
import { OneEuroFilter } from "@/lib/gaze/smoothing";

export interface GazePoint {
  x: number;          // Normalized [0..1] viewport X
  y: number;          // Normalized [0..1] viewport Y
  xPx: number;        // Viewport pixel X
  yPx: number;        // Viewport pixel Y
  confidence: number; // 0..1
  timestamp: number;
  valid: boolean;
}

export interface UseGazePointOptions {
  gazeRef: React.RefObject<GazeFrameState>;
  mapper: GazeMapper | null;
  minCutoff?: number; // Screen coordinate filter minCutoff (default: 1.2)
  beta?: number;      // Screen coordinate filter beta (default: 0.01)
}

export interface UseGazePointReturn {
  gazePointRef: React.RefObject<GazePoint>;
  // Throttled UI state
  gazePoint: GazePoint;
  isValid: boolean;
  processGazeFrame: (frame: GazeFrameState) => GazePoint;
}

const DEFAULT_GAZE_POINT: GazePoint = {
  x: 0.5,
  y: 0.5,
  xPx: 0,
  yPx: 0,
  confidence: 0,
  timestamp: 0,
  valid: false,
};

export function useGazePoint({
  gazeRef,
  mapper,
  minCutoff = 1.2,
  beta = 0.01,
}: UseGazePointOptions): UseGazePointReturn {
  const [gazePoint, setGazePoint] = useState<GazePoint>(DEFAULT_GAZE_POINT);

  const filterXRef = useRef<OneEuroFilter>(new OneEuroFilter({ minCutoff, beta }));
  const filterYRef = useRef<OneEuroFilter>(new OneEuroFilter({ minCutoff, beta }));

  const lastValidTimeRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);

  const gazePointRef = useRef<GazePoint>(DEFAULT_GAZE_POINT);

  // Update filters if props change
  useEffect(() => {
    filterXRef.current.minCutoff = minCutoff;
    filterXRef.current.beta = beta;
    filterYRef.current.minCutoff = minCutoff;
    filterYRef.current.beta = beta;
  }, [beta, minCutoff]);

  const processGazeFrame = useCallback(
    (frame: GazeFrameState): GazePoint => {
      const now = frame.timestamp || performance.now();
      const width = typeof window !== "undefined" ? window.innerWidth : 1920;
      const height = typeof window !== "undefined" ? window.innerHeight : 1080;

      if (!mapper || !frame.faceVisible || frame.confidence < 0.2) {
        // If face was recently lost or confidence is low, hold for up to 300ms
        const isWithinGracePeriod = now - lastValidTimeRef.current <= 300;
        const pt: GazePoint = {
          ...gazePointRef.current,
          valid: isWithinGracePeriod && gazePointRef.current.valid,
          confidence: 0,
          timestamp: now,
        };
        gazePointRef.current = pt;
        return pt;
      }

      if (frame.isBlinking) {
        // Hold last valid point during blinks for up to 350ms
        const isBlinkGrace = now - lastValidTimeRef.current <= 350;
        const pt: GazePoint = {
          ...gazePointRef.current,
          valid: isBlinkGrace,
          timestamp: now,
        };
        gazePointRef.current = pt;
        return pt;
      }

      // Predict raw viewport coordinates
      const pred = mapper.predict(frame.features);

      // Smooth on-screen coordinates
      const smoothX = filterXRef.current.filter(pred.x, now);
      const smoothY = filterYRef.current.filter(pred.y, now);

      const clampedX = Math.max(0.0, Math.min(1.0, smoothX));
      const clampedY = Math.max(0.0, Math.min(1.0, smoothY));

      const xPx = Math.round(clampedX * width);
      const yPx = Math.round(clampedY * height);

      lastValidTimeRef.current = now;

      const newPoint: GazePoint = {
        x: clampedX,
        y: clampedY,
        xPx,
        yPx,
        confidence: frame.confidence,
        timestamp: now,
        valid: true,
      };

      gazePointRef.current = newPoint;

      // Throttle React state updates to ~10 Hz (100ms)
      if (now - lastStateUpdateRef.current >= 100) {
        lastStateUpdateRef.current = now;
        setGazePoint(newPoint);
      }

      return newPoint;
    },
    [mapper]
  );

  // Background rAF polling loop reading from gazeRef continuously
  useEffect(() => {
    let animId: number;
    let isActive = true;

    const tick = () => {
      if (!isActive) return;
      if (gazeRef.current) {
        processGazeFrame(gazeRef.current);
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [gazeRef, processGazeFrame]);

  return {
    gazePointRef,
    gazePoint,
    isValid: gazePoint.valid,
    processGazeFrame,
  };
}
