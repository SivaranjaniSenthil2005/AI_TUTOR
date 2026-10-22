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

    const onMapperChangeRef = useRef(onMapperChange);
    onMapperChangeRef.current = onMapperChange;

    // Stored GazeMapper model (loaded on mount to prevent SSR hydration mismatch)
    const [mapper, setMapper] = useState<GazeMapper | null>(null);

    useEffect(() => {
      try {
        const stored = localStorage.getItem(MAPPER_STORAGE_KEY);
        if (stored) {
          const loaded = GazeMapper.deserialize(stored);
          setMapper(loaded);
          onMapperChangeRef.current?.(loaded);
        }
      } catch {}
    }, []);

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
      onMapperChangeRef.current?.(newMapper);
      try {
        localStorage.setItem(MAPPER_STORAGE_KEY, newMapper.serialize());
      } catch {}
      setViewportNotice(null);
    }, []);

    const handleClearCalibration = useCallback(() => {
      setMapper(null);
      onMapperChangeRef.current?.(null);
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

        <div
          className={`flex flex-col h-full bg-[var(--bg-surface)] rounded-[20px] border border-[var(--border-subtle)] p-4 sm:p-5 shadow-[var(--shadow-card)] min-h-0 overflow-hidden ${className}`}
          style={{ boxSizing: "border-box" }}
        >
          {/* Header: Friendly Eye Icon, Title, Calibration Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-tight">
                  Eye Control
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-tight">
                  Look at buttons to select
                </p>
              </div>
            </div>

            {/* Live Indicator & Calibration Badge */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {mapper && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    mapper.quality.grade === "good"
                      ? "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/30"
                      : "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30"
                  }`}
                >
                  {mapper.quality.grade === "good" ? "Calibrated" : "Basic setup"}
                </span>
              )}
            </div>
          </div>

          {/* 4:3 Video Preview Container (Shrinks first if viewport is short with min-h-0 and max-h) */}
          <div className="relative w-full aspect-[4/3] min-h-0 max-h-[220px] 2xl:max-h-[250px] flex-1 bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shadow-inner my-auto">
            {/* Mirrored Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Live mirrored webcam feed for AI Tutor gaze tracking"
              className={`w-full h-full object-cover [transform:scaleX(-1)] ${
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
              <div className="absolute top-2.5 left-2.5 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm select-none">
                <span className="text-xs text-[var(--primary)] font-bold">
                  {direction === "left" && "◀"}
                  {direction === "right" && "▶"}
                  {direction === "up" && "▲"}
                  {direction === "down" && "▼"}
                  {direction === "center" && "●"}
                  {direction === "unknown" && "·"}
                </span>
                <span className="text-[11px] font-semibold capitalize text-[var(--text-primary)]">
                  {direction}
                </span>
              </div>
            )}

            {/* Friendly Placeholder when camera is off */}
            {webcamStatus === "idle" && (
              <div className="p-4 text-center flex flex-col items-center max-w-[260px]">
                <div className="w-12 h-12 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center mb-2 shadow-xs">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Camera is off
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">
                  Turn it on to use your eyes to control AI Tutor
                </p>
              </div>
            )}

            {/* Requesting State Overlay */}
            {webcamStatus === "requesting" && (
              <div className="p-4 text-center flex flex-col items-center">
                <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Requesting camera access...
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Click &quot;Allow&quot; in your browser
                </p>
              </div>
            )}

            {/* Denied / Error / No-Device Overlays */}
            {(webcamStatus === "denied" || webcamStatus === "error" || webcamStatus === "no-device") && (
              <div className="p-4 text-center flex flex-col items-center max-w-[260px]">
                <div className="w-10 h-10 rounded-full bg-[var(--error-soft)] text-[var(--error)] flex items-center justify-center mb-2">
                  ⚠️
                </div>
                <p className="text-xs font-semibold text-[var(--error)]">
                  {webcamStatus === "denied" ? "Camera access blocked" : "Camera unavailable"}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  {webcamError || "Please check camera permissions in browser settings"}
                </p>
              </div>
            )}
          </div>

          {/* Viewport Deviation Notice Banner */}
          {viewportNotice && (
            <div className="my-2 p-2 bg-[var(--warning-soft)] border border-[var(--warning)]/30 rounded-xl text-[var(--warning)] text-xs font-medium flex items-center justify-between gap-2 flex-shrink-0">
              <span className="truncate">{viewportNotice}</span>
              <button
                type="button"
                onClick={() => setCalibrationOpen(true)}
                className="px-2 py-0.5 bg-[var(--warning)] text-white font-semibold rounded-md text-[11px] flex-shrink-0 hover:brightness-105"
              >
                Recalibrate
              </button>
            </div>
          )}

          {/* One-Line Status with Colored Dot and Plain Words */}
          <div className="h-9 w-full my-2.5 flex items-center justify-between px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-xs font-medium flex-shrink-0">
            {webcamStatus === "active" ? (
              landmarkStatus === "tracking" ? (
                <div className="flex items-center gap-2 text-[var(--success)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)] ring-2 ring-[var(--success-soft)]" />
                  <span>I can see you</span>
                </div>
              ) : landmarkStatus === "loading" ? (
                <div className="flex items-center gap-2 text-[var(--warning)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
                  <span>Loading eye tracker...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[var(--warning)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                  <span>Move closer to camera</span>
                </div>
              )
            ) : webcamStatus === "requesting" ? (
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
                <span>Starting camera...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Camera is off</span>
              </div>
            )}

            {!mapper && webcamStatus === "active" && (
              <button
                type="button"
                onClick={() => setCalibrationOpen(true)}
                className="px-2 py-0.5 bg-[var(--primary)] text-white text-[11px] font-semibold rounded-md hover:bg-[var(--primary-hover)] cursor-pointer calm-fade"
              >
                Setup Eyes
              </button>
            )}
          </div>

          {/* Pinned Start/Stop Camera Button inside Card (Always visible, never clipped) */}
          <div className="mt-auto pt-1 flex flex-col gap-2 flex-shrink-0">
            {webcamStatus !== "active" ? (
              <button
                id="start-camera-btn"
                type="button"
                onClick={start}
                disabled={webcamStatus === "requesting"}
                className="w-full h-[52px] min-h-[52px] rounded-[20px] bg-brand-gradient hover:brightness-105 active:brightness-95 text-white font-semibold text-base shadow-[0_4px_16px_rgba(79,70,229,0.25)] border-0 calm-fade focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Start Camera</span>
              </button>
            ) : (
              <button
                id="stop-camera-btn"
                type="button"
                onClick={stop}
                className="w-full h-[52px] min-h-[52px] rounded-[20px] bg-[var(--error-soft)] hover:bg-[var(--error-soft)]/80 text-[var(--error)] font-semibold text-base shadow-xs border border-[var(--error)]/30 calm-fade focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Stop Camera</span>
              </button>
            )}

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface-2)] py-1.5 px-3 rounded-xl border border-[var(--border-subtle)]">
              <span>🛡️</span>
              <span className="truncate">
                Video stays in this browser. Never recorded or sent anywhere.
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }
);
