"use client";

import { useState, useRef, useEffect } from "react";
import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

export type LandmarkStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no-face"
  | "tracking"
  | "error";

export interface FaceLandmarkData {
  landmarks: NormalizedLandmark[];
  facialTransformationMatrix?: number[];
  timestampMs: number;
}

export interface UseFaceLandmarksOptions {
  videoElement: HTMLVideoElement | null;
  enabled?: boolean;
  onResults?: (result: FaceLandmarkerResult, videoTimeMs: number) => void;
}

export interface UseFaceLandmarksReturn {
  status: LandmarkStatus;
  fps: number;
  isFaceDetected: boolean;
  lowFpsWarning: boolean;
  errorMessage: string | null;
  latestResultRef: React.RefObject<FaceLandmarkerResult | null>;
  latestDataRef: React.RefObject<FaceLandmarkData | null>;
}

export function useFaceLandmarks({
  videoElement,
  enabled = true,
  onResults,
}: UseFaceLandmarksOptions): UseFaceLandmarksReturn {
  const [status, setStatus] = useState<LandmarkStatus>("idle");
  const [fps, setFps] = useState<number>(0);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [lowFpsWarning, setLowFpsWarning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const latestResultRef = useRef<FaceLandmarkerResult | null>(null);
  const latestDataRef = useRef<FaceLandmarkData | null>(null);

  // FPS calculation refs
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(0);
  const lowFpsCounterRef = useRef<number>(0);

  // Callback ref to prevent unnecessary effect rebuilds
  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  // 1. Initialize FaceLandmarker with GPU and automatic CPU fallback
  useEffect(() => {
    let isMounted = true;

    async function initLandmarker() {
      if (!enabled) return;

      setStatus("loading");
      setErrorMessage(null);

      try {
        const { FilesetResolver, FaceLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );

        // Self-hosted WASM files
        const vision = await FilesetResolver.forVisionTasks(
          "/mediapipe/wasm"
        );

        if (!isMounted) return;

        let landmarker: FaceLandmarker;
        try {
          // Attempt GPU delegate first
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/models/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          });
        } catch (gpuError) {
          console.warn(
            "AI Tutor: GPU delegate failed for FaceLandmarker, falling back to CPU.",
            gpuError
          );
          // Fallback to CPU delegate
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "/models/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          });
        }

        if (!isMounted) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setStatus("ready");
      } catch (err: unknown) {
        console.error("AI Tutor: Failed to load FaceLandmarker:", err);
        if (isMounted) {
          setStatus("error");
          setErrorMessage(
            "Could not load eye tracking model. Please ensure models are installed and refresh."
          );
        }
      }
    }

    initLandmarker();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Ignore close errors during teardown
        }
        landmarkerRef.current = null;
      }
    };
  }, [enabled]);

  // 2. Detection Loop managed in active effect
  useEffect(() => {
    if (!enabled || !videoElement || status === "error" || status === "idle" || status === "loading") {
      return;
    }

    let animationFrameId: number | null = null;
    let lastVideoTime = -1;
    let isActive = true;

    function detectLoop() {
      if (!isActive) return;

      const landmarker = landmarkerRef.current;
      if (!videoElement || !landmarker) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      // Edge case: Tab hidden -> pause detection until document is visible
      if (typeof document !== "undefined" && document.hidden) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      // Edge case: Video not ready or paused
      if (
        videoElement.paused ||
        videoElement.ended ||
        videoElement.readyState < 2
      ) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      const currentVideoTime = videoElement.currentTime;

      // Only run detection when a new video frame is available
      if (
        currentVideoTime !== lastVideoTime &&
        videoElement.videoWidth > 0 &&
        videoElement.videoHeight > 0
      ) {
        lastVideoTime = currentVideoTime;
        const startTimeMs = performance.now();

        try {
          const results = landmarker.detectForVideo(
            videoElement,
            startTimeMs
          );

          latestResultRef.current = results;

          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const primaryFace = results.faceLandmarks[0];
            const matrix =
              results.facialTransformationMatrixes &&
              results.facialTransformationMatrixes.length > 0
                ? results.facialTransformationMatrixes[0].data
                : undefined;

            latestDataRef.current = {
              landmarks: primaryFace,
              facialTransformationMatrix: matrix ? Array.from(matrix) : undefined,
              timestampMs: startTimeMs,
            };

            setIsFaceDetected(true);
            setStatus("tracking");
          } else {
            latestDataRef.current = null;
            setIsFaceDetected(false);
            setStatus("no-face");
          }

          if (onResultsRef.current) {
            onResultsRef.current(results, startTimeMs);
          }

          // FPS Calculation
          frameCountRef.current += 1;
          const now = performance.now();
          if (lastFpsCalcTimeRef.current === 0) {
            lastFpsCalcTimeRef.current = now;
          }

          const delta = now - lastFpsCalcTimeRef.current;
          if (delta >= 1000) {
            const currentFps = Math.round(
              (frameCountRef.current * 1000) / delta
            );
            setFps(currentFps);
            frameCountRef.current = 0;
            lastFpsCalcTimeRef.current = now;

            // Low FPS threshold (< 15 FPS for 3+ seconds)
            if (currentFps < 15 && currentFps > 0) {
              lowFpsCounterRef.current += 1;
              if (lowFpsCounterRef.current >= 3) {
                setLowFpsWarning(true);
              }
            } else {
              lowFpsCounterRef.current = 0;
              setLowFpsWarning(false);
            }
          }
        } catch (detectError) {
          console.warn("AI Tutor: Error during frame detection:", detectError);
        }
      }

      animationFrameId = requestAnimationFrame(detectLoop);
    }

    animationFrameId = requestAnimationFrame(detectLoop);

    return () => {
      isActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      latestResultRef.current = null;
      latestDataRef.current = null;
    };
  }, [enabled, status, videoElement]);

  return {
    status,
    fps,
    isFaceDetected,
    lowFpsWarning,
    errorMessage,
    latestResultRef,
    latestDataRef,
  };
}
