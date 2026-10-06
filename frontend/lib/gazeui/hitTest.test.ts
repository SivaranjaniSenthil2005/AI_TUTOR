import { test } from "node:test";
import assert from "node:assert/strict";
import {
  performHitTest,
  computeExpandedBounds,
  isPointInsideBounds,
  computeDistance,
  RectCache,
  type SimpleRect,
} from "./hitTest";
import type { GazeTarget, GazePointLike } from "./types";

test("HitTest: computeExpandedBounds correctly pads rectangle and finds center", () => {
  const rect: SimpleRect = { left: 100, top: 100, right: 300, bottom: 200, width: 200, height: 100 };
  const expanded = computeExpandedBounds(rect, 24);

  assert.equal(expanded.left, 76);
  assert.equal(expanded.top, 76);
  assert.equal(expanded.right, 324);
  assert.equal(expanded.bottom, 224);
  assert.equal(expanded.centerX, 200);
  assert.equal(expanded.centerY, 150);
});

test("HitTest: isPointInsideBounds checks expanded boundary inclusive", () => {
  const rect: SimpleRect = { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 };
  const bounds = computeExpandedBounds(rect, 20); // 80..220

  assert.equal(isPointInsideBounds(150, 150, bounds), true); // Inside
  assert.equal(isPointInsideBounds(85, 100, bounds), true);   // In padding zone
  assert.equal(isPointInsideBounds(70, 150, bounds), false);  // Outside left
  assert.equal(isPointInsideBounds(225, 150, bounds), false); // Outside right
});

test("HitTest: Euclidean distance calculation", () => {
  const dist = computeDistance(0, 0, 3, 4);
  assert.equal(dist, 5);
});

test("HitTest: performHitTest detects target with expanded hit padding", () => {
  const cache = new RectCache();
  cache.setRect("btn1", { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 });

  const targets: GazeTarget[] = [
    { id: "btn1", element: null, onActivate: () => {} },
  ];

  // Point in padding zone (x: 85, y: 150) with default padding 24
  const gazePoint: GazePointLike = {
    x: 0.1,
    y: 0.1,
    xPx: 85,
    yPx: 150,
    confidence: 0.9,
    timestamp: 1000,
    valid: true,
  };

  const result = performHitTest({
    gazePoint,
    targets,
    defaultPadding: 24,
    rectCache: cache,
  });

  assert.ok(result.target);
  assert.equal(result.target.id, "btn1");
  assert.equal(result.isSticky, false);
});

test("HitTest: overlap resolution picks the target with closest center", () => {
  const cache = new RectCache();
  // Two targets with overlapping expanded padding
  cache.setRect("btnA", { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 }); // Center: (150, 150)
  cache.setRect("btnB", { left: 220, top: 100, right: 320, bottom: 200, width: 100, height: 100 }); // Center: (270, 150)

  const targets: GazeTarget[] = [
    { id: "btnA", element: null, onActivate: () => {} },
    { id: "btnB", element: null, onActivate: () => {} },
  ];

  // Point between them at x: 205 (closer to btnA center 150: dist 55, vs btnB center 270: dist 65)
  const gazePoint: GazePointLike = {
    x: 0.2,
    y: 0.15,
    xPx: 205,
    yPx: 150,
    confidence: 0.95,
    timestamp: 1000,
    valid: true,
  };

  const result = performHitTest({
    gazePoint,
    targets,
    defaultPadding: 24,
    rectCache: cache,
  });

  assert.ok(result.target);
  assert.equal(result.target.id, "btnA");
});

test("HitTest: priority overrides proximity", () => {
  const cache = new RectCache();
  cache.setRect("btnNormal", { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 });
  cache.setRect("btnPriority", { left: 110, top: 100, right: 210, bottom: 200, width: 100, height: 100 });

  const targets: GazeTarget[] = [
    { id: "btnNormal", element: null, onActivate: () => {}, priority: 0 },
    { id: "btnPriority", element: null, onActivate: () => {}, priority: 100 },
  ];

  const gazePoint: GazePointLike = {
    x: 0.1,
    y: 0.1,
    xPx: 140, // Closer to btnNormal center (150) than btnPriority center (160)
    yPx: 150,
    confidence: 0.9,
    timestamp: 1000,
    valid: true,
  };

  const result = performHitTest({
    gazePoint,
    targets,
    defaultPadding: 24,
    rectCache: cache,
  });

  assert.ok(result.target);
  assert.equal(result.target.id, "btnPriority");
});

test("HitTest: stickiness retains active target within larger exit margin", () => {
  const cache = new RectCache();
  // Target rect: 100..200 (padding 24 -> 76..224. Sticky margin 40 -> 36..264)
  cache.setRect("btnActive", { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 });

  const targets: GazeTarget[] = [
    { id: "btnActive", element: null, onActivate: () => {} },
  ];

  // Point at x: 240 is OUTSIDE normal padding (max 224), but INSIDE sticky margin (max 264)
  const gazePoint: GazePointLike = {
    x: 0.24,
    y: 0.15,
    xPx: 240,
    yPx: 150,
    confidence: 0.9,
    timestamp: 1000,
    valid: true,
  };

  // Without activeTargetId -> returns null (outside normal bounds)
  const nonStickyResult = performHitTest({
    gazePoint,
    targets,
    defaultPadding: 24,
    rectCache: cache,
  });
  assert.equal(nonStickyResult.target, null);

  // With activeTargetId="btnActive" -> stickiness holds!
  const stickyResult = performHitTest({
    gazePoint,
    targets,
    defaultPadding: 24,
    stickyMargin: 40,
    activeTargetId: "btnActive",
    rectCache: cache,
  });
  assert.ok(stickyResult.target);
  assert.equal(stickyResult.target.id, "btnActive");
  assert.equal(stickyResult.isSticky, true);
});

test("HitTest: returns null for invalid gaze point", () => {
  const cache = new RectCache();
  cache.setRect("btn1", { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 });

  const targets: GazeTarget[] = [
    { id: "btn1", element: null, onActivate: () => {} },
  ];

  const gazePoint: GazePointLike = {
    x: 0.15,
    y: 0.15,
    xPx: 150,
    yPx: 150,
    confidence: 0,
    timestamp: 1000,
    valid: false,
  };

  const result = performHitTest({ gazePoint, targets, rectCache: cache });
  assert.equal(result.target, null);
});
