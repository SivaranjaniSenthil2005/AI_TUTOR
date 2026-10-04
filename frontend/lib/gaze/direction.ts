/**
 * AI Tutor - Coarse Gaze Direction Classifier
 * Classifies eye gaze into 'left' | 'right' | 'up' | 'down' | 'center' | 'unknown' with dead-zones and hysteresis.
 */

import type { GazeFeaturesVector } from "./smoothing";

export type GazeDirection = "left" | "right" | "up" | "down" | "center" | "unknown";

export interface GazeBaseline {
  irisX: number;
  irisY: number;
  yaw: number;
  pitch: number;
  sampleCount: number;
  timestamp: number;
}

export const DEFAULT_BASELINE: GazeBaseline = {
  irisX: 0.5,
  irisY: 0.5,
  yaw: 0.0,
  pitch: 0.0,
  sampleCount: 1,
  timestamp: 0,
};

export interface DirectionClassifierConfig {
  thresholdX?: number;        // Delta threshold for left/right (default: 0.045)
  thresholdY?: number;        // Delta threshold for up/down (default: 0.055)
  headWeightYaw?: number;     // Head yaw contribution factor (default: 0.003)
  headWeightPitch?: number;   // Head pitch contribution factor (default: 0.003)
  hysteresisFrames?: number;  // Consecutive frames needed to commit to a direction change (default: 3)
}

export class DirectionClassifier {
  private thresholdX: number;
  private thresholdY: number;
  private headWeightYaw: number;
  private headWeightPitch: number;
  private hysteresisFrames: number;

  private currentDirection: GazeDirection = "center";
  private candidateDirection: GazeDirection = "center";
  private candidateCount: number = 0;

  constructor(config: DirectionClassifierConfig = {}) {
    this.thresholdX = config.thresholdX ?? 0.045;
    this.thresholdY = config.thresholdY ?? 0.055;
    this.headWeightYaw = config.headWeightYaw ?? 0.003;
    this.headWeightPitch = config.headWeightPitch ?? 0.003;
    this.hysteresisFrames = config.hysteresisFrames ?? 3;
  }

  public updateConfig(config: DirectionClassifierConfig) {
    if (config.thresholdX !== undefined) this.thresholdX = config.thresholdX;
    if (config.thresholdY !== undefined) this.thresholdY = config.thresholdY;
    if (config.headWeightYaw !== undefined) this.headWeightYaw = config.headWeightYaw;
    if (config.headWeightPitch !== undefined) this.headWeightPitch = config.headWeightPitch;
    if (config.hysteresisFrames !== undefined) this.hysteresisFrames = config.hysteresisFrames;
  }

  /**
   * Classifies direction using smoothed gaze features relative to the neutral baseline.
   * Matches USER's perspective on mirrored display.
   */
  public classify(
    features: GazeFeaturesVector | null,
    baseline: GazeBaseline = DEFAULT_BASELINE,
    isFaceVisible: boolean = true,
    isBlinking: boolean = false
  ): GazeDirection {
    if (!isFaceVisible || !features || isBlinking) {
      if (!isFaceVisible) {
        this.currentDirection = "unknown";
        this.candidateDirection = "unknown";
        this.candidateCount = 0;
        return "unknown";
      }
      // During blink, maintain current direction
      return this.currentDirection;
    }

    // Effective horizontal delta: iris displacement + head yaw rotation
    const deltaX = (features.irisX - baseline.irisX) + (features.yaw - baseline.yaw) * this.headWeightYaw;
    // Effective vertical delta: iris displacement + head pitch rotation
    const deltaY = (features.irisY - baseline.irisY) + (features.pitch - baseline.pitch) * this.headWeightPitch;

    let instantDirection: GazeDirection = "center";

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > this.thresholdX || absY > this.thresholdY) {
      if (absX >= absY) {
        // Horizontal dominant
        instantDirection = deltaX < -this.thresholdX ? "left" : "right";
      } else {
        // Vertical dominant
        instantDirection = deltaY > this.thresholdY ? "up" : "down";
      }
    } else {
      instantDirection = "center";
    }

    // Apply Hysteresis to eliminate transient flicker
    if (instantDirection === this.candidateDirection) {
      this.candidateCount++;
      if (this.candidateCount >= this.hysteresisFrames) {
        this.currentDirection = instantDirection;
      }
    } else {
      this.candidateDirection = instantDirection;
      this.candidateCount = 1;
    }

    return this.currentDirection;
  }

  public reset() {
    this.currentDirection = "center";
    this.candidateDirection = "center";
    this.candidateCount = 0;
  }
}
