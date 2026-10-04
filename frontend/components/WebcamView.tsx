"use client";

import React, { useImperativeHandle, forwardRef } from "react";
import { useWebcam, WebcamStatus } from "@/hooks/useWebcam";

export interface WebcamViewProps {
  onReady?: (videoEl: HTMLVideoElement) => void;
  className?: string;
}

export interface WebcamViewHandle {
  start: () => Promise<void>;
  stop: () => void;
  status: WebcamStatus;
  getVideoElement: () => HTMLVideoElement | null;
}

export const WebcamView = forwardRef<WebcamViewHandle, WebcamViewProps>(
  function WebcamView({ onReady, className = "" }, ref) {
    const { status, videoRef, errorMessage, start, stop } = useWebcam({
      width: 640,
      height: 480,
      facingMode: "user",
      onReady,
    });

    useImperativeHandle(ref, () => ({
      start,
      stop,
      status,
      getVideoElement: () => videoRef.current,
    }));

    return (
      <div
        className={`flex flex-col h-full bg-[#0b1120] rounded-3xl border-4 border-slate-800 p-6 shadow-2xl ${className}`}
      >
        {/* Header / Camera Status Title */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label="Webcam Icon">
              👁️
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Gaze Camera
              </h2>
              <p className="text-sm font-semibold text-slate-400">
                Front-facing video for hands-free navigation
              </p>
            </div>
          </div>

          {/* Live indicator badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131f38] border border-slate-700">
            <span
              className={`w-3.5 h-3.5 rounded-full ${
                status === "active"
                  ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                  : status === "requesting"
                  ? "bg-amber-400 animate-pulse"
                  : status === "denied" || status === "error" || status === "no-device"
                  ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]"
                  : "bg-slate-500"
              }`}
            />
            <span className="text-sm font-bold capitalize text-slate-200">
              {status === "active"
                ? "Live (Mirrored)"
                : status === "requesting"
                ? "Starting..."
                : status === "denied"
                ? "Permission Denied"
                : status === "no-device"
                ? "No Camera"
                : status === "error"
                ? "Error"
                : "Camera Off"}
            </span>
          </div>
        </div>

        {/* Video / Placeholder Container */}
        <div className="relative flex-1 w-full min-h-[300px] sm:min-h-[360px] bg-[#070b14] rounded-2xl border-2 border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
          {/* Mirrored Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Live mirrored webcam feed for AI Tutor gaze tracking"
            className={`w-full h-full object-cover transition-opacity duration-300 [transform:scaleX(-1)] ${
              status === "active" ? "opacity-100 block" : "opacity-0 hidden"
            }`}
          />

          {/* Idle / Off State Overlay */}
          {status === "idle" && (
            <div className="p-8 text-center flex flex-col items-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-slate-800/80 border-2 border-slate-700 flex items-center justify-center text-4xl mb-4 text-amber-300">
                📷
              </div>
              <h3 className="text-2xl font-black text-white mb-2">
                Camera is Currently Off
              </h3>
              <p className="text-lg text-slate-300 font-medium">
                Press the large <strong className="text-amber-400">Start Camera</strong> button below to enable hands-free gaze navigation.
              </p>
            </div>
          )}

          {/* Requesting State Overlay */}
          {status === "requesting" && (
            <div className="p-8 text-center flex flex-col items-center max-w-md">
              <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-2xl font-black text-white mb-2">
                Requesting Camera Access...
              </h3>
              <p className="text-lg text-amber-300 font-medium">
                Please click <strong>&quot;Allow&quot;</strong> in your browser when prompted.
              </p>
            </div>
          )}

          {/* Denied / Error / No-Device Overlays */}
          {(status === "denied" || status === "error" || status === "no-device") && (
            <div className="p-8 text-center flex flex-col items-center max-w-lg">
              <div className="w-20 h-20 rounded-full bg-rose-950/80 border-2 border-rose-600 flex items-center justify-center text-4xl mb-4 text-rose-400">
                ⚠️
              </div>
              <h3 className="text-2xl font-black text-rose-300 mb-2">
                {status === "denied"
                  ? "Camera Access Blocked"
                  : status === "no-device"
                  ? "No Webcam Detected"
                  : "Camera Notice"}
              </h3>
              <p className="text-lg text-slate-200 font-medium bg-slate-900/90 border border-slate-700 rounded-xl p-4">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls (Large Accessible Buttons: min-h-[64px]) */}
        <div className="mt-5 flex flex-col gap-3">
          {status !== "active" ? (
            <button
              id="start-camera-btn"
              onClick={start}
              disabled={status === "requesting"}
              className="w-full min-h-[64px] py-4 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-2xl tracking-wide shadow-lg border-2 border-amber-300 hover:scale-[1.01] active:scale-[0.99] transition-all focus:outline-none focus:ring-8 focus:ring-amber-400 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-3xl">▶</span>
              <span>Start Camera</span>
            </button>
          ) : (
            <button
              id="stop-camera-btn"
              onClick={stop}
              className="w-full min-h-[64px] py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-2xl tracking-wide shadow-lg border-2 border-rose-400 hover:scale-[1.01] active:scale-[0.99] transition-all focus:outline-none focus:ring-8 focus:ring-rose-400 flex items-center justify-center gap-3 cursor-pointer"
            >
              <span className="text-3xl">⏹</span>
              <span>Stop Camera</span>
            </button>
          )}

          {/* Small Privacy Note */}
          <div className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-slate-400 bg-[#070b14] py-2 px-4 rounded-xl border border-slate-800">
            <span className="text-base" role="img" aria-label="Privacy Shield">
              🛡️
            </span>
            <span>
              Your camera video stays in this browser. It is not recorded or sent anywhere.
            </span>
          </div>
        </div>
      </div>
    );
  }
);
