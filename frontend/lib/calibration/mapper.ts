/**
 * AI Tutor - Gaze to Screen Mapper
 * Manages fitted regression models, screen coordinate prediction, serialization, and hyperparameter tuning.
 */

import type { GazeFeaturesVector } from "@/lib/gaze/smoothing";
import {
  RidgeModel,
  fitRidgeRegression,
  predictRidgeRegression,
} from "./ridge";
import {
  FeatureConfig,
  DEFAULT_FEATURE_CONFIG,
  buildFeatureVector,
  buildFeatureMatrix,
} from "./features";
import {
  CalibrationQuality,
  evaluateCalibrationQuality,
} from "./quality";

export interface SerializedGazeMapper {
  version: number;
  model: RidgeModel;
  featureConfig: FeatureConfig;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: number;
  quality: CalibrationQuality;
}

export interface CalibrationSample {
  features: GazeFeaturesVector;
  target: { x: number; y: number }; // Normalized viewport coordinates [0..1]
}

export class GazeMapper {
  public model: RidgeModel;
  public featureConfig: FeatureConfig;
  public viewportWidth: number;
  public viewportHeight: number;
  public timestamp: number;
  public quality: CalibrationQuality;

  constructor(
    model: RidgeModel,
    quality: CalibrationQuality,
    viewportWidth: number = 1920,
    viewportHeight: number = 1080,
    featureConfig: FeatureConfig = DEFAULT_FEATURE_CONFIG,
    timestamp: number = Date.now()
  ) {
    this.model = model;
    this.quality = quality;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.featureConfig = featureConfig;
    this.timestamp = timestamp;
  }

  /**
   * Predicts screen gaze coordinates in normalized [0..1] space and absolute pixel coordinates.
   */
  public predict(sample: GazeFeaturesVector): {
    x: number;
    y: number;
    xPx: number;
    yPx: number;
  } {
    const featVec = buildFeatureVector(sample, this.featureConfig);
    const predMatrix = predictRidgeRegression([featVec], this.model);

    const rawX = predMatrix[0][0];
    const rawY = predMatrix[0][1];

    // Clamp to viewport boundary [0, 1]
    const x = Math.max(0.0, Math.min(1.0, rawX));
    const y = Math.max(0.0, Math.min(1.0, rawY));

    const xPx = Math.round(x * this.viewportWidth);
    const yPx = Math.round(y * this.viewportHeight);

    return { x, y, xPx, yPx };
  }

  /**
   * Checks if current viewport size has deviated significantly (>15%) from calibration time.
   */
  public isViewportDeviated(
    currentWidth: number,
    currentHeight: number,
    maxDeviationThreshold: number = 0.15
  ): boolean {
    const widthRatio = Math.abs(currentWidth - this.viewportWidth) / Math.max(this.viewportWidth, 1);
    const heightRatio = Math.abs(currentHeight - this.viewportHeight) / Math.max(this.viewportHeight, 1);
    return widthRatio > maxDeviationThreshold || heightRatio > maxDeviationThreshold;
  }

  /**
   * Serializes the mapper to a JSON string for browser localStorage persistence.
   */
  public serialize(): string {
    const data: SerializedGazeMapper = {
      version: 1,
      model: this.model,
      featureConfig: this.featureConfig,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      timestamp: this.timestamp,
      quality: this.quality,
    };
    return JSON.stringify(data);
  }

  /**
   * Restores a GazeMapper instance from serialized JSON.
   */
  public static deserialize(jsonStr: string): GazeMapper | null {
    try {
      const data = JSON.parse(jsonStr) as SerializedGazeMapper;
      if (!data || !data.model || !data.model.weights || !data.quality) {
        return null;
      }
      return new GazeMapper(
        data.model,
        data.quality,
        data.viewportWidth || 1920,
        data.viewportHeight || 1080,
        data.featureConfig || DEFAULT_FEATURE_CONFIG,
        data.timestamp || Date.now()
      );
    } catch {
      return null;
    }
  }

  /**
   * Fits a GazeMapper from calibration training points and validation points with hyperparameter search.
   */
  public static fit(
    trainingSamples: CalibrationSample[],
    validationSamples: CalibrationSample[],
    viewportWidth: number,
    viewportHeight: number,
    config: FeatureConfig = DEFAULT_FEATURE_CONFIG
  ): GazeMapper {
    if (trainingSamples.length < 4) {
      throw new Error("At least 4 training calibration points are required.");
    }

    const X_train = buildFeatureMatrix(
      trainingSamples.map((s) => s.features),
      config
    );
    const Y_train = trainingSamples.map((s) => [s.target.x, s.target.y]);

    const X_val = buildFeatureMatrix(
      validationSamples.map((s) => s.features),
      config
    );
    const valTargets = validationSamples.map((s) => s.target);

    // Hyperparameter search for best Ridge lambda parameter
    const candidateLambdas = [1e-4, 1e-3, 5e-3, 1e-2, 5e-2, 0.1, 0.5, 1.0, 5.0, 10.0];
    let bestModel: RidgeModel | null = null;
    let bestQuality: CalibrationQuality | null = null;
    let minMeanError = Infinity;

    for (const lambda of candidateLambdas) {
      const candidateModel = fitRidgeRegression(X_train, Y_train, lambda);
      const valPredsMatrix = predictRidgeRegression(X_val, candidateModel);
      const valPreds = valPredsMatrix.map(([x, y]) => ({
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      }));

      const quality = evaluateCalibrationQuality(
        valTargets,
        valPreds,
        viewportWidth,
        viewportHeight
      );

      if (quality.meanErrorPercent < minMeanError) {
        minMeanError = quality.meanErrorPercent;
        bestModel = candidateModel;
        bestQuality = quality;
      }
    }

    if (!bestModel || !bestQuality) {
      // Fallback with default lambda 0.01
      bestModel = fitRidgeRegression(X_train, Y_train, 1e-2);
      const valPredsMatrix = predictRidgeRegression(X_val, bestModel);
      const valPreds = valPredsMatrix.map(([x, y]) => ({ x, y }));
      bestQuality = evaluateCalibrationQuality(
        valTargets,
        valPreds,
        viewportWidth,
        viewportHeight
      );
    }

    return new GazeMapper(
      bestModel,
      bestQuality,
      viewportWidth,
      viewportHeight,
      config,
      Date.now()
    );
  }
}
