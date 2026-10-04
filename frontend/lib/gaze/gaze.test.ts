import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { extractEyeFeatures } from "./eyeFeatures";
import { extractHeadPose } from "./headPose";
import { calculateEAR, computeEyeAspectRatios, BlinkDetector } from "./blink";
import { OneEuroFilter, GazeFeatureSmoother } from "./smoothing";
import { DirectionClassifier, DEFAULT_BASELINE } from "./direction";
import {
  LEFT_IRIS_CENTER,
  RIGHT_IRIS_CENTER,
  LEFT_EYE_INNER_CORNER,
  LEFT_EYE_OUTER_CORNER,
  RIGHT_EYE_INNER_CORNER,
  RIGHT_EYE_OUTER_CORNER,
  LEFT_EYELID_UPPER,
  LEFT_EYELID_LOWER,
  RIGHT_EYELID_UPPER,
  RIGHT_EYELID_LOWER,
} from "../landmarks";

/** Helper to generate 478 blank landmarks */
function createMockLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 478; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 });
  }
  return landmarks;
}

test("Eye feature extraction on centered and shifted synthetic landmarks", () => {
  const landmarks = createMockLandmarks();

  // Setup Left Eye: outer corner (33) at x=0.2, inner corner (133) at x=0.4
  landmarks[LEFT_EYE_OUTER_CORNER] = { x: 0.2, y: 0.5, z: 0 };
  landmarks[LEFT_EYE_INNER_CORNER] = { x: 0.4, y: 0.5, z: 0 };
  // Left iris center (473) exactly at midpoint (x=0.3)
  landmarks[LEFT_IRIS_CENTER] = { x: 0.3, y: 0.5, z: 0 };

  // Eyelids
  for (const idx of LEFT_EYELID_UPPER) {
    landmarks[idx] = { x: 0.3, y: 0.4, z: 0 };
  }
  for (const idx of LEFT_EYELID_LOWER) {
    landmarks[idx] = { x: 0.3, y: 0.6, z: 0 };
  }

  // Setup Right Eye: inner corner (362) at x=0.6, outer corner (263) at x=0.8
  landmarks[RIGHT_EYE_INNER_CORNER] = { x: 0.6, y: 0.5, z: 0 };
  landmarks[RIGHT_EYE_OUTER_CORNER] = { x: 0.8, y: 0.5, z: 0 };
  // Right iris center (468) at midpoint (x=0.7)
  landmarks[RIGHT_IRIS_CENTER] = { x: 0.7, y: 0.5, z: 0 };

  for (const idx of RIGHT_EYELID_UPPER) {
    landmarks[idx] = { x: 0.7, y: 0.4, z: 0 };
  }
  for (const idx of RIGHT_EYELID_LOWER) {
    landmarks[idx] = { x: 0.7, y: 0.6, z: 0 };
  }

  const features = extractEyeFeatures(landmarks);
  assert.ok(features !== null);

  // Center iris should yield ratios close to 0.5
  assert.ok(Math.abs(features.leftEye.horizontalRatio - 0.5) < 0.05);
  assert.ok(Math.abs(features.rightEye.horizontalRatio - 0.5) < 0.05);
  assert.ok(Math.abs(features.combined.irisX - 0.5) < 0.05);

  // Test looking left: move left iris towards outer corner (x=0.22)
  landmarks[LEFT_IRIS_CENTER] = { x: 0.22, y: 0.5, z: 0 };
  // and right iris towards inner corner (x=0.62)
  landmarks[RIGHT_IRIS_CENTER] = { x: 0.62, y: 0.5, z: 0 };

  const leftLookFeatures = extractEyeFeatures(landmarks);
  assert.ok(leftLookFeatures !== null);
  assert.ok(leftLookFeatures.combined.irisX < 0.25);
});

test("Head pose extraction from known matrices", () => {
  // Identity matrix = 0 pitch, 0 yaw, 0 roll
  const identity = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];

  const poseIdentity = extractHeadPose(identity);
  assert.equal(poseIdentity.pitch, 0);
  assert.equal(poseIdentity.yaw, 0);
  assert.equal(poseIdentity.roll, 0);

  // 90 degree Yaw around Y-axis:
  // R = [cos(90) 0 sin(90); 0 1 0; -sin(90) 0 cos(90)] = [0 0 1; 0 1 0; -1 0 0]
  // Column-major: m0=0, m1=0, m2=-1, m4=0, m5=1, m6=0, m8=1, m9=0, m10=0
  const yaw90 = [
    0, 0, -1, 0,
    0, 1, 0, 0,
    1, 0, 0, 0,
    0, 0, 0, 1,
  ];

  const poseYaw = extractHeadPose(yaw90);
  assert.ok(Math.abs(poseYaw.yaw - 90) < 0.1);
});

test("Eye Aspect Ratio (EAR) and Blink Detection", () => {
  const landmarks = createMockLandmarks();

  // Open eye configuration
  landmarks[LEFT_EYE_OUTER_CORNER] = { x: 0.2, y: 0.5, z: 0 };
  landmarks[LEFT_EYE_INNER_CORNER] = { x: 0.4, y: 0.5, z: 0 };
  landmarks[160] = { x: 0.27, y: 0.45, z: 0 };
  landmarks[144] = { x: 0.27, y: 0.55, z: 0 };
  landmarks[158] = { x: 0.33, y: 0.45, z: 0 };
  landmarks[153] = { x: 0.33, y: 0.55, z: 0 };

  const earOpen = calculateEAR(landmarks, 160, 144, 158, 153, LEFT_EYE_OUTER_CORNER, LEFT_EYE_INNER_CORNER);
  assert.ok(earOpen > 0.4);

  // Closed eye configuration (eyelids meeting)
  landmarks[160] = { x: 0.27, y: 0.5, z: 0 };
  landmarks[144] = { x: 0.27, y: 0.5, z: 0 };
  landmarks[158] = { x: 0.33, y: 0.5, z: 0 };
  landmarks[153] = { x: 0.33, y: 0.5, z: 0 };

  const earClosed = calculateEAR(landmarks, 160, 144, 158, 153, LEFT_EYE_OUTER_CORNER, LEFT_EYE_INNER_CORNER);
  assert.equal(earClosed, 0);

  // Blink detector state machine
  const detector = new BlinkDetector({ earThreshold: 0.18, minBlinkFrames: 2 });
  const openState = detector.update(landmarks);
  assert.equal(openState.isBlinking, false);

  const ratios = computeEyeAspectRatios(landmarks);
  assert.ok(ratios.leftEAR !== undefined);
  assert.ok(ratios.rightEAR !== undefined);

  // Trigger blink across consecutive frames
  detector.update(landmarks);
  const blinkState = detector.update(landmarks);
  assert.equal(blinkState.isBlinking, true);
  assert.ok(blinkState.blinkCount >= 1);
});

test("One Euro Filter reduces noise and adapts to changes", () => {
  const filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.007 });

  let t = 1000;
  // Initialize
  const val1 = filter.filter(0.5, t);
  assert.equal(val1, 0.5);

  // Add small jitter at steady state
  t += 33;
  const valJitter1 = filter.filter(0.52, t);
  t += 33;
  const valJitter2 = filter.filter(0.48, t);

  // Filter should suppress jitter around 0.5
  assert.ok(Math.abs(valJitter1 - 0.5) < 0.02);
  assert.ok(Math.abs(valJitter2 - 0.5) < 0.02);

  // Multi-feature smoother test
  const smoother = new GazeFeatureSmoother();
  const smoothed = smoother.smooth(
    { irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 },
    t + 33
  );
  assert.ok(smoothed.irisX !== undefined);
});

test("Direction classification with dead-zone and hysteresis", () => {
  const classifier = new DirectionClassifier({
    thresholdX: 0.05,
    thresholdY: 0.05,
    hysteresisFrames: 3,
  });

  const baseline = { ...DEFAULT_BASELINE, irisX: 0.5, irisY: 0.5 };

  // Center state
  let dir = classifier.classify({ irisX: 0.5, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  assert.equal(dir, "center");

  // Single anomalous frame to the left (irisX = 0.40) should NOT immediately switch due to hysteresis
  dir = classifier.classify({ irisX: 0.40, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  assert.equal(dir, "center");

  // Frame 2
  dir = classifier.classify({ irisX: 0.40, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  assert.equal(dir, "center");

  // Frame 3 (hysteresis fulfilled -> commits to 'left')
  dir = classifier.classify({ irisX: 0.40, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  assert.equal(dir, "left");

  // Look right
  classifier.classify({ irisX: 0.60, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  classifier.classify({ irisX: 0.60, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  dir = classifier.classify({ irisX: 0.60, irisY: 0.5, yaw: 0, pitch: 0, roll: 0 }, baseline);
  assert.equal(dir, "right");
});
