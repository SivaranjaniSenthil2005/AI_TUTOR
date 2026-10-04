/**
 * AI Tutor - Eye Feature Extraction
 * Computes iris position relative to eye corners and eyelids in the eye's local coordinate frame.
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
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

export interface SingleEyeFeatures {
  horizontalRatio: number; // 0.0 (user left) to 1.0 (user right)
  verticalRatio: number;   // 0.0 (looking down) to 1.0 (looking up)
  irisCenter: { x: number; y: number; z: number };
  cornerDist: number;
  eyelidDist: number;
}

export interface EyeGazeFeatures {
  leftEye: SingleEyeFeatures;
  rightEye: SingleEyeFeatures;
  combined: {
    irisX: number; // 0.0 to 1.0 (0.5 = center)
    irisY: number; // 0.0 to 1.0 (0.5 = center)
  };
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Computes 2D distance between two points.
 */
function dist2D(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Projects a point onto a line segment defined by (p1 -> p2) and returns the normalized ratio (0..1).
 */
function projectOntoSegment(p: Point2D, p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) return 0.5;

  const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/**
 * Average point coordinates across an array of landmark indices.
 */
function averageLandmarks(landmarks: NormalizedLandmark[], indices: readonly number[]): Point2D {
  let x = 0;
  let y = 0;
  for (const idx of indices) {
    x += landmarks[idx].x;
    y += landmarks[idx].y;
  }
  return { x: x / indices.length, y: y / indices.length };
}

/**
 * Extracts normalized eye gaze features from 478 MediaPipe landmarks.
 * In a mirrored video:
 * - User's anatomical Left Eye is on the right side of the video frame.
 * - User's anatomical Right Eye is on the left side of the video frame.
 * - Horizontal ratio is normalized such that:
 *     0.0 = User looking towards USER's LEFT
 *     1.0 = User looking towards USER's RIGHT
 */
export function extractEyeFeatures(landmarks: NormalizedLandmark[]): EyeGazeFeatures | null {
  if (!landmarks || landmarks.length < 478) {
    return null;
  }

  // --- 1. LEFT EYE (User Anatomical Left) ---
  // Inner corner: medial (133), Outer corner: lateral (33)
  // For the left eye, user's left is toward the outer corner (33) and user's right is toward inner corner (133).
  const leftOuter = { x: landmarks[LEFT_EYE_OUTER_CORNER].x, y: landmarks[LEFT_EYE_OUTER_CORNER].y };
  const leftInner = { x: landmarks[LEFT_EYE_INNER_CORNER].x, y: landmarks[LEFT_EYE_INNER_CORNER].y };
  const leftIris = {
    x: landmarks[LEFT_IRIS_CENTER].x,
    y: landmarks[LEFT_IRIS_CENTER].y,
    z: landmarks[LEFT_IRIS_CENTER].z || 0,
  };

  const leftUpper = averageLandmarks(landmarks, LEFT_EYELID_UPPER);
  const leftLower = averageLandmarks(landmarks, LEFT_EYELID_LOWER);

  // Horizontal: outer corner (user left) -> inner corner (user right)
  const leftH = projectOntoSegment(leftIris, leftOuter, leftInner);
  // Vertical: lower eyelid (down) -> upper eyelid (up)
  const leftV = projectOntoSegment(leftIris, leftLower, leftUpper);

  const leftEyeFeat: SingleEyeFeatures = {
    horizontalRatio: leftH,
    verticalRatio: leftV,
    irisCenter: leftIris,
    cornerDist: dist2D(leftOuter, leftInner),
    eyelidDist: dist2D(leftLower, leftUpper),
  };

  // --- 2. RIGHT EYE (User Anatomical Right) ---
  // Inner corner: medial (362), Outer corner: lateral (263)
  // For the right eye, user's left is toward inner corner (362) and user's right is toward outer corner (263).
  const rightInner = { x: landmarks[RIGHT_EYE_INNER_CORNER].x, y: landmarks[RIGHT_EYE_INNER_CORNER].y };
  const rightOuter = { x: landmarks[RIGHT_EYE_OUTER_CORNER].x, y: landmarks[RIGHT_EYE_OUTER_CORNER].y };
  const rightIris = {
    x: landmarks[RIGHT_IRIS_CENTER].x,
    y: landmarks[RIGHT_IRIS_CENTER].y,
    z: landmarks[RIGHT_IRIS_CENTER].z || 0,
  };

  const rightUpper = averageLandmarks(landmarks, RIGHT_EYELID_UPPER);
  const rightLower = averageLandmarks(landmarks, RIGHT_EYELID_LOWER);

  // Horizontal: inner corner (user left) -> outer corner (user right)
  const rightH = projectOntoSegment(rightIris, rightInner, rightOuter);
  // Vertical: lower eyelid (down) -> upper eyelid (up)
  const rightV = projectOntoSegment(rightIris, rightLower, rightUpper);

  const rightEyeFeat: SingleEyeFeatures = {
    horizontalRatio: rightH,
    verticalRatio: rightV,
    irisCenter: rightIris,
    cornerDist: dist2D(rightInner, rightOuter),
    eyelidDist: dist2D(rightLower, rightUpper),
  };

  // Combined average (0.5 is center)
  const combined = {
    irisX: (leftEyeFeat.horizontalRatio + rightEyeFeat.horizontalRatio) / 2,
    irisY: (leftEyeFeat.verticalRatio + rightEyeFeat.verticalRatio) / 2,
  };

  return {
    leftEye: leftEyeFeat,
    rightEye: rightEyeFeat,
    combined,
  };
}
