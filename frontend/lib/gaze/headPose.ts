/**
 * AI Tutor - Head Pose Estimation
 * Extracts Euler angles (yaw, pitch, roll in degrees) from MediaPipe's 4x4 facial transformation matrix.
 */

export interface HeadPose {
  pitch: number; // Rotation around X-axis (nodding up/down in degrees: +up, -down)
  yaw: number;   // Rotation around Y-axis (turning left/right in degrees: +right, -left)
  roll: number;  // Rotation around Z-axis (head tilt in degrees: +clockwise, -counter-clockwise)
}

/**
 * Extracts pitch, yaw, and roll from a 4x4 transformation matrix.
 * MediaPipe provides matrix in column-major order (16 numbers):
 * [
 *   m0, m4, m8,  m12,
 *   m1, m5, m9,  m13,
 *   m2, m6, m10, m14,
 *   m3, m7, m11, m15
 * ]
 */
export function extractHeadPose(matrix: number[] | Float32Array | undefined | null): HeadPose {
  if (!matrix || matrix.length < 16) {
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  // Rotation matrix components (column-major indexing)
  const r00 = matrix[0];
  const r01 = matrix[4];
  const r11 = matrix[5];
  const r21 = matrix[6];
  const r02 = matrix[8];
  const r12 = matrix[9];
  const r22 = matrix[10];

  const radToDeg = 180 / Math.PI;

  let pitch = 0;
  let yaw = 0;
  let roll = 0;

  // Check for gimbal lock when r02 is near +/- 1
  const clampedR02 = Math.max(-1, Math.min(1, r02));
  yaw = Math.asin(clampedR02);

  if (Math.abs(clampedR02) < 0.99999) {
    pitch = Math.atan2(-r12, r22);
    roll = Math.atan2(-r01, r00);
  } else {
    // Gimbal lock fallback
    pitch = Math.atan2(r21, r11);
    roll = 0;
  }

  const toCleanDeg = (rad: number) => {
    const deg = rad * radToDeg;
    return Math.abs(deg) < 1e-6 ? 0 : deg;
  };

  return {
    pitch: toCleanDeg(pitch),
    yaw: toCleanDeg(yaw),
    roll: toCleanDeg(roll),
  };
}
