/**
 * AI Tutor - Calibration Quality & Accuracy Metrics
 * Evaluates validation point predictions against true screen targets and assigns accuracy grades.
 */

export type CalibrationGrade = "good" | "okay" | "poor";

export interface CalibrationPointResult {
  target: { x: number; y: number };
  predicted: { x: number; y: number };
  errorNormalized: number; // Euclidean distance in 0..1 normalized units
  errorPercentDiag: number; // Error as percentage of screen diagonal
  errorPx: number;          // Error in screen pixels
}

export interface CalibrationQuality {
  grade: CalibrationGrade;
  meanErrorPercent: number; // Average error % of diagonal
  p90ErrorPercent: number;  // 90th percentile error % of diagonal
  meanErrorPx: number;      // Average error in pixels
  p90ErrorPx: number;       // 90th percentile error in pixels
  pointResults: CalibrationPointResult[];
}

export interface QualityThresholds {
  goodThresholdPercent?: number; // default: 8.5%
  okayThresholdPercent?: number; // default: 14.0%
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  goodThresholdPercent: 8.5,
  okayThresholdPercent: 14.0,
};

/**
 * Evaluates calibration accuracy given true targets and predicted coordinates.
 */
export function evaluateCalibrationQuality(
  targets: { x: number; y: number }[],
  predictions: { x: number; y: number }[],
  viewportWidth: number = 1920,
  viewportHeight: number = 1080,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): CalibrationQuality {
  if (targets.length === 0 || targets.length !== predictions.length) {
    return {
      grade: "poor",
      meanErrorPercent: 100,
      p90ErrorPercent: 100,
      meanErrorPx: 1000,
      p90ErrorPx: 1000,
      pointResults: [],
    };
  }

  const {
    goodThresholdPercent = 8.5,
    okayThresholdPercent = 14.0,
  } = thresholds;

  const diagPx = Math.hypot(viewportWidth, viewportHeight);

  const pointResults: CalibrationPointResult[] = [];
  const percentErrors: number[] = [];
  const pxErrors: number[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const p = predictions[i];

    // Normalized error in aspect-scaled screen units
    const dxPx = (p.x - t.x) * viewportWidth;
    const dyPx = (p.y - t.y) * viewportHeight;
    const errPx = Math.hypot(dxPx, dyPx);
    const errNorm = Math.hypot(p.x - t.x, p.y - t.y);
    const errPercent = (errPx / Math.max(diagPx, 1)) * 100.0;

    percentErrors.push(errPercent);
    pxErrors.push(errPx);

    pointResults.push({
      target: t,
      predicted: p,
      errorNormalized: errNorm,
      errorPercentDiag: errPercent,
      errorPx: errPx,
    });
  }

  // Calculate Mean
  const meanPercent =
    percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length;
  const meanPx = pxErrors.reduce((a, b) => a + b, 0) / pxErrors.length;

  // Calculate 90th percentile (P90)
  const sortedPercent = [...percentErrors].sort((a, b) => a - b);
  const sortedPx = [...pxErrors].sort((a, b) => a - b);
  const p90Index = Math.min(
    Math.floor(sortedPercent.length * 0.9),
    sortedPercent.length - 1
  );
  const p90Percent = sortedPercent[p90Index];
  const p90Px = sortedPx[p90Index];

  // Assign grade
  let grade: CalibrationGrade = "poor";
  if (meanPercent <= goodThresholdPercent && p90Percent <= goodThresholdPercent * 1.5) {
    grade = "good";
  } else if (meanPercent <= okayThresholdPercent) {
    grade = "okay";
  } else {
    grade = "poor";
  }

  return {
    grade,
    meanErrorPercent: Number(meanPercent.toFixed(2)),
    p90ErrorPercent: Number(p90Percent.toFixed(2)),
    meanErrorPx: Math.round(meanPx),
    p90ErrorPx: Math.round(p90Px),
    pointResults,
  };
}
