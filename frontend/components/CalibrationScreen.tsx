"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { GazeFrameState, GazeFeaturesVector } from "@/hooks/useGaze";
import { GazeMapper, type CalibrationSample } from "@/lib/calibration/mapper";
import { type CalibrationQuality } from "@/lib/calibration/quality";

export interface CalibrationScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (mapper: GazeMapper) => void;
  gazeRef: React.RefObject<GazeFrameState>;
  isCameraActive: boolean;
  onStartCamera?: () => void;
}

export type CalibrationStep = "intro" | "calibrating" | "validating" | "results";

interface TargetPoint {
  x: number; // 0..1 normalized viewport coordinate
  y: number;
  label: string;
}

// 9-point training grid (corners, edge midpoints, center)
const TRAINING_BASE_POINTS: TargetPoint[] = [
  { x: 0.1, y: 0.1, label: "Top Left" },
  { x: 0.5, y: 0.1, label: "Top Center" },
  { x: 0.9, y: 0.1, label: "Top Right" },
  { x: 0.1, y: 0.5, label: "Middle Left" },
  { x: 0.9, y: 0.5, label: "Middle Right" },
  { x: 0.1, y: 0.9, label: "Bottom Left" },
  { x: 0.5, y: 0.9, label: "Bottom Center" },
  { x: 0.9, y: 0.9, label: "Bottom Right" },
  { x: 0.5, y: 0.5, label: "Center" }, // Kept last
];

// 5 validation points (independent positions to measure true error)
const VALIDATION_POINTS: TargetPoint[] = [
  { x: 0.3, y: 0.3, label: "Val Upper-Left" },
  { x: 0.7, y: 0.3, label: "Val Upper-Right" },
  { x: 0.5, y: 0.5, label: "Val Center" },
  { x: 0.3, y: 0.7, label: "Val Lower-Left" },
  { x: 0.7, y: 0.7, label: "Val Lower-Right" },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes median GazeFeaturesVector across collected samples.
 */
function computeMedianFeatures(samples: GazeFeaturesVector[]): GazeFeaturesVector {
  return {
    irisX: median(samples.map((s) => s.irisX)),
    irisY: median(samples.map((s) => s.irisY)),
    yaw: median(samples.map((s) => s.yaw)),
    pitch: median(samples.map((s) => s.pitch)),
    roll: median(samples.map((s) => s.roll)),
  };
}

export function CalibrationScreen({
  isOpen,
  onClose,
  onComplete,
  gazeRef,
  isCameraActive,
  onStartCamera,
}: CalibrationScreenProps) {
  const [step, setStep] = useState<CalibrationStep>("intro");
  const [targets, setTargets] = useState<TargetPoint[]>(TRAINING_BASE_POINTS);
  const [pointIndex, setPointIndex] = useState<number>(0);
  const [pointPhase, setPointPhase] = useState<"settling" | "collecting">("settling");
  const [collectProgress, setCollectProgress] = useState<number>(0);
  const [qualityResult, setQualityResult] = useState<CalibrationQuality | null>(null);
  const [fittedMapper, setFittedMapper] = useState<GazeMapper | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active calibration data stores
  const trainingDataRef = useRef<CalibrationSample[]>([]);
  const validationDataRef = useRef<CalibrationSample[]>([]);
  const currentPointSamplesRef = useRef<GazeFeaturesVector[]>([]);
  const retryCountRef = useRef<number>(0);

  // Fullscreen helper
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen policy errors
    }
  }, []);

  const startCalibration = useCallback(() => {
    if (!isCameraActive && onStartCamera) {
      onStartCamera();
    }

    // Shuffle first 8 outer points, keep center (cc) last
    const outer = TRAINING_BASE_POINTS.slice(0, 8);
    const shuffledOuter = [...outer].sort(() => Math.random() - 0.5);
    const trainingTargets = [...shuffledOuter, TRAINING_BASE_POINTS[8]];

    setTargets(trainingTargets);
    trainingDataRef.current = [];
    validationDataRef.current = [];
    currentPointSamplesRef.current = [];
    retryCountRef.current = 0;

    setStep("calibrating");
    setPointIndex(0);
    setPointPhase("settling");
    setCollectProgress(0);
    setQualityResult(null);
    setFittedMapper(null);
  }, [isCameraActive, onStartCamera]);

  // Keyboard navigation (Space/Enter to start, Escape to exit)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.key === "Enter" || e.key === " ") && step === "intro") {
        e.preventDefault();
        startCalibration();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, onClose, startCalibration]);

  // Listen to fullscreen changes cleanly
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Calibration point sequencer loop
  useEffect(() => {
    if (!isOpen || (step !== "calibrating" && step !== "validating")) {
      return;
    }

    let isMounted = true;
    let collectInterval: NodeJS.Timeout | undefined;

    const currentTarget = targets[pointIndex];
    if (!currentTarget) return;

    // Phase 1: Settle phase (~850ms) to ensure eyes have fully landed and fixated on dot
    currentPointSamplesRef.current = [];

    const timerId = setTimeout(() => {
      if (!isMounted) return;

      // Phase 2: Collect phase (~35 good samples at ~30Hz)
      setPointPhase("collecting");
      let sampleCount = 0;
      const targetSampleTotal = 35;

      collectInterval = setInterval(() => {
        if (!isMounted) return;

        const currentGaze = gazeRef.current;
        if (
          currentGaze &&
          currentGaze.faceVisible &&
          !currentGaze.isBlinking &&
          currentGaze.confidence >= 0.35
        ) {
          currentPointSamplesRef.current.push({ ...currentGaze.features });
          sampleCount++;
          setCollectProgress(Math.min(100, Math.round((sampleCount / targetSampleTotal) * 100)));
        }

        if (sampleCount >= targetSampleTotal) {
          if (collectInterval) clearInterval(collectInterval);

          const collected = currentPointSamplesRef.current;
          if (collected.length < 15 && retryCountRef.current === 0) {
            // Retry point once if too few clean samples collected
            retryCountRef.current = 1;
            setPointPhase("settling");
            setCollectProgress(0);
            return;
          }

          retryCountRef.current = 0;
          // Discard initial saccade transition frames (first 5 samples) to get pure steady-state fixation
          const steadySamples = collected.length > 10 ? collected.slice(5) : collected;
          const medianFeat = computeMedianFeatures(
            steadySamples.length > 0
              ? steadySamples
              : [currentGaze?.features || { irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }]
          );

          if (step === "calibrating") {
            trainingDataRef.current.push({
              features: medianFeat,
              target: { x: currentTarget.x, y: currentTarget.y },
            });

            if (pointIndex + 1 < targets.length) {
              setPointPhase("settling");
              setCollectProgress(0);
              setPointIndex((prev) => prev + 1);
            } else {
              // Transition to 5-point validation
              setTargets(VALIDATION_POINTS);
              setPointPhase("settling");
              setCollectProgress(0);
              setStep("validating");
              setPointIndex(0);
            }
          } else if (step === "validating") {
            validationDataRef.current.push({
              features: medianFeat,
              target: { x: currentTarget.x, y: currentTarget.y },
            });

            if (pointIndex + 1 < targets.length) {
              setPointPhase("settling");
              setCollectProgress(0);
              setPointIndex((prev) => prev + 1);
            } else {
              // Fit regression model & evaluate quality
              const width = typeof window !== "undefined" ? window.innerWidth : 1920;
              const height = typeof window !== "undefined" ? window.innerHeight : 1080;

              try {
                const mapper = GazeMapper.fit(
                  trainingDataRef.current,
                  validationDataRef.current,
                  width,
                  height
                );
                setFittedMapper(mapper);
                setQualityResult(mapper.quality);
                setStep("results");
              } catch (err) {
                console.error("AI Tutor: Error during calibration fit:", err);
                setStep("results");
              }
            }
          }
        }
      }, 33);
    }, 700);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      if (collectInterval) clearInterval(collectInterval);
    };
  }, [isOpen, step, pointIndex, targets, gazeRef]);

  if (!isOpen) return null;

  const currentTarget = targets[pointIndex] || { x: 0.5, y: 0.5, label: "Center" };

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14]/95 backdrop-blur-xl text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg">
            AI
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-300">
            Eye Calibration Wizard
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm border border-slate-700 cursor-pointer"
          >
            {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold rounded-xl text-sm border border-rose-700 cursor-pointer"
          >
            ✕ Cancel
          </button>
        </div>
      </div>

      {/* STEP 1: INTRO */}
      {step === "intro" && (
        <div className="max-w-2xl mx-auto my-auto text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-amber-400/20 border-2 border-amber-400 text-5xl flex items-center justify-center mx-auto mb-2 text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
            🎯
          </div>

          <h3 className="text-3xl sm:text-4xl font-black text-white">
            Let&apos;s Set Up Your Eyes
          </h3>

          <p className="text-lg sm:text-xl text-slate-200 leading-relaxed">
            Follow each glowing dot on the screen with your eyes.
            <br />
            <strong className="text-amber-300">Keep your head fairly still</strong> while looking at the center of each dot.
          </p>

          {!isCameraActive && (
            <div className="p-4 bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl text-amber-200 font-bold text-base flex items-center justify-center gap-3">
              <span>⚠️</span>
              <span>Your camera is currently off. Starting calibration will turn it on.</span>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={startCalibration}
              className="min-h-[64px] px-10 py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-2xl rounded-2xl shadow-2xl border-2 border-amber-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Start Calibration (Space)
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Tip: Pressing Fullscreen beforehand improves accuracy.
          </p>
        </div>
      )}

      {/* STEP 2 & 3: CALIBRATING & VALIDATING (AUTOMATIC TARGET POINT) */}
      {(step === "calibrating" || step === "validating") && (
        <div className="relative flex-1 w-full h-full">
          {/* Status Overlay at top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#0d1527]/90 border border-slate-700 px-6 py-2.5 rounded-full text-center shadow-lg">
            <span className="text-sm font-bold text-amber-300">
              {step === "calibrating"
                ? `Training Point ${pointIndex + 1} of 9`
                : `Validation Target ${pointIndex + 1} of 5`}
            </span>
            <span className="text-xs text-slate-400 ml-2">
              ({pointPhase === "settling" ? "Settle eyes..." : `Recording: ${collectProgress}%`})
            </span>
          </div>

          {/* Dynamic Calibration Dot with Shrinking Ring */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex items-center justify-center pointer-events-none"
            style={{
              left: `${currentTarget.x * 100}%`,
              top: `${currentTarget.y * 100}%`,
            }}
          >
            {/* Animated Shrinking Ring */}
            <div
              className={`w-20 h-20 rounded-full border-4 ${
                step === "calibrating" ? "border-amber-400" : "border-cyan-400"
              } animate-ping opacity-60`}
            />

            {/* Solid Center Dot */}
            <div
              className={`absolute w-8 h-8 rounded-full ${
                step === "calibrating"
                  ? "bg-amber-400 shadow-[0_0_20px_#fbbf24]"
                  : "bg-cyan-400 shadow-[0_0_20px_#22d3ee]"
              } border-2 border-white flex items-center justify-center`}
            >
              <div className="w-2 h-2 rounded-full bg-slate-950" />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: RESULTS SCREEN */}
      {step === "results" && qualityResult && (
        <div className="max-w-2xl mx-auto my-auto text-center space-y-6 bg-[#0d1527] border-4 border-slate-800 p-8 rounded-3xl shadow-2xl">
          {/* Grade Badge */}
          <div className="flex flex-col items-center">
            <span className="text-6xl mb-2">
              {qualityResult.grade === "good" ? "✨" : qualityResult.grade === "okay" ? "👍" : "⚠️"}
            </span>
            <h3
              className={`text-3xl sm:text-4xl font-black ${
                qualityResult.grade === "good"
                  ? "text-emerald-400"
                  : qualityResult.grade === "okay"
                  ? "text-amber-300"
                  : "text-rose-400"
              }`}
            >
              {qualityResult.grade === "good"
                ? "Excellent Eye Calibration!"
                : qualityResult.grade === "okay"
                ? "Good Calibration"
                : "Calibration Needs Tuning"}
            </h3>
            <p className="text-lg text-slate-300 mt-2">
              Average Accuracy Error:{" "}
              <strong className="text-white">
                {qualityResult.meanErrorPercent}% of screen (~{qualityResult.meanErrorPx}px)
              </strong>
            </p>
          </div>

          {/* Validation Scatter Map Preview */}
          <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-700">
            <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">
              Validation Accuracy Map
            </h4>
            <div className="relative w-full h-36 bg-[#090e1a] rounded-xl border border-slate-800 overflow-hidden">
              {qualityResult.pointResults.map((res, i) => (
                <React.Fragment key={i}>
                  {/* True target point (Cyan) */}
                  <div
                    className="absolute w-3 h-3 rounded-full bg-cyan-400 -translate-x-1/2 -translate-y-1/2 shadow"
                    style={{ left: `${res.target.x * 100}%`, top: `${res.target.y * 100}%` }}
                    title="Target Point"
                  />
                  {/* Predicted point (Amber) */}
                  <div
                    className="absolute w-3 h-3 rounded-full bg-amber-400 -translate-x-1/2 -translate-y-1/2 border border-slate-900"
                    style={{ left: `${res.predicted.x * 100}%`, top: `${res.predicted.y * 100}%` }}
                    title="Predicted Point"
                  />
                  {/* Error line */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line
                      x1={`${res.target.x * 100}%`}
                      y1={`${res.target.y * 100}%`}
                      x2={`${res.predicted.x * 100}%`}
                      y2={`${res.predicted.y * 100}%`}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                  </svg>
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-2 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> True Target
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Eye Prediction
              </span>
            </div>
          </div>

          {/* Friendly Guidance Tips if poor */}
          {qualityResult.grade === "poor" && (
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 text-left text-sm space-y-1.5 text-slate-300">
              <p className="font-bold text-amber-300 mb-1">💡 Tips for better accuracy:</p>
              <p>• Ensure good front lighting on your face without bright backlighting.</p>
              <p>• Sit about an arm&apos;s length (~50cm) away with camera near eye level.</p>
              <p>• Keep your head still and follow each dot with your eyes only.</p>
              <p>• Try fullscreen mode (⛶) before calibrating.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            {fittedMapper && (
              <button
                onClick={() => {
                  onComplete(fittedMapper);
                  onClose();
                }}
                className="px-8 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xl rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Use This Calibration
              </button>
            )}
            <button
              onClick={startCalibration}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg rounded-xl border border-slate-600 transition-all cursor-pointer"
            >
              Recalibrate
            </button>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-400">
        AI Tutor Gaze Calibration • 100% Client-Side Privacy • No Video Transmitted
      </div>
    </div>
  );
}
