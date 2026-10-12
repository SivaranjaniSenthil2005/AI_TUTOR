import test from "node:test";
import assert from "node:assert/strict";
import { alignSentences } from "./sentenceAligner";

test("sentenceAligner: matches sentences when counts are equal", () => {
  const displayed =
    "Photosynthesis is how plants produce food [1]. It occurs in chloroplasts [2]. This sustains ecosystems.";
  const speech =
    "Photosynthesis is how plants produce food. It occurs in chloroplasts. This sustains ecosystems.";

  const result = alignSentences(displayed, speech);
  assert.equal(result.matches, true);
  assert.equal(result.totalSentences, 3);
  assert.equal(result.getDisplayHighlightIndex(0), 0);
  assert.equal(result.getDisplayHighlightIndex(1), 1);
  assert.equal(result.getDisplayHighlightIndex(2), 2);
  // Out of bounds maps to -1
  assert.equal(result.getDisplayHighlightIndex(3), -1);
});

test("sentenceAligner: falls back to full block highlight (-1) when counts differ", () => {
  const displayed =
    "Newton formulated three laws of motion [1]. The first describes inertia.";
  const speech =
    "Newton formulated three laws of motion. The first describes inertia. The second relates force and mass.";

  const result = alignSentences(displayed, speech);
  assert.equal(result.matches, false);
  // Should return -1 (indicating whole-block fallback) for any sentence index
  assert.equal(result.getDisplayHighlightIndex(0), -1);
  assert.equal(result.getDisplayHighlightIndex(1), -1);
});

test("sentenceAligner: handles empty strings gracefully", () => {
  const result = alignSentences("", "");
  assert.equal(result.matches, false);
  assert.equal(result.getDisplayHighlightIndex(0), -1);
});
