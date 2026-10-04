/**
 * AI Tutor - Blink & Eye Aspect Ratio (EAR) Detection
 * Computes EAR to detect blinks, debounce eye closures, and hold stable gaze values.
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  LEFT_EYE_INNER_CORNER,
  LEFT_EYE_OUTER_CORNER,
  RIGHT_EYE_INNER_CORNER,
  RIGHT_EYE_OUTER_CORNER,
} from "../landmarks";

export interface BlinkState {
  earLeft: number;
  earRight: number;
  earAverage: number;
  isBlinking: boolean;
  blinkCount: number;
}

export interface BlinkDetectorOptions {
  earThreshold?: number;     // EAR below threshold is considered eye closed (default: 0.18)
  minBlinkFrames?: number;   // Consecutive frames for a confirmed blink (default: 2)
  maxBlinkFrames?: number;   // Max frames for a blink before considering eye closed/sleeping (default: 20)
}

function dist2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculates Eye Aspect Ratio (EAR) for an eye given upper/lower points and inner/outer corners.
 * Standard formula: (|p_upper1 - p_lower1| + |p_upper2 - p_lower2|) / (2 * |p_inner - p_outer|)
 */
export function calculateEAR(
  landmarks: NormalizedLandmark[],
  upper1: number,
  lower1: number,
  upper2: number,
  lower2: number,
  corner1: number,
  corner2: number
): number {
  if (!landmarks || landmarks.length < 478) return 0;

  const v1 = dist2D(landmarks[upper1], landmarks[lower1]);
  const v2 = dist2D(landmarks[upper2], landmarks[lower2]);
  const h = dist2D(landmarks[corner1], landmarks[corner2]);

  if (h < 1e-6) return 0;
  return (v1 + v2) / (2.0 * h);
}

/**
 * Computes EAR for both eyes from MediaPipe face landmarks.
 */
export function computeEyeAspectRatios(landmarks: NormalizedLandmark[]): {
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
} {
  if (!landmarks || landmarks.length < 478) {
    return { leftEAR: 0, rightEAR: 0, averageEAR: 0 };
  }

  // Left Eye: upper (160, 158), lower (144, 153), corners (33, 133)
  const leftEAR = calculateEAR(
    landmarks,
    160, 144,
    158, 153,
    LEFT_EYE_OUTER_CORNER, LEFT_EYE_INNER_CORNER
  );

  // Right Eye: upper (385, 387), lower (380, 373), corners (263, 362)
  const rightEAR = calculateEAR(
    landmarks,
    385, 380,
    387, 373,
    RIGHT_EYE_OUTER_CORNER, RIGHT_EYE_INNER_CORNER
  );

  const averageEAR = (leftEAR + rightEAR) / 2.0;

  return {
    leftEAR,
    rightEAR,
    averageEAR,
  };
}

export class BlinkDetector {
  private threshold: number;
  private minFrames: number;
  private closedFrameCounter: number = 0;
  private blinkCount: number = 0;
  private isBlinkingState: boolean = false;

  constructor(options: BlinkDetectorOptions = {}) {
    this.threshold = options.earThreshold ?? 0.18;
    this.minFrames = options.minBlinkFrames ?? 2;
  }

  /**
   * Updates blink detector with new landmark frame.
   */
  public update(landmarks: NormalizedLandmark[] | null): BlinkState {
    if (!landmarks) {
      this.closedFrameCounter = 0;
      this.isBlinkingState = false;
      return {
        earLeft: 0,
        earRight: 0,
        earAverage: 0,
        isBlinking: false,
        blinkCount: this.blinkCount,
      };
    }

    const { leftEAR, rightEAR, averageEAR } = computeEyeAspectRatios(landmarks);

    if (averageEAR < this.threshold) {
      this.closedFrameCounter++;
      if (this.closedFrameCounter >= this.minFrames) {
        if (!this.isBlinkingState) {
          this.blinkCount++;
        }
        this.isBlinkingState = true;
      }
    } else {
      this.closedFrameCounter = 0;
      this.isBlinkingState = false;
    }

    return {
      earLeft: leftEAR,
      earRight: rightEAR,
      earAverage: averageEAR,
      isBlinking: this.isBlinkingState,
      blinkCount: this.blinkCount,
    };
  }

  public reset() {
    this.closedFrameCounter = 0;
    this.isBlinkingState = false;
  }
}
