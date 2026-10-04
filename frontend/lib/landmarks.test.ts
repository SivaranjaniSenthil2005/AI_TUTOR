import assert from "node:assert/strict";
import test from "node:test";
import {
  TOTAL_LANDMARKS,
  LEFT_IRIS_INDICES,
  RIGHT_IRIS_INDICES,
  LEFT_IRIS_CENTER,
  RIGHT_IRIS_CENTER,
  LEFT_EYE_CONTOUR,
  RIGHT_EYE_CONTOUR,
  LEFT_EYE_INNER_CORNER,
  LEFT_EYE_OUTER_CORNER,
  RIGHT_EYE_INNER_CORNER,
  RIGHT_EYE_OUTER_CORNER,
  LEFT_EYELID_UPPER,
  LEFT_EYELID_LOWER,
  RIGHT_EYELID_UPPER,
  RIGHT_EYELID_LOWER,
  buildContourConnections,
} from "./landmarks.ts";

test("Landmark definitions consistency", () => {
  // Total landmark count must be 478
  assert.equal(TOTAL_LANDMARKS, 478);

  // Left and Right iris must have exactly 5 points
  assert.equal(LEFT_IRIS_INDICES.length, 5);
  assert.equal(RIGHT_IRIS_INDICES.length, 5);

  // Center points must match expected indices
  assert.equal(LEFT_IRIS_CENTER, 473);
  assert.equal(RIGHT_IRIS_CENTER, 468);
  assert.equal(LEFT_IRIS_INDICES[0], LEFT_IRIS_CENTER);
  assert.equal(RIGHT_IRIS_INDICES[0], RIGHT_IRIS_CENTER);

  // All iris indices must be valid within 0..477 range
  for (const idx of [...LEFT_IRIS_INDICES, ...RIGHT_IRIS_INDICES]) {
    assert.ok(idx >= 0 && idx < TOTAL_LANDMARKS, `Index ${idx} out of range`);
  }

  // Eye contours should be non-empty and within range
  assert.ok(LEFT_EYE_CONTOUR.length >= 16);
  assert.ok(RIGHT_EYE_CONTOUR.length >= 16);
  for (const idx of [...LEFT_EYE_CONTOUR, ...RIGHT_EYE_CONTOUR]) {
    assert.ok(idx >= 0 && idx < TOTAL_LANDMARKS, `Index ${idx} out of range`);
  }

  // Corner and eyelid points
  assert.ok(LEFT_EYE_INNER_CORNER < TOTAL_LANDMARKS);
  assert.ok(LEFT_EYE_OUTER_CORNER < TOTAL_LANDMARKS);
  assert.ok(RIGHT_EYE_INNER_CORNER < TOTAL_LANDMARKS);
  assert.ok(RIGHT_EYE_OUTER_CORNER < TOTAL_LANDMARKS);

  assert.ok(LEFT_EYELID_UPPER.length > 0);
  assert.ok(LEFT_EYELID_LOWER.length > 0);
  assert.ok(RIGHT_EYELID_UPPER.length > 0);
  assert.ok(RIGHT_EYELID_LOWER.length > 0);

  // Connections helper
  const connections = buildContourConnections([1, 2, 3]);
  assert.deepEqual(connections, [
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 1 },
  ]);
});
