"use client";

import React, { useRef, useEffect } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  LEFT_EYE_CONTOUR,
  RIGHT_EYE_CONTOUR,
  LEFT_IRIS_INDICES,
  RIGHT_IRIS_INDICES,
  LEFT_IRIS_CENTER,
  RIGHT_IRIS_CENTER,
} from "@/lib/landmarks";

export interface LandmarkOverlayProps {
  landmarks: NormalizedLandmark[] | null;
  videoElement: HTMLVideoElement | null;
  visible?: boolean;
  className?: string;
}

export function LandmarkOverlay({
  landmarks,
  videoElement,
  visible = true,
  className = "",
}: LandmarkOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI / Retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.round(rect.width);
    const displayHeight = Math.round(rect.height);

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (!visible || !landmarks || landmarks.length < 478 || displayWidth === 0 || displayHeight === 0) {
      ctx.restore();
      return;
    }

    // Helper: Convert normalized (0..1) coordinate to canvas pixel coordinate
    const toPx = (lm: NormalizedLandmark) => ({
      x: lm.x * displayWidth,
      y: lm.y * displayHeight,
    });

    // 1. Draw Eye Contours (Crisp high-contrast cyan lines)
    const drawContour = (indices: readonly number[], strokeColor: string) => {
      if (indices.length === 0) return;
      ctx.beginPath();
      const firstPt = toPx(landmarks[indices[0]]);
      ctx.moveTo(firstPt.x, firstPt.y);

      for (let i = 1; i < indices.length; i++) {
        const pt = toPx(landmarks[indices[i]]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    };

    // Draw Left & Right Eye contours
    drawContour(LEFT_EYE_CONTOUR, "#38bdf8"); // Sky cyan
    drawContour(RIGHT_EYE_CONTOUR, "#38bdf8");

    // 2. Draw Irises (Amber / Yellow with Center Highlight)
    const drawIris = (
      centerIdx: number,
      contourIndices: readonly number[],
      ringColor: string,
      centerColor: string
    ) => {
      const centerPt = toPx(landmarks[centerIdx]);

      // Calculate approximate iris radius from perimeter points
      let avgRadius = 0;
      for (const idx of contourIndices) {
        const pt = toPx(landmarks[idx]);
        const dist = Math.hypot(pt.x - centerPt.x, pt.y - centerPt.y);
        avgRadius += dist;
      }
      avgRadius = contourIndices.length > 0 ? avgRadius / contourIndices.length : 5;

      // Draw outer iris boundary ring
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, Math.max(avgRadius, 4), 0, 2 * Math.PI);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
      ctx.fill();

      // Draw perimeter points
      for (const idx of contourIndices) {
        const pt = toPx(landmarks[idx]);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = ringColor;
        ctx.fill();
      }

      // Draw highlighted iris / pupil center point
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = centerColor;
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // Draw Left & Right Iris
    drawIris(
      LEFT_IRIS_CENTER,
      LEFT_IRIS_INDICES.slice(1),
      "#fbbf24", // Amber-400
      "#ffffff"  // White center
    );
    drawIris(
      RIGHT_IRIS_CENTER,
      RIGHT_IRIS_INDICES.slice(1),
      "#fbbf24",
      "#ffffff"
    );

    ctx.restore();
  }, [landmarks, videoElement, visible]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none [transform:scaleX(-1)] ${className}`}
    />
  );
}
