import assert from "node:assert/strict";
import test from "node:test";
import {
  solveLinearSystem,
  fitRidgeRegression,
  predictRidgeRegression,
} from "./ridge";
import {
  buildFeatureVector,
  buildFeatureMatrix,
  DEFAULT_FEATURE_CONFIG,
} from "./features";
import {
  evaluateCalibrationQuality,
} from "./quality";
import {
  GazeMapper,
  CalibrationSample,
} from "./mapper";
import type { GazeFeaturesVector } from "@/lib/gaze/smoothing";

test("Linear system solver with Gaussian elimination", () => {
  // 2x + y = 5, x + 3y = 5 => x = 2, y = 1
  const A = [
    [2, 1],
    [1, 3],
  ];
  const B = [
    [5],
    [5],
  ];
  const X = solveLinearSystem(A, B);
  assert.ok(Math.abs(X[0][0] - 2) < 1e-6);
  assert.ok(Math.abs(X[1][0] - 1) < 1e-6);
});

test("Ridge regression fits linear and noisy polynomial data", () => {
  // Generate synthetic points: Y = [2*x1 - x2 + 0.5, 3*x2 + 0.2]
  const N = 20;
  const X: number[][] = [];
  const Y: number[][] = [];

  for (let i = 0; i < N; i++) {
    const x1 = (i / N) * 2 - 1;
    const x2 = Math.sin(i);
    X.push([x1, x2]);
    Y.push([2 * x1 - x2 + 0.5, 3 * x2 + 0.2]);
  }

  const model = fitRidgeRegression(X, Y, 1e-4);
  const Y_pred = predictRidgeRegression(X, model);

  // Predictions should match true Y with high accuracy
  for (let i = 0; i < N; i++) {
    assert.ok(Math.abs(Y_pred[i][0] - Y[i][0]) < 0.05);
    assert.ok(Math.abs(Y_pred[i][1] - Y[i][1]) < 0.05);
  }
});

test("Feature vector generation and configuration", () => {
  const sample: GazeFeaturesVector = {
    irisX: 0.5,
    irisY: 0.6,
    yaw: 5.0,
    pitch: -2.0,
    roll: 1.0,
  };

  const defaultFeats = buildFeatureVector(sample, DEFAULT_FEATURE_CONFIG);
  assert.equal(defaultFeats.length, 5);

  const polyFeats = buildFeatureVector(sample, {
    includePolynomial: true,
    includeCrossTerms: true,
    includeHeadPose: true,
  });
  assert.ok(polyFeats.length > 5);

  const matrix = buildFeatureMatrix([sample, sample]);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[0].length, defaultFeats.length);
});

test("Calibration quality assessment and grading thresholds", () => {
  const targets = [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.9 },
  ];

  // Near-perfect predictions (< 2% error) -> "good"
  const goodPreds = [
    { x: 0.11, y: 0.10 },
    { x: 0.50, y: 0.51 },
    { x: 0.89, y: 0.90 },
  ];
  const qualityGood = evaluateCalibrationQuality(targets, goodPreds, 1920, 1080);
  assert.equal(qualityGood.grade, "good");
  assert.ok(qualityGood.meanErrorPercent < 5.0);

  // Moderate error (~11% error) -> "okay"
  const okayPreds = [
    { x: 0.22, y: 0.20 },
    { x: 0.62, y: 0.58 },
    { x: 0.78, y: 0.82 },
  ];
  const qualityOkay = evaluateCalibrationQuality(targets, okayPreds, 1920, 1080);
  assert.equal(qualityOkay.grade, "okay");

  // Poor error (> 20% error) -> "poor"
  const poorPreds = [
    { x: 0.4, y: 0.4 },
    { x: 0.1, y: 0.8 },
    { x: 0.2, y: 0.3 },
  ];
  const qualityPoor = evaluateCalibrationQuality(targets, poorPreds, 1920, 1080);
  assert.equal(qualityPoor.grade, "poor");
});

test("GazeMapper serialization and prediction clamping round-trip", () => {
  const trainSamples: CalibrationSample[] = [
    { features: { irisX: 0.2, irisY: 0.2, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.1, y: 0.1 } },
    { features: { irisX: 0.8, irisY: 0.2, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.9, y: 0.1 } },
    { features: { irisX: 0.2, irisY: 0.8, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.1, y: 0.9 } },
    { features: { irisX: 0.8, irisY: 0.8, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.9, y: 0.9 } },
    { features: { irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.5, y: 0.5 } },
  ];

  const valSamples: CalibrationSample[] = [
    { features: { irisX: 0.4, irisY: 0.4, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.4, y: 0.4 } },
    { features: { irisX: 0.6, irisY: 0.6, yaw: 0, pitch: 0, roll: 0 }, target: { x: 0.6, y: 0.6 } },
  ];

  const mapper = GazeMapper.fit(trainSamples, valSamples, 1920, 1080);
  const serialized = mapper.serialize();
  const restored = GazeMapper.deserialize(serialized);

  assert.ok(restored !== null);
  assert.equal(restored.viewportWidth, 1920);
  assert.equal(restored.viewportHeight, 1080);
  assert.equal(restored.quality.grade, "good");

  // Test prediction
  const pred = restored.predict({ irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 });
  assert.ok(pred.x >= 0 && pred.x <= 1.0);
  assert.ok(pred.y >= 0 && pred.y <= 1.0);
  assert.ok(pred.xPx >= 0 && pred.xPx <= 1920);
  assert.ok(pred.yPx >= 0 && pred.yPx <= 1080);
});

test("Simulated End-to-End calibration with 9 training + 5 validation points", () => {
  // Synthetic Ground Truth: screenX = 1.2 * irisX - 0.1 + 0.005 * yaw, screenY = 1.1 * irisY - 0.05
  const groundTruth = (s: { x: number; y: number; yaw: number; pitch: number }) => ({
    targetX: Math.max(0.05, Math.min(0.95, 1.2 * s.x - 0.1 + 0.002 * s.yaw)),
    targetY: Math.max(0.05, Math.min(0.95, 1.1 * s.y - 0.05 + 0.001 * s.pitch)),
  });

  // 9 Training Grid Points (3x3)
  const gridPositions = [
    { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 },
    { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.8, y: 0.8 },
  ];

  const trainingSamples: CalibrationSample[] = gridPositions.map((pt) => {
    const yaw = (pt.x - 0.5) * 10;
    const pitch = (pt.y - 0.5) * 8;
    const gt = groundTruth({ x: pt.x, y: pt.y, yaw, pitch });
    return {
      features: { irisX: pt.x, irisY: pt.y, yaw, pitch, roll: 0 },
      target: { x: gt.targetX, y: gt.targetY },
    };
  });

  // 5 Validation Points
  const valPositions = [
    { x: 0.35, y: 0.35 },
    { x: 0.65, y: 0.35 },
    { x: 0.50, y: 0.50 },
    { x: 0.35, y: 0.65 },
    { x: 0.65, y: 0.65 },
  ];

  const valSamples: CalibrationSample[] = valPositions.map((pt) => {
    const yaw = (pt.x - 0.5) * 10;
    const pitch = (pt.y - 0.5) * 8;
    const gt = groundTruth({ x: pt.x, y: pt.y, yaw, pitch });
    return {
      features: { irisX: pt.x, irisY: pt.y, yaw, pitch, roll: 0 },
      target: { x: gt.targetX, y: gt.targetY },
    };
  });

  // Fit model
  const mapper = GazeMapper.fit(trainingSamples, valSamples, 1920, 1080);
  assert.ok(mapper !== null);
  assert.equal(mapper.quality.grade, "good");
  assert.ok(mapper.quality.meanErrorPercent < 4.0, `Expected error < 4%, got ${mapper.quality.meanErrorPercent}%`);
});
