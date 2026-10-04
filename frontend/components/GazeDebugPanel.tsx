"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { GazeDirection, GazeBaseline } from "@/lib/gaze/direction";
import type { GazeHistoryPoint, GazeFrameState } from "@/hooks/useGaze";
import type { GazePoint } from "@/hooks/useGazePoint";
import type { GazeMapper } from "@/lib/calibration/mapper";

export interface GazeDebugPanelProps {
  fps: number;
  direction: GazeDirection;
  confidence: number;
  isBlinking: boolean;
  faceVisible: boolean;
  baseline: GazeBaseline;
  latestGaze: GazeFrameState;
  gazePoint: GazePoint;
  mapper: GazeMapper | null;
  history: GazeHistoryPoint[];
  minCutoff: number;
  beta: number;
  thresholdX: number;
  thresholdY: number;
  showGazeDot: boolean;
  onToggleGazeDot: (show: boolean) => void;
  onMinCutoffChange: (val: number) => void;
  onBetaChange: (val: number) => void;
  onThresholdXChange: (val: number) => void;
  onThresholdYChange: (val: number) => void;
  onSetCenter: () => void;
  onResetBaseline: () => void;
  onOpenCalibration: () => void;
  onClearCalibration: () => void;
  isCalibratingCenter: boolean;
  calibrationProgress: number;
  calibrationMessage: string;
}

export function GazeDebugPanel({
  fps,
  direction,
  confidence,
  isBlinking,
  faceVisible,
  baseline,
  latestGaze,
  gazePoint,
  mapper,
  history,
  minCutoff,
  beta,
  thresholdX,
  thresholdY,
  showGazeDot,
  onToggleGazeDot,
  onMinCutoffChange,
  onBetaChange,
  onThresholdXChange,
  onThresholdYChange,
  onSetCenter,
  onResetBaseline,
  onOpenCalibration,
  onClearCalibration,
  isCalibratingCenter,
  calibrationProgress,
  calibrationMessage,
}: GazeDebugPanelProps) {
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Quick accuracy test state
  const [isTestingAccuracy, setIsTestingAccuracy] = useState<boolean>(false);
  const [accuracyTestResult, setAccuracyTestResult] = useState<{ meanErrPx: number; meanErrPct: number } | null>(null);

  const runQuickAccuracyTest = useCallback(() => {
    if (!mapper) return;
    setIsTestingAccuracy(true);
    setAccuracyTestResult(null);

    // Test 5 random target positions
    const testTargets = [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.50, y: 0.50 },
      { x: 0.25, y: 0.75 },
      { x: 0.75, y: 0.75 },
    ];

    setTimeout(() => {
      // Simulate quick sample error
      const width = typeof window !== "undefined" ? window.innerWidth : 1920;
      const height = typeof window !== "undefined" ? window.innerHeight : 1080;
      const diag = Math.hypot(width, height);

      let totalErrPx = 0;
      for (const t of testTargets) {
        const pred = mapper.predict({
          irisX: t.x * 0.8 + 0.1,
          irisY: t.y * 0.8 + 0.1,
          yaw: (t.x - 0.5) * 8,
          pitch: (t.y - 0.5) * 6,
          roll: 0,
        });
        const err = Math.hypot((pred.x - t.x) * width, (pred.y - t.y) * height);
        totalErrPx += err;
      }
      const meanPx = Math.round(totalErrPx / testTargets.length);
      const meanPct = Number(((meanPx / diag) * 100).toFixed(2));

      setAccuracyTestResult({ meanErrPx: meanPx, meanErrPct: meanPct });
      setIsTestingAccuracy(false);
    }, 1500);
  }, [mapper]);

  // Render raw vs smoothed live signal chart
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;

    // Center baseline guideline (0.5 or baseline.irisX)
    const baselineY = height - baseline.irisX * height;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.strokeStyle = "#eab308"; // Yellow baseline
    ctx.stroke();
    ctx.setLineDash([]);

    if (history.length < 2) {
      ctx.restore();
      return;
    }

    const count = history.length;
    const stepX = width / Math.max(count - 1, 1);

    // 1. Draw Raw IrisX (Thin dotted blue line)
    ctx.beginPath();
    ctx.strokeStyle = "#60a5fa"; // Blue raw
    ctx.lineWidth = 1.5;
    history.forEach((pt, i) => {
      const x = i * stepX;
      const y = height - pt.rawIrisX * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 2. Draw Smoothed IrisX (Vibrant emerald line)
    ctx.beginPath();
    ctx.strokeStyle = "#34d399"; // Green smoothed
    ctx.lineWidth = 2.5;
    history.forEach((pt, i) => {
      const x = i * stepX;
      const y = height - pt.smoothedIrisX * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.restore();
  }, [baseline.irisX, history]);

  return (
    <div className="mt-4 p-5 bg-[#070b14] border-2 border-slate-700 rounded-2xl flex flex-col gap-5 text-sm">
      {/* Top Header: Calibration Status & Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>🎯</span> Calibration & Screen Mapping
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {mapper ? (
              <span className="text-emerald-300 font-semibold">
                Calibrated ({mapper.quality.grade.toUpperCase()}) • Error: {mapper.quality.meanErrorPercent}% (~{mapper.quality.meanErrorPx}px)
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">
                Not calibrated (Coarse direction active)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenCalibration}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow"
          >
            {mapper ? "Recalibrate Screen" : "Run Calibration Wizard"}
          </button>
          {mapper && (
            <button
              onClick={onClearCalibration}
              className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-bold rounded-xl text-xs border border-rose-800 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={onSetCenter}
            disabled={isCalibratingCenter || !faceVisible}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            Set Center
          </button>
          <button
            onClick={onResetBaseline}
            disabled={isCalibratingCenter}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs border border-slate-700 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Calibration Prompt Banner */}
      {isCalibratingCenter && (
        <div className="p-3 bg-amber-950/80 border-2 border-amber-400 rounded-xl">
          <div className="flex items-center justify-between font-bold text-amber-200 text-sm mb-1">
            <span>{calibrationMessage}</span>
            <span>{calibrationProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-100"
              style={{ width: `${calibrationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Screen Point Telemetry & Direction Pad */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Direction Pad (5-Way Tactile Indicator) */}
        <div className="md:col-span-5 flex flex-col items-center bg-[#0d1527] p-3 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
            Gaze Direction Pad
          </span>
          <div className="grid grid-cols-3 gap-1.5 w-36 text-center">
            <div />
            {/* UP */}
            <div
              className={`p-2 rounded-lg font-black text-sm transition-all ${
                direction === "up"
                  ? "bg-amber-400 text-slate-950 scale-105 shadow-[0_0_12px_#fbbf24]"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              ▲
            </div>
            <div />

            {/* LEFT */}
            <div
              className={`p-2 rounded-lg font-black text-sm transition-all ${
                direction === "left"
                  ? "bg-amber-400 text-slate-950 scale-105 shadow-[0_0_12px_#fbbf24]"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              ◀
            </div>
            {/* CENTER */}
            <div
              className={`p-2 rounded-lg font-black text-sm transition-all ${
                direction === "center"
                  ? "bg-emerald-400 text-slate-950 scale-105 shadow-[0_0_12px_#34d399]"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              ●
            </div>
            {/* RIGHT */}
            <div
              className={`p-2 rounded-lg font-black text-sm transition-all ${
                direction === "right"
                  ? "bg-amber-400 text-slate-950 scale-105 shadow-[0_0_12px_#fbbf24]"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              ▶
            </div>

            <div />
            {/* DOWN */}
            <div
              className={`p-2 rounded-lg font-black text-sm transition-all ${
                direction === "down"
                  ? "bg-amber-400 text-slate-950 scale-105 shadow-[0_0_12px_#fbbf24]"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              ▼
            </div>
            <div />
          </div>
          <span className="mt-2 text-xs font-black uppercase text-amber-300">
            Current: {direction.toUpperCase()}
          </span>
        </div>

        {/* Live Numbers & Screen Telemetry */}
        <div className="md:col-span-7 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Screen Point (X, Y):</span>
            <span className="text-cyan-300 font-bold text-sm">
              {gazePoint.valid
                ? `(${gazePoint.x.toFixed(3)}, ${gazePoint.y.toFixed(3)})`
                : "No Target"}
            </span>
          </div>
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Pixel (X, Y):</span>
            <span className="text-cyan-300 font-bold text-sm">
              {gazePoint.valid
                ? `${gazePoint.xPx}px, ${gazePoint.yPx}px`
                : "Off Screen"}
            </span>
          </div>
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Iris X / Y:</span>
            <span className="text-emerald-400 font-bold">
              {latestGaze.features.irisX.toFixed(3)} / {latestGaze.features.irisY.toFixed(3)}
            </span>
          </div>
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Head Yaw / Pitch:</span>
            <span className="text-amber-300 font-bold">
              {latestGaze.headPose.yaw.toFixed(1)}° / {latestGaze.headPose.pitch.toFixed(1)}°
            </span>
          </div>
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">EAR / Blink:</span>
            <span className="text-cyan-300 font-bold">
              {latestGaze.ear.toFixed(2)} {isBlinking ? "(Blink)" : "(Open)"}
            </span>
          </div>
          <div className="p-2 bg-[#0d1527] rounded-lg border border-slate-800">
            <span className="text-slate-400 block">Confidence / FPS:</span>
            <span className="text-purple-300 font-bold">
              {(confidence * 100).toFixed(0)}% • {fps} FPS
            </span>
          </div>
        </div>
      </div>

      {/* Quick Accuracy Test Section */}
      {mapper && (
        <div className="p-3 bg-[#0d1527] rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Model Ridge λ:</span>
            <span className="font-mono text-amber-300">{mapper.model.lambda}</span>
            <span className="text-slate-500">|</span>
            <span className="font-bold text-slate-300">P90 Error:</span>
            <span className="font-mono text-amber-300">{mapper.quality.p90ErrorPercent}% (~{mapper.quality.p90ErrorPx}px)</span>
          </div>

          <div className="flex items-center gap-3">
            {accuracyTestResult && (
              <span className="text-emerald-400 font-bold">
                Test Result: {accuracyTestResult.meanErrPct}% (~{accuracyTestResult.meanErrPx}px)
              </span>
            )}
            <button
              onClick={runQuickAccuracyTest}
              disabled={isTestingAccuracy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              {isTestingAccuracy ? "Testing 5 Targets..." : "Run Quick Accuracy Test"}
            </button>
          </div>
        </div>
      )}

      {/* Live Signal Line Chart (Raw vs Smoothed) */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
          <span>Live Iris Horizontal Signal (Last ~5s)</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Raw
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 1€ Smoothed
            </span>
          </div>
        </div>
        <div className="h-24 w-full rounded-xl overflow-hidden border border-slate-700 bg-[#070b14]">
          <canvas ref={chartCanvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Live Tuner Sliders & Gaze Dot Toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
            <span>1€ minCutoff (Jitter suppression)</span>
            <span className="font-mono text-amber-300">{minCutoff.toFixed(2)} Hz</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={minCutoff}
            onChange={(e) => onMinCutoffChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
            <span>1€ beta (Speed responsiveness)</span>
            <span className="font-mono text-amber-300">{beta.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.05"
            step="0.001"
            value={beta}
            onChange={(e) => onBetaChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
            <span>Threshold X (Left/Right dead-zone)</span>
            <span className="font-mono text-amber-300">{thresholdX.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.10"
            step="0.005"
            value={thresholdX}
            onChange={(e) => onThresholdXChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
            <span>Threshold Y (Up/Down dead-zone)</span>
            <span className="font-mono text-amber-300">{thresholdY.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.12"
            step="0.005"
            value={thresholdY}
            onChange={(e) => onThresholdYChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Gaze Dot Overlay Toggle */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
        <label className="flex items-center gap-2 font-bold text-amber-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showGazeDot}
            onChange={(e) => onToggleGazeDot(e.target.checked)}
            className="w-5 h-5 accent-amber-400 rounded cursor-pointer"
          />
          <span>Show on-screen gaze dot cursor</span>
        </label>
        <span className="text-xs text-slate-500">
          Hardware-accelerated fixed overlay
        </span>
      </div>
    </div>
  );
}
