"use client";

import { useState, useRef, useCallback } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { extractEyeFeatures, EyeGazeFeatures } from "@/lib/gaze/eyeFeatures";
import { extractHeadPose, HeadPose } from "@/lib/gaze/headPose";
import { BlinkDetector, computeEyeAspectRatios } from "@/lib/gaze/blink";
import { GazeFeatureSmoother, type GazeFeaturesVector } from "@/lib/gaze/smoothing";
import { DirectionClassifier, GazeDirection, GazeBaseline, DEFAULT_BASELINE } from "@/lib/gaze/direction";

export type { GazeFeaturesVector };

export interface GazeFrameState {
  features: GazeFeaturesVector;
  rawFeatures: GazeFeaturesVector;
  eyeFeatures: EyeGazeFeatures | null;
  headPose: HeadPose;
  direction: GazeDirection;
  confidence: number; // 0.0 to 1.0
  isBlinking: boolean;
  ear: number;
  faceVisible: boolean;
  timestamp: number;
}

export interface GazeHistoryPoint {
  timeMs: number;
  rawIrisX: number;
  smoothedIrisX: number;
  direction: GazeDirection;
}

export interface UseGazeOptions {
  initialMinCutoff?: number;
  initialBeta?: number;
  initialThresholdX?: number;
  initialThresholdY?: number;
  onGazeFrame?: (frame: GazeFrameState) => void;
}

export interface UseGazeReturn {
  gazeRef: React.RefObject<GazeFrameState>;
  // Throttled React state for UI
  direction: GazeDirection;
  confidence: number;
  isBlinking: boolean;
  faceVisible: boolean;
  baseline: GazeBaseline;
  isCalibratingCenter: boolean;
  calibrationProgress: number; // 0 to 100
  calibrationMessage: string;

  // Configuration and tuning parameters
  minCutoff: number;
  beta: number;
  thresholdX: number;
  thresholdY: number;
  setMinCutoff: (val: number) => void;
  setBeta: (val: number) => void;
  setThresholdX: (val: number) => void;
  setThresholdY: (val: number) => void;

  // History points for live visual tuning chart (last ~5 seconds)
  history: GazeHistoryPoint[];

  // Actions
  processFrame: (landmarks: NormalizedLandmark[] | null, matrix?: number[] | Float32Array, timestampMs?: number) => GazeFrameState;
  startSetCenter: () => void;
  resetBaseline: () => void;
}

const BASELINE_STORAGE_KEY = "ai_tutor_gaze_baseline";

export function useGaze(options: UseGazeOptions = {}): UseGazeReturn {
  const {
    initialMinCutoff = 1.0,
    initialBeta = 0.007,
    initialThresholdX = 0.045,
    initialThresholdY = 0.055,
    onGazeFrame,
  } = options;

  const [minCutoff, setMinCutoffState] = useState<number>(initialMinCutoff);
  const [beta, setBetaState] = useState<number>(initialBeta);
  const [thresholdX, setThresholdXState] = useState<number>(initialThresholdX);
  const [thresholdY, setThresholdYState] = useState<number>(initialThresholdY);

  // Throttled UI states
  const [direction, setDirection] = useState<GazeDirection>("unknown");
  const [confidence, setConfidence] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [faceVisible, setFaceVisible] = useState<boolean>(false);
  const [baseline, setBaseline] = useState<GazeBaseline>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(BASELINE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as GazeBaseline;
          if (parsed && typeof parsed.irisX === "number") {
            return parsed;
          }
        }
      } catch {
        // Ignore localStorage access errors
      }
    }
    return DEFAULT_BASELINE;
  });
  const [isCalibratingCenter, setIsCalibratingCenter] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [calibrationMessage, setCalibrationMessage] = useState<string>("");
  const [history, setHistory] = useState<GazeHistoryPoint[]>([]);

  // Persistent instances
  const smootherRef = useRef<GazeFeatureSmoother>(new GazeFeatureSmoother({ minCutoff: initialMinCutoff, beta: initialBeta }));
  const classifierRef = useRef<DirectionClassifier>(new DirectionClassifier({ thresholdX: initialThresholdX, thresholdY: initialThresholdY }));
  const blinkDetectorRef = useRef<BlinkDetector>(new BlinkDetector({ earThreshold: 0.18, minBlinkFrames: 2 }));

  // Baseline calibration samples accumulator
  const calibrationSamplesRef = useRef<GazeFeaturesVector[]>([]);
  const calibrationStartTimeRef = useRef<number | null>(null);

  // Last good gaze features for blink holding
  const lastGoodFeaturesRef = useRef<GazeFeaturesVector>({
    irisX: 0.5,
    irisY: 0.5,
    yaw: 0,
    pitch: 0,
    roll: 0,
  });

  // History ring buffer for debug line chart
  const historyRef = useRef<GazeHistoryPoint[]>([]);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const lastFaceSeenTimeRef = useRef<number>(0);

  // Synchronous ref for high-frequency consumption (Phase 5 calibration)
  const gazeRef = useRef<GazeFrameState>({
    features: { irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 },
    rawFeatures: { irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 },
    eyeFeatures: null,
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    direction: "unknown",
    confidence: 0,
    isBlinking: false,
    ear: 0,
    faceVisible: false,
    timestamp: 0,
  });

  // Update smoother config when parameters change
  const setMinCutoff = useCallback((val: number) => {
    setMinCutoffState(val);
    smootherRef.current.updateConfig({ minCutoff: val });
  }, []);

  const setBeta = useCallback((val: number) => {
    setBetaState(val);
    smootherRef.current.updateConfig({ beta: val });
  }, []);

  const setThresholdX = useCallback((val: number) => {
    setThresholdXState(val);
    classifierRef.current.updateConfig({ thresholdX: val });
  }, []);

  const setThresholdY = useCallback((val: number) => {
    setThresholdYState(val);
    classifierRef.current.updateConfig({ thresholdY: val });
  }, []);

  const startSetCenter = useCallback(() => {
    setIsCalibratingCenter(true);
    setCalibrationProgress(0);
    setCalibrationMessage("Look at the middle of the screen. Hold still...");
    calibrationSamplesRef.current = [];
    calibrationStartTimeRef.current = performance.now();
  }, []);

  const resetBaseline = useCallback(() => {
    setBaseline(DEFAULT_BASELINE);
    try {
      localStorage.removeItem(BASELINE_STORAGE_KEY);
    } catch {}
  }, []);

  /**
   * Process a single video frame of landmarks.
   */
  const processFrame = useCallback(
    (
      landmarks: NormalizedLandmark[] | null,
      matrix?: number[] | Float32Array,
      timestampMs: number = performance.now()
    ): GazeFrameState => {
      const hasLandmarks = !!landmarks && landmarks.length >= 478;

      if (!hasLandmarks) {
        // Handle no face: if face missing > 500ms, mark unknown
        const timeSinceFace = timestampMs - lastFaceSeenTimeRef.current;
        const currentDir = timeSinceFace > 500 ? "unknown" : gazeRef.current.direction;

        const frameState: GazeFrameState = {
          features: lastGoodFeaturesRef.current,
          rawFeatures: lastGoodFeaturesRef.current,
          eyeFeatures: null,
          headPose: { pitch: 0, yaw: 0, roll: 0 },
          direction: currentDir,
          confidence: 0,
          isBlinking: false,
          ear: 0,
          faceVisible: false,
          timestamp: timestampMs,
        };

        gazeRef.current = frameState;
        return frameState;
      }

      lastFaceSeenTimeRef.current = timestampMs;

      // 1. Extract raw eye features and head pose
      const eyeFeat = extractEyeFeatures(landmarks);
      const pose = extractHeadPose(matrix);
      const blink = blinkDetectorRef.current.update(landmarks);
      const { averageEAR } = computeEyeAspectRatios(landmarks);

      const rawVector: GazeFeaturesVector = {
        irisX: eyeFeat ? eyeFeat.combined.irisX : lastGoodFeaturesRef.current.irisX,
        irisY: eyeFeat ? eyeFeat.combined.irisY : lastGoodFeaturesRef.current.irisY,
        yaw: pose.yaw,
        pitch: pose.pitch,
        roll: pose.roll,
      };

      // 2. Smooth features (hold last good value during blink)
      let smoothedVector: GazeFeaturesVector;
      if (blink.isBlinking) {
        smoothedVector = lastGoodFeaturesRef.current;
      } else {
        smoothedVector = smootherRef.current.smooth(rawVector, timestampMs);
        lastGoodFeaturesRef.current = smoothedVector;
      }

      // 3. Calculate confidence score (0..1)
      let conf = 1.0;
      // Drop confidence if head is turned too far (|yaw| > 35° or |pitch| > 25°)
      if (Math.abs(pose.yaw) > 35) conf *= Math.max(0.2, 1 - (Math.abs(pose.yaw) - 35) / 25);
      if (Math.abs(pose.pitch) > 25) conf *= Math.max(0.2, 1 - (Math.abs(pose.pitch) - 25) / 20);
      // Drop confidence during low EAR / partial closure
      if (averageEAR < 0.22) conf *= Math.max(0.1, averageEAR / 0.22);
      // Ensure bounds
      conf = Math.max(0, Math.min(1.0, conf));

      // 4. Center calibration accumulator
      if (calibrationStartTimeRef.current !== null) {
        const elapsed = timestampMs - calibrationStartTimeRef.current;
        const totalDurationMs = 2000; // 2 seconds

        if (elapsed < totalDurationMs) {
          if (!blink.isBlinking && conf > 0.6) {
            calibrationSamplesRef.current.push(rawVector);
          }
          const pct = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
          setCalibrationProgress(pct);
        } else {
          // Finalize baseline calculation
          const samples = calibrationSamplesRef.current;
          if (samples.length >= 10) {
            let sumX = 0, sumY = 0, sumYaw = 0, sumPitch = 0;
            for (const s of samples) {
              sumX += s.irisX;
              sumY += s.irisY;
              sumYaw += s.yaw;
              sumPitch += s.pitch;
            }
            const count = samples.length;
            const newBaseline: GazeBaseline = {
              irisX: sumX / count,
              irisY: sumY / count,
              yaw: sumYaw / count,
              pitch: sumPitch / count,
              sampleCount: count,
              timestamp: Date.now(),
            };
            setBaseline(newBaseline);
            try {
              localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(newBaseline));
            } catch {}
            setCalibrationMessage("Center calibrated successfully! ✨");
          } else {
            setCalibrationMessage("Could not capture enough clear frames. Please try again.");
          }

          calibrationStartTimeRef.current = null;
          setTimeout(() => {
            setIsCalibratingCenter(false);
          }, 1500);
        }
      }

      // 5. Classify Direction
      const classifiedDir = classifierRef.current.classify(
        smoothedVector,
        baseline,
        true,
        blink.isBlinking
      );

      const frameState: GazeFrameState = {
        features: smoothedVector,
        rawFeatures: rawVector,
        eyeFeatures: eyeFeat,
        headPose: pose,
        direction: classifiedDir,
        confidence: conf,
        isBlinking: blink.isBlinking,
        ear: averageEAR,
        faceVisible: true,
        timestamp: timestampMs,
      };

      gazeRef.current = frameState;

      // 6. Record history for debug line chart (last ~5 seconds, keep max 150 samples)
      historyRef.current.push({
        timeMs: timestampMs,
        rawIrisX: rawVector.irisX,
        smoothedIrisX: smoothedVector.irisX,
        direction: classifiedDir,
      });
      if (historyRef.current.length > 150) {
        historyRef.current.shift();
      }

      // 7. Throttled UI state updates (~10 Hz or 100ms)
      if (timestampMs - lastStateUpdateTimeRef.current >= 100) {
        lastStateUpdateTimeRef.current = timestampMs;
        setDirection(classifiedDir);
        setConfidence(conf);
        setIsBlinking(blink.isBlinking);
        setFaceVisible(true);
        setHistory([...historyRef.current]);
      }

      if (onGazeFrame) {
        onGazeFrame(frameState);
      }

      return frameState;
    },
    [baseline, onGazeFrame]
  );

  return {
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
  };
}
