"use client";

import React, {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
} from "react";
import type { NormalizedLandmark, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useWebcam, WebcamStatus } from "@/hooks/useWebcam";
import { useFaceLandmarks, LandmarkStatus } from "@/hooks/useFaceLandmarks";
import { useGaze, GazeFrameState } from "@/hooks/useGaze";
import { useGazePoint, GazePoint } from "@/hooks/useGazePoint";
import type { GazeDirection } from "@/lib/gaze/direction";
import { GazeMapper } from "@/lib/calibration/mapper";
import { LandmarkOverlay } from "./LandmarkOverlay";
import { GazeDebugPanel } from "./GazeDebugPanel";
import { CalibrationScreen } from "./CalibrationScreen";
import { GazeDot } from "./GazeDot";

export interface WebcamViewProps {
  onReady?: (videoEl: HTMLVideoElement) => void;
  onLandmarksUpdate?: (landmarks: NormalizedLandmark[] | null) => void;
  onGazeUpdate?: (gazeState: GazeFrameState) => void;
  onGazePointUpdate?: (point: GazePoint) => void;
  onMapperChange?: (mapper: GazeMapper | null) => void;
  onCameraActiveChange?: (active: boolean) => void;
  isCalibrationOpen?: boolean;
  onCalibrationOpenChange?: (open: boolean) => void;
  isPaused?: boolean;
  sharedGazePointRef?: React.RefObject<GazePoint>;
  className?: string;
}

export interface WebcamViewHandle {
  start: () => Promise<void>;
  stop: () => void;
  webcamStatus: WebcamStatus;
  landmarkStatus: LandmarkStatus;
  direction: GazeDirection;
  getVideoElement: () => HTMLVideoElement | null;
  getLatestResult: () => FaceLandmarkerResult | null;
  getLatestGaze: () => GazeFrameState;
  getLatestGazePoint: () => GazePoint;
  openCalibration: () => void;
  startSetCenter: () => void;
}

const MAPPER_STORAGE_KEY = "ai_tutor_gaze_mapper";

export const WebcamView = forwardRef<WebcamViewHandle, WebcamViewProps>(
  function WebcamView(
    {
      onReady,
      onLandmarksUpdate,
      onGazeUpdate,
      onGazePointUpdate,
      onMapperChange,
      onCameraActiveChange,
      isCalibrationOpen: controlledIsCalibrationOpen,
      onCalibrationOpenChange,
      isPaused = false,
      sharedGazePointRef,
      className = "",
    },
    ref
  ) {
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
    const [currentLandmarks, setCurrentLandmarks] = useState<NormalizedLandmark[] | null>(null);
    const [showOverlay, setShowOverlay] = useState<boolean>(true);
    const [showDebug, setShowDebug] = useState<boolean>(false);
    const [showGazeDot, setShowGazeDot] = useState<boolean>(true);
    const [internalIsCalibrationOpen, setInternalIsCalibrationOpen] = useState<boolean>(false);
    const [viewportNotice, setViewportNotice] = useState<string | null>(null);

    const isCalibrationOpen =
      controlledIsCalibrationOpen !== undefined
        ? controlledIsCalibrationOpen
        : internalIsCalibrationOpen;

    const setCalibrationOpen = useCallback(
      (open: boolean) => {
        if (onCalibrationOpenChange) {
          onCalibrationOpenChange(open);
        } else {
          setInternalIsCalibrationOpen(open);
        }
      },
      [onCalibrationOpenChange]
    );

    // Stored GazeMapper model
    const [mapper, setMapper] = useState<GazeMapper | null>(() => {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(MAPPER_STORAGE_KEY);
          if (stored) {
            return GazeMapper.deserialize(stored);
          }
        } catch {}
      }
      return null;
    });

    const onLandmarksUpdateRef = useRef(onLandmarksUpdate);
    onLandmarksUpdateRef.current = onLandmarksUpdate;

    const onGazeUpdateRef = useRef(onGazeUpdate);
    onGazeUpdateRef.current = onGazeUpdate;

    const onGazePointUpdateRef = useRef(onGazePointUpdate);
    onGazePointUpdateRef.current = onGazePointUpdate;

    // Gaze estimation hook
    const {
      gazeRef,
      direction,
      confidence,
      isBlinking,
      faceVisible,
      baseline,
      isCalibratingCenter,
      calibrationProgress,
      calibrationMessage,
      minCutoff,
      beta,
      thresholdX,
      thresholdY,
      setMinCutoff,
      setBeta,
      setThresholdX,
      setThresholdY,
      history,
      processFrame,
      startSetCenter,
      resetBaseline,
    } = useGaze({
      onGazeFrame: (frame) => {
        if (onGazeUpdateRef.current) {
          onGazeUpdateRef.current(frame);
        }
      },
    });

    // Screen gaze point projection hook
    const { gazePointRef, gazePoint, processGazeFrame } = useGazePoint({
      gazeRef,
      mapper,
    });

    // Monitor window resize and check for viewport deviation
    useEffect(() => {
      function checkViewport() {
        if (mapper && typeof window !== "undefined") {
          const isDeviated = mapper.isViewportDeviated(window.innerWidth, window.innerHeight, 0.15);
          if (isDeviated) {
            setViewportNotice("Screen size changed since calibration. Recalibrating is recommended.");
          } else {
            setViewportNotice(null);
          }
        }
      }

      window.addEventListener("resize", checkViewport);
      checkViewport();
      return () => window.removeEventListener("resize", checkViewport);
    }, [mapper]);

    const handleVideoReady = useCallback(
      (videoEl: HTMLVideoElement) => {
        setVideoElement(videoEl);
        if (onReady) {
          onReady(videoEl);
        }
      },
      [onReady]
    );

    const {
      status: webcamStatus,
      videoRef,
      errorMessage: webcamError,
      start,
      stop: stopWebcam,
    } = useWebcam({
      width: 640,
      height: 480,
      facingMode: "user",
      onReady: handleVideoReady,
    });

    useEffect(() => {
      onMapperChange?.(mapper);
    }, [mapper, onMapperChange]);

    useEffect(() => {
      onCameraActiveChange?.(webcamStatus === "active");
    }, [webcamStatus, onCameraActiveChange]);

    const handleLandmarkResults = useCallback(
      (result: FaceLandmarkerResult, timestampMs: number) => {
        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
          const primaryFace = result.faceLandmarks[0];
          const matrix =
            result.facialTransformationMatrixes &&
            result.facialTransformationMatrixes.length > 0
              ? result.facialTransformationMatrixes[0].data
              : undefined;

          setCurrentLandmarks(primaryFace);
          const gazeFrame = processFrame(primaryFace, matrix, timestampMs);
          const screenPoint = processGazeFrame(gazeFrame);

          if (sharedGazePointRef) {
            (sharedGazePointRef as React.MutableRefObject<GazePoint>).current = screenPoint;
          }

          if (onLandmarksUpdateRef.current) {
            onLandmarksUpdateRef.current(primaryFace);
          }
          if (onGazePointUpdateRef.current) {
            onGazePointUpdateRef.current(screenPoint);
          }
        } else {
          setCurrentLandmarks(null);
          const gazeFrame = processFrame(null, undefined, timestampMs);
          const screenPoint = processGazeFrame(gazeFrame);

          if (sharedGazePointRef) {
            (sharedGazePointRef as React.MutableRefObject<GazePoint>).current = screenPoint;
          }

          if (onLandmarksUpdateRef.current) {
            onLandmarksUpdateRef.current(null);
          }
          if (onGazePointUpdateRef.current) {
            onGazePointUpdateRef.current(screenPoint);
          }
        }
      },
      [processFrame, processGazeFrame, sharedGazePointRef]
    );

    const {
      status: landmarkStatus,
      fps,
      isFaceDetected,
      lowFpsWarning,
      errorMessage: landmarkError,
      latestResultRef,
    } = useFaceLandmarks({
      videoElement: webcamStatus === "active" ? videoElement : null,
      enabled: webcamStatus === "active",
      onResults: handleLandmarkResults,
    });

    const stop = useCallback(() => {
      stopWebcam();
      setVideoElement(null);
      setCurrentLandmarks(null);
    }, [stopWebcam]);

    const handleCalibrationComplete = useCallback((newMapper: GazeMapper) => {
      setMapper(newMapper);
      try {
        localStorage.setItem(MAPPER_STORAGE_KEY, newMapper.serialize());
      } catch {}
      setViewportNotice(null);
    }, []);

    const handleClearCalibration = useCallback(() => {
      setMapper(null);
      try {
        localStorage.removeItem(MAPPER_STORAGE_KEY);
      } catch {}
      setViewportNotice(null);
    }, []);

    useImperativeHandle(ref, () => ({
      start,
      stop,
      webcamStatus,
      landmarkStatus,
      direction,
      getVideoElement: () => videoRef.current,
      getLatestResult: () => latestResultRef.current,
      getLatestGaze: () => gazeRef.current,
      getLatestGazePoint: () => gazePointRef.current,
      openCalibration: () => setCalibrationOpen(true),
      startSetCenter,
    }));

    return (
      <>
        {/* Real-time Hardware Accelerated Gaze Dot Overlay */}
        <GazeDot
          gazePointRef={sharedGazePointRef || gazePointRef}
          visible={showGazeDot && !!mapper && webcamStatus === "active"}
          isPaused={isPaused}
        />

        {/* Fullscreen Calibration Screen Modal */}
        <CalibrationScreen
          isOpen={isCalibrationOpen}
          onClose={() => setCalibrationOpen(false)}
          onComplete={handleCalibrationComplete}
          gazeRef={gazeRef}
          isCameraActive={webcamStatus === "active"}
          onStartCamera={start}
        />

        <div
          className={`flex flex-col h-full bg-[#0b1120] rounded-3xl border-4 border-slate-800 p-6 shadow-2xl ${className}`}
        >
          {/* Header / Camera & Calibration Status */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Webcam Icon">
                👁️
              </span>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Gaze Camera
                </h2>
                <p className="text-sm font-semibold text-slate-400">
                  Front-facing video & screen coordinate tracker
                </p>
              </div>
            </div>

            {/* Live Indicator & Calibration Badge */}
            <div className="flex items-center gap-2">
              {mapper && (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    mapper.quality.grade === "good"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-500/60"
                      : mapper.quality.grade === "okay"
                      ? "bg-amber-950 text-amber-300 border-amber-500/60"
                      : "bg-rose-950 text-rose-300 border-rose-500/60"
                  }`}
                >
                  {mapper.quality.grade} Calibration
                </span>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#131f38] border border-slate-700">
                <span
                  className={`w-3.5 h-3.5 rounded-full ${
                    webcamStatus === "active"
                      ? isFaceDetected
                        ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                        : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                      : webcamStatus === "requesting"
                      ? "bg-amber-400 animate-pulse"
                      : webcamStatus === "denied" || webcamStatus === "error" || webcamStatus === "no-device"
                      ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]"
                      : "bg-slate-500"
                  }`}
                />
                <span className="text-xs sm:text-sm font-bold capitalize text-slate-200">
                  {webcamStatus === "active"
                    ? isFaceDetected
                      ? `Gaze: ${direction.toUpperCase()}`
                      : "Searching Face"
                    : webcamStatus === "requesting"
                    ? "Starting..."
                    : webcamStatus === "denied"
                    ? "Permission Denied"
                    : webcamStatus === "no-device"
                    ? "No Camera"
                    : webcamStatus === "error"
                    ? "Camera Error"
                    : "Camera Off"}
                </span>
              </div>
            </div>
          </div>

          {/* Video & Landmark Canvas Container */}
          <div className="relative flex-1 w-full min-h-[300px] sm:min-h-[360px] bg-[#070b14] rounded-2xl border-2 border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
            {/* Mirrored Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Live mirrored webcam feed for AI Tutor gaze tracking"
              className={`w-full h-full object-cover transition-opacity duration-300 [transform:scaleX(-1)] ${
                webcamStatus === "active" ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            />

            {/* Real-time Landmark Overlay Canvas */}
            {webcamStatus === "active" && (
              <LandmarkOverlay
                landmarks={currentLandmarks}
                videoElement={videoElement}
                visible={showOverlay}
              />
            )}

            {/* Live Gaze Direction Bubble Indicator Over Video */}
            {webcamStatus === "active" && isFaceDetected && (
              <div className="absolute top-3 left-3 bg-[#0d1527]/90 backdrop-blur-md border-2 border-amber-400/80 px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg select-none">
                <span className="text-base">
                  {direction === "left" && "◀"}
                  {direction === "right" && "▶"}
                  {direction === "up" && "▲"}
                  {direction === "down" && "▼"}
                  {direction === "center" && "●"}
                  {direction === "unknown" && "❓"}
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  {direction}
                </span>
              </div>
            )}

            {/* Idle State Overlay */}
            {webcamStatus === "idle" && (
              <div className="p-8 text-center flex flex-col items-center max-w-md">
                <div className="w-20 h-20 rounded-full bg-slate-800/80 border-2 border-slate-700 flex items-center justify-center text-4xl mb-4 text-amber-300">
                  📷
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  Camera is Currently Off
                </h3>
                <p className="text-lg text-slate-300 font-medium">
                  Press <strong className="text-amber-400">Start Camera</strong> below to enable hands-free gaze navigation.
                </p>
              </div>
            )}

            {/* Requesting State Overlay */}
            {webcamStatus === "requesting" && (
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
            {(webcamStatus === "denied" || webcamStatus === "error" || webcamStatus === "no-device") && (
              <div className="p-8 text-center flex flex-col items-center max-w-lg">
                <div className="w-20 h-20 rounded-full bg-rose-950/80 border-2 border-rose-600 flex items-center justify-center text-4xl mb-4 text-rose-400">
                  ⚠️
                </div>
                <h3 className="text-2xl font-black text-rose-300 mb-2">
                  {webcamStatus === "denied"
                    ? "Camera Access Blocked"
                    : webcamStatus === "no-device"
                    ? "No Webcam Detected"
                    : "Camera Notice"}
                </h3>
                <p className="text-lg text-slate-200 font-medium bg-slate-900/90 border border-slate-700 rounded-xl p-4">
                  {webcamError}
                </p>
              </div>
            )}
          </div>

          {/* Viewport Deviation Notice Banner */}
          {viewportNotice && (
            <div className="mt-3 p-3 bg-amber-950/90 border-2 border-amber-400 rounded-xl text-amber-200 text-sm font-semibold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{viewportNotice}</span>
              </div>
              <button
                onClick={() => setCalibrationOpen(true)}
                className="px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-xs cursor-pointer hover:bg-amber-300"
              >
                Recalibrate
              </button>
            </div>
          )}

          {/* Large Friendly Status Banner for Young Learners */}
          {webcamStatus === "active" && (
            <div className="mt-3">
              {landmarkStatus === "loading" && (
                <div className="p-3 bg-amber-950/80 border-2 border-amber-500/60 rounded-xl text-amber-200 font-bold text-lg flex items-center gap-3">
                  <span className="text-2xl animate-spin">⏳</span>
                  <span>Loading eye tracker...</span>
                </div>
              )}
              {landmarkStatus === "tracking" && (
                <div className="p-3 bg-emerald-950/80 border-2 border-emerald-500/60 rounded-xl text-emerald-200 font-black text-lg sm:text-xl flex flex-wrap items-center justify-between gap-3 shadow-[0_0_15px_rgba(52,211,153,0.15)]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✨</span>
                    <span>I can see you!</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCalibrationOpen(true)}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl border border-amber-300 shadow cursor-pointer transition-all hover:scale-105 active:scale-95"
                    >
                      🎯 {mapper ? "Recalibrate" : "Calibrate Eyes"}
                    </button>
                    <button
                      onClick={startSetCenter}
                      disabled={isCalibratingCenter}
                      className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 text-xs font-bold rounded-xl border border-emerald-400 cursor-pointer"
                      title="Calibrate neutral center gaze"
                    >
                      Set Center
                    </button>
                  </div>
                </div>
              )}
              {(landmarkStatus === "no-face" || landmarkStatus === "ready") && (
                <div className="p-3 bg-slate-900 border-2 border-amber-400/50 rounded-xl text-amber-300 font-bold text-lg flex items-center gap-3">
                  <span className="text-2xl">👀</span>
                  <span>I can&apos;t see your face. Please sit in front of the camera with good light.</span>
                </div>
              )}
              {landmarkStatus === "error" && (
                <div className="p-3 bg-rose-950/80 border-2 border-rose-600 rounded-xl text-rose-200 font-bold text-base flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{landmarkError || "Error in landmark tracking."}</span>
                </div>
              )}
            </div>
          )}

          {/* Gentle Low-FPS Performance Notice */}
          {lowFpsWarning && webcamStatus === "active" && (
            <div className="mt-2 p-3 bg-indigo-950/90 border-2 border-indigo-400/60 rounded-xl text-indigo-200 text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">💡</span>
              <span>
                Eye tracker is running slowly ({fps} FPS). Closing extra browser tabs or apps will make it smoother!
              </span>
            </div>
          )}

          {/* Eye Tracking Controls & Debug Toggles */}
          {webcamStatus === "active" && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 bg-[#070b14] rounded-xl border border-slate-800 text-sm">
              <label className="flex items-center gap-2 font-bold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="w-5 h-5 accent-amber-400 rounded cursor-pointer"
                />
                <span>Show eye tracking</span>
              </label>

              <label className="flex items-center gap-2 font-semibold text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
                <span>Debug / Calibration</span>
              </label>
            </div>
          )}

          {/* Comprehensive Debug & Calibration Panel (Hidden behind Debug toggle) */}
          {showDebug && webcamStatus === "active" && (
            <GazeDebugPanel
              fps={fps}
              direction={direction}
              confidence={confidence}
              isBlinking={isBlinking}
              faceVisible={faceVisible}
              baseline={baseline}
              latestGaze={gazeRef.current}
              gazePoint={gazePoint}
              mapper={mapper}
              history={history}
              minCutoff={minCutoff}
              beta={beta}
              thresholdX={thresholdX}
              thresholdY={thresholdY}
              showGazeDot={showGazeDot}
              onToggleGazeDot={setShowGazeDot}
              onMinCutoffChange={setMinCutoff}
              onBetaChange={setBeta}
              onThresholdXChange={setThresholdX}
              onThresholdYChange={setThresholdY}
              onSetCenter={startSetCenter}
              onResetBaseline={resetBaseline}
              onOpenCalibration={() => setCalibrationOpen(true)}
              onClearCalibration={handleClearCalibration}
              isCalibratingCenter={isCalibratingCenter}
              calibrationProgress={calibrationProgress}
              calibrationMessage={calibrationMessage}
            />
          )}

          {/* Primary Action Button (min 64px height) */}
          <div className="mt-4 flex flex-col gap-3">
            {webcamStatus !== "active" ? (
              <button
                id="start-camera-btn"
                onClick={start}
                disabled={webcamStatus === "requesting"}
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

            {/* Privacy Note */}
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
      </>
    );
  }
);
