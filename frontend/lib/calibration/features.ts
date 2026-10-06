/**
 * AI Tutor - Calibration Feature Engineering
 * Expands raw gaze features (iris positions + head pose) into linear and polynomial basis vectors for regression.
 */

import type { GazeFeaturesVector } from "@/lib/gaze/smoothing";

export interface FeatureConfig {
  includePolynomial?: boolean; // Squares: irisX^2, irisY^2, yaw^2, pitch^2
  includeCrossTerms?: boolean; // Interaction: irisX * irisY, irisX * yaw, irisY * pitch
  includeHeadPose?: boolean;   // Head yaw, pitch, roll
}

export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  includePolynomial: false,
  includeCrossTerms: false,
  includeHeadPose: true,
};

/**
 * Transforms a single GazeFeaturesVector sample into a 1D feature array for regression fitting/prediction.
 */
export function buildFeatureVector(
  sample: GazeFeaturesVector,
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG
): number[] {
  const {
    includePolynomial = true,
    includeCrossTerms = true,
    includeHeadPose = true,
  } = config;

  const { irisX, irisY, yaw, pitch, roll } = sample;

  // Base linear terms
  const features: number[] = [irisX, irisY];

  if (includeHeadPose) {
    features.push(yaw, pitch, roll);
  }

  // Degree 2 polynomial squares
  if (includePolynomial) {
    features.push(irisX * irisX, irisY * irisY);
    if (includeHeadPose) {
      features.push(yaw * yaw, pitch * pitch);
    }
  }

  // Interaction cross terms
  if (includeCrossTerms) {
    features.push(irisX * irisY);
    if (includeHeadPose) {
      features.push(irisX * yaw, irisY * pitch);
    }
  }

  return features;
}

/**
 * Transforms an array of gaze samples into a 2D feature matrix (N x D).
 */
export function buildFeatureMatrix(
  samples: GazeFeaturesVector[],
  config: FeatureConfig = DEFAULT_FEATURE_CONFIG
): number[][] {
  return samples.map((s) => buildFeatureVector(s, config));
}
