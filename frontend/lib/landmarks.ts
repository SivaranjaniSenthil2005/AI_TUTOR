/**
 * AI Tutor - MediaPipe Face & Eye Landmark Indices
 *
 * MediaPipe FaceLandmarker provides 478 3D landmark points:
 * - 0 to 467: Canonical 468 face mesh landmarks
 * - 468 to 472: Right eye iris (468 = center, 469..472 = contour)
 * - 473 to 477: Left eye iris (473 = center, 474..477 = contour)
 *
 * Note: Anatomical "Left" / "Right" refers to the user's perspective.
 */

export const TOTAL_LANDMARKS = 478;

// --- IRIS LANDMARKS ---

/**
 * Left iris landmark indices (5 points total).
 * Point 473 is the estimated pupil/iris center.
 * Points 474..477 define the perimeter boundary.
 */
export const LEFT_IRIS_INDICES: readonly number[] = Object.freeze([
  473, 474, 475, 476, 477,
]);

export const LEFT_IRIS_CENTER = 473;

/**
 * Right iris landmark indices (5 points total).
 * Point 468 is the estimated pupil/iris center.
 * Points 469..472 define the perimeter boundary.
 */
export const RIGHT_IRIS_INDICES: readonly number[] = Object.freeze([
  468, 469, 470, 471, 472,
]);

export const RIGHT_IRIS_CENTER = 468;

// --- EYE CONTOUR LANDMARKS ---

/**
 * Left eye full contour loop indices in sequential perimeter order.
 */
export const LEFT_EYE_CONTOUR: readonly number[] = Object.freeze([
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
]);

/**
 * Right eye full contour loop indices in sequential perimeter order.
 */
export const RIGHT_EYE_CONTOUR: readonly number[] = Object.freeze([
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
]);

// --- EYE CORNERS ---

/** Left eye inner (medial canthus) and outer (lateral canthus) corners. */
export const LEFT_EYE_INNER_CORNER = 133;
export const LEFT_EYE_OUTER_CORNER = 33;

/** Right eye inner (medial canthus) and outer (lateral canthus) corners. */
export const RIGHT_EYE_INNER_CORNER = 362;
export const RIGHT_EYE_OUTER_CORNER = 263;

// --- EYELIDS (FOR EYE OPENNESS / BLINK CALCULATION) ---

/** Left upper eyelid midpoints. */
export const LEFT_EYELID_UPPER: readonly number[] = Object.freeze([
  160, 159, 158, 157,
]);

/** Left lower eyelid midpoints. */
export const LEFT_EYELID_LOWER: readonly number[] = Object.freeze([
  144, 145, 153, 154,
]);

/** Right upper eyelid midpoints. */
export const RIGHT_EYELID_UPPER: readonly number[] = Object.freeze([
  385, 386, 387, 388,
]);

/** Right lower eyelid midpoints. */
export const RIGHT_EYELID_LOWER: readonly number[] = Object.freeze([
  380, 374, 373, 390,
]);

// --- CONNECTION PAIRS FOR DRAWING ---

export interface LandmarkConnection {
  start: number;
  end: number;
}

/**
 * Builds contiguous closed loop connections from an ordered list of indices.
 */
export function buildContourConnections(
  indices: readonly number[]
): LandmarkConnection[] {
  const connections: LandmarkConnection[] = [];
  for (let i = 0; i < indices.length; i++) {
    connections.push({
      start: indices[i],
      end: indices[(i + 1) % indices.length],
    });
  }
  return connections;
}

export const LEFT_EYE_CONNECTIONS = buildContourConnections(LEFT_EYE_CONTOUR);
export const RIGHT_EYE_CONNECTIONS = buildContourConnections(RIGHT_EYE_CONTOUR);
export const LEFT_IRIS_CONNECTIONS = buildContourConnections([474, 475, 476, 477]);
export const RIGHT_IRIS_CONNECTIONS = buildContourConnections([469, 470, 471, 472]);
