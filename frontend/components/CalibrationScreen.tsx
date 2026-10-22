"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { GazeFrameState, GazeFeaturesVector } from "@/hooks/useGaze";
import { GazeMapper, type CalibrationSample } from "@/lib/calibration/mapper";
import { type CalibrationQuality } from "@/lib/calibration/quality";
import { Maximize2, Minimize2, X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export interface CalibrationScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (mapper: GazeMapper) => void;
  gazeRef: React.RefObject<GazeFrameState | null>;
  isCameraActive: boolean;
  onStartCamera?: () => void;
}

export type CalibrationStep = "intro" | "calibrating" | "validating" | "results" | "interrupted";

interface TargetPoint {
  x: number; // 0..1 normalized viewport coordinate
  y: number;
  label: string;
}

// 9-point training grid with safe 10% margins from screen edges
const TRAINING_BASE_POINTS: TargetPoint[] = [
  { x: 0.1, y: 0.1, label: "Top Left" },
  { x: 0.5, y: 0.1, label: "Top Center" },
  { x: 0.9, y: 0.1, label: "Top Right" },
  { x: 0.1, y: 0.5, label: "Middle Left" },
  { x: 0.9, y: 0.5, label: "Middle Right" },
  { x: 0.1, y: 0.9, label: "Bottom Left" },
  { x: 0.5, y: 0.9, label: "Bottom Center" },
  { x: 0.9, y: 0.9, label: "Bottom Right" },
  { x: 0.5, y: 0.5, label: "Center" }, // Center point last
];

// 5 validation points (independent positions to measure true error)
const VALIDATION_POINTS: TargetPoint[] = [
  { x: 0.3, y: 0.3, label: "Upper Left" },
  { x: 0.7, y: 0.3, label: "Upper Right" },
  { x: 0.5, y: 0.5, label: "Center" },
  { x: 0.3, y: 0.7, label: "Lower Left" },
  { x: 0.7, y: 0.7, label: "Lower Right" },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
  const scrollPosRef = useRef<number>(0);

  // Lock body scroll while open and restore on close
  useEffect(() => {
    if (!isOpen) return;
    scrollPosRef.current = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollPosRef.current);
    };
  }, [isOpen]);

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
      // Ignore fullscreen policy rejections
    }
  }, []);

  const startCalibration = useCallback(() => {
    if (!isCameraActive && onStartCamera) {
      onStartCamera();
    }

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

  // Keyboard navigation (Esc cancels, Space/Enter starts)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.key === "Enter" || e.key === " ") && (step === "intro" || step === "interrupted")) {
        e.preventDefault();
        startCalibration();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, onClose, startCalibration]);

  // Monitor window resize or blur mid-calibration to avoid corrupted coordinate models
  useEffect(() => {
    if (!isOpen || (step !== "calibrating" && step !== "validating")) return;

    const handleInterruption = () => {
      setStep("interrupted");
    };

    window.addEventListener("resize", handleInterruption);
    window.addEventListener("blur", handleInterruption);

    return () => {
      window.removeEventListener("resize", handleInterruption);
      window.removeEventListener("blur", handleInterruption);
    };
  }, [isOpen, step]);

  // Sequencer loop for calibration targets
  useEffect(() => {
    if (!isOpen || (step !== "calibrating" && step !== "validating")) {
      return;
    }

    let isMounted = true;
    let collectInterval: NodeJS.Timeout | undefined;

    const currentTarget = targets[pointIndex];
    if (!currentTarget) return;

    // Settle phase (~800ms)
    currentPointSamplesRef.current = [];

    const timerId = setTimeout(() => {
      if (!isMounted) return;

      // Collect phase (~30 samples)
      setPointPhase("collecting");
      let sampleCount = 0;
      const targetSampleTotal = 32;

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
            retryCountRef.current = 1;
            setPointPhase("settling");
            setCollectProgress(0);
            return;
          }

          retryCountRef.current = 0;
          const steadySamples = collected.length > 8 ? collected.slice(4) : collected;
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
              } catch {
                setStep("interrupted");
              }
            }
          }
        }
      }, 33);
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      if (collectInterval) clearInterval(collectInterval);
    };
  }, [isOpen, step, targets, pointIndex, gazeRef]);

  if (!isOpen) return null;

  const currentTarget = targets[pointIndex] || { x: 0.5, y: 0.5, label: "Center" };
  const isTargetPhase = step === "calibrating" || step === "validating";

  return (
    <div
      id="calibration-screen-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-screen-title"
      className={`fixed inset-0 z-[9999] bg-[#0F1226] text-white flex flex-col justify-between select-none ${
        isTargetPhase ? "cursor-none" : ""
      }`}
    >
      {/* Fixed Slim Progress Bar at Very Top */}
      <div className="w-full h-1.5 bg-[#181C3A] fixed top-0 left-0 right-0 z-50">
        <div
          className="h-full bg-[#F59E0B] calm-fade"
          style={{
            width: `${
              step === "calibrating"
                ? Math.round(((pointIndex + (collectProgress / 100)) / 9) * 65)
                : step === "validating"
                ? 65 + Math.round(((pointIndex + (collectProgress / 100)) / 5) * 35)
                : step === "results"
                ? 100
                : 0
            }%`,
          }}
        />
      </div>

      {/* Top Bar (Hidden during target tracking to avoid any distraction) */}
      {!isTargetPhase ? (
        <div className="h-16 px-6 sm:px-10 border-b border-[#2E345F] bg-[#181C3A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 id="calibration-screen-title" className="text-xl sm:text-2xl font-semibold text-white">
              Eye Calibration
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="h-10 px-4 rounded-xl bg-[#070b14] border-2 border-slate-700 hover:border-amber-400 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-2 cursor-pointer calm-fade"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? "Exit Fullscreen" : "Go Fullscreen"}</span>
            </button>
            <button
              id="calibration-cancel-btn"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-rose-950/80 border-2 border-rose-700 hover:bg-rose-900 text-rose-200 font-bold text-xs flex items-center gap-2 cursor-pointer calm-fade"
            >
              <X className="w-4 h-4" />
              <span>Cancel (Esc)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Reserved Fixed Status Spot during target tracking: "3 of 9" text */
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-2 rounded-full bg-[#0d1527]/90 border border-slate-700 shadow-xl flex items-center gap-3">
          <span className="text-sm font-black text-amber-300">
            {step === "calibrating" ? `Point ${pointIndex + 1} of 9` : `Validation ${pointIndex + 1} of 5`}
          </span>
          <span className="text-xs text-slate-400">
            {pointPhase === "settling" ? "Look at center" : `${collectProgress}%`}
          </span>
        </div>
      )}

      {/* STEP 1: INTRO SCREEN */}
      {step === "intro" && (
        <div className="max-w-2xl mx-auto my-auto text-center space-y-6 p-6">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border-2 border-indigo-400 text-indigo-300 flex items-center justify-center mx-auto text-3xl shadow-[0_0_24px_rgba(99,102,241,0.2)]">
            🎯
          </div>

          <h3 className="text-3xl sm:text-4xl font-black text-white">
            Let&apos;s Set Up Your Eyes
          </h3>

          <p className="text-lg text-slate-200 leading-relaxed max-w-lg mx-auto">
            Look directly at each glowing dot as it appears on your screen.
            <br />
            <strong className="text-amber-300">Keep your head comfortable and still</strong> while following each dot.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              id="start-calibration-btn"
              onClick={startCalibration}
              className="h-14 px-8 rounded-2xl bg-white hover:bg-slate-100 text-[#0F1226] font-semibold text-lg border-2 border-white shadow-2xl cursor-pointer calm-fade"
            >
              Start Eye Setup (Space)
            </button>
            {!isFullscreen && (
              <button
                onClick={toggleFullscreen}
                className="h-14 px-6 rounded-2xl bg-[#181C3A] border border-[#2E345F] hover:border-white text-slate-200 hover:text-white font-semibold text-base cursor-pointer calm-fade"
              >
                Go Fullscreen (Recommended)
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 2 & 3: TARGET TRACKING (Rock-Solid Fixed Coordinate with Shrinking Ring) */}
      {isTargetPhase && (
        <div className="fixed inset-0 w-full h-full pointer-events-none">
          {/* Static Center Point with Shrinking Ring Around It - NO translation animation */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{
              left: `${currentTarget.x * 100}%`,
              top: `${currentTarget.y * 100}%`,
            }}
          >
            {/* Outer Shrinking Ring (SVG shrinking radius, dot center stays strictly static) */}
            <svg className="w-24 h-24 -rotate-90 pointer-events-none" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="36"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="4"
                strokeDasharray={226}
                strokeDashoffset={pointPhase === "settling" ? 0 : 226 * (collectProgress / 100)}
                className="calm-fade opacity-90"
              />
            </svg>

            {/* Static Solid White Center Dot with amber inner ring */}
            <div className="absolute w-7 h-7 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.9)]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            </div>
          </div>
        </div>
      )}

      {/* STEP: INTERRUPTED (Window resized or lost focus) */}
      {step === "interrupted" && (
        <div className="max-w-xl mx-auto my-auto text-center space-y-6 p-8 bg-[#0d1527] border-4 border-slate-800 rounded-3xl shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-2xl">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white">
            Calibration Paused
          </h3>

          <p className="text-base text-slate-300 leading-relaxed">
            The window changed size or switched focus. Restarting will make sure your eye tracking remains super accurate.
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={startCalibration}
              className="h-14 px-8 rounded-2xl bg-brand-gradient hover:opacity-95 text-white font-semibold text-lg cursor-pointer calm-fade shadow-lg"
            >
              Restart Calibration
            </button>
            <button
              onClick={onClose}
              className="h-14 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base border border-slate-700 cursor-pointer calm-fade"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RESULTS SCREEN */}
      {step === "results" && qualityResult && (
        <div className="max-w-2xl mx-auto my-auto text-center space-y-6 bg-[#0d1527] border-4 border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-400/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-3xl font-black text-emerald-300">
            Eyes Ready!
          </h3>

          <p className="text-base text-slate-200">
            Eye tracking has been tuned to your screen. You can now select buttons by looking at them!
          </p>

          <div className="pt-4 flex gap-4 justify-center">
            <button
              id="calibration-done-btn"
              onClick={() => {
                if (fittedMapper) onComplete(fittedMapper);
                onClose();
              }}
              className="h-16 px-10 rounded-2xl bg-brand-gradient hover:opacity-95 text-white font-semibold text-xl cursor-pointer calm-fade shadow-xl"
            >
              Start Learning!
            </button>
            <button
              onClick={startCalibration}
              className="h-16 px-6 rounded-2xl bg-[#070b14] border-2 border-slate-700 hover:border-indigo-400 text-slate-200 font-semibold text-base cursor-pointer calm-fade flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tune Again</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom spacer for layout balance */}
      <div className="h-4" />
    </div>
  );
}
