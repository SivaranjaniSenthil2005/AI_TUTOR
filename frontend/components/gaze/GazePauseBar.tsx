"use client";

import React from "react";
import { useGazeContext } from "@/lib/gazeui/GazeContext";
import { GazeButton } from "./GazeButton";

export interface GazePauseBarProps {
  onOpenSettings?: () => void;
  onOpenCalibration?: () => void;
  onSetCenter?: () => void;
  isCalibrated?: boolean;
}

export function GazePauseBar({
  onOpenSettings,
  onOpenCalibration,
  onSetCenter,
  isCalibrated = false,
}: GazePauseBarProps) {
  const { isPaused, autoPaused, pauseEyeControl, resumeEyeControl, settings } = useGazeContext();

  const isEffectivelyPaused = isPaused || autoPaused;
  const resumeDwellMs = settings.dwellMs * 2; // 2x Dwell time for safe resume (Midas touch prevention)

  return (
    <>
      {/* Top Bar Quick Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!isEffectivelyPaused ? (
          <GazeButton
            id="pause-eye-control-btn"
            onClick={pauseEyeControl}
            label="Pause Eye Control"
            icon="⏸️"
            tag="Key: P"
            variant="outline"
            size="compact"
            className="!min-h-[52px] !py-2 !px-4 text-sm font-extrabold border-amber-400/60 hover:bg-amber-400/20 text-amber-200"
            ariaLabel="Pause Eye Control (Shortcut: P)"
          />
        ) : (
          <GazeButton
            id="resume-eye-control-header-btn"
            onClick={resumeEyeControl}
            label="Resume Eye Control"
            icon="▶️"
            tag="Key: P"
            variant="accent"
            size="compact"
            priority={1000}
            dwellMs={resumeDwellMs}
            className="!min-h-[52px] !py-2 !px-4 text-sm font-extrabold shadow-[0_0_20px_#fbbf24]"
            ariaLabel="Resume Eye Control (Hold gaze 2x longer or press P)"
          />
        )}

        {onOpenSettings && (
          <GazeButton
            id="open-settings-btn"
            onClick={onOpenSettings}
            label="Settings"
            icon="⚙️"
            variant="secondary"
            size="compact"
            className="!min-h-[52px] !py-2 !px-4 text-sm font-bold border-slate-700 hover:border-slate-500 text-slate-300"
            ariaLabel="Open Gaze & Accessibility Settings"
          />
        )}

        {onOpenCalibration && (
          <GazeButton
            id="quick-calibrate-btn"
            onClick={onOpenCalibration}
            label={isCalibrated ? "Recalibrate" : "Calibrate"}
            icon="🎯"
            variant="secondary"
            size="compact"
            className="!min-h-[52px] !py-2 !px-4 text-sm font-bold border-slate-700 hover:border-amber-400/60 text-amber-300"
            ariaLabel="Calibrate Eye Gaze Tracker"
          />
        )}

        {onSetCenter && (
          <GazeButton
            id="quick-header-center-btn"
            onClick={onSetCenter}
            label="Set Center"
            icon="📍"
            variant="secondary"
            size="compact"
            className="!min-h-[52px] !py-2 !px-4 text-sm font-bold border-slate-700 hover:border-emerald-400/60 text-emerald-300 hidden xl:flex"
            ariaLabel="Quick calibrate neutral center gaze"
          />
        )}
      </div>

      {/* Fullscreen Pause Overlay Modal when Paused */}
      {isEffectivelyPaused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Eye Control Paused"
          className="fixed inset-0 z-[9990] bg-[#070b14]/85 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn"
        >
          <div className="bg-[#0d1527] border-4 border-amber-400 rounded-3xl p-8 sm:p-10 max-w-xl w-full shadow-2xl text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-4xl mb-4 text-amber-300">
              {autoPaused ? "👀" : "⏸️"}
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
              {autoPaused ? "Taking a Break?" : "Eye Control Paused"}
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-medium mb-6 max-w-md">
              {autoPaused
                ? "We paused eye control because your face was away. Look back at the camera to resume automatically, or gaze at Resume below."
                : "Gaze clicks are currently locked to prevent accidental selections. Look at the Resume button or press [P] on your keyboard."}
            </p>

            <div className="w-full space-y-4">
              <GazeButton
                id="resume-large-btn"
                onClick={resumeEyeControl}
                label="Resume Eye Control"
                subtitle={`Gaze for ${(resumeDwellMs / 1000).toFixed(1)}s (Safe Dwell) or Click / Press P`}
                icon="▶️"
                variant="accent"
                size="large"
                priority={1000}
                dwellMs={resumeDwellMs}
                className="w-full text-left"
                ariaLabel="Resume Eye Control (Hold gaze or press P)"
              />

              {onOpenSettings && (
                <GazeButton
                  id="paused-open-settings-btn"
                  onClick={onOpenSettings}
                  label="Adjust Settings & Dwell Time"
                  icon="⚙️"
                  variant="outline"
                  size="compact"
                  priority={950}
                  className="w-full"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Keyboard: Press [P]</span>
              <span>•</span>
              <span>Mouse: Click anywhere on Resume</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
