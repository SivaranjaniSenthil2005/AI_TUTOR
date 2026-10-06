import { test } from "node:test";
import assert from "node:assert/strict";
import { DwellStateMachine } from "./dwell";
import type { GazeTarget } from "./types";

test("DwellStateMachine: normal dwell transitions idle -> dwelling -> activated -> cooldown", () => {
  let activated = false;
  let dwellStarted = false;

  const target: GazeTarget = {
    id: "button1",
    element: null,
    onActivate: () => {
      activated = true;
    },
    dwellMs: 1000,
  };

  const machine = new DwellStateMachine({
    defaultDwellMs: 1000,
    cooldownMs: 800,
    onDwellStart: () => {
      dwellStarted = true;
    },
  });

  // Step 1: Initial state
  assert.equal(machine.getSnapshot().state, "idle");
  assert.equal(machine.getSnapshot().progress, 0);

  // Step 2: Start dwelling at t = 1000
  let snap = machine.update(target, true, 1000);
  assert.equal(snap.state, "dwelling");
  assert.equal(snap.targetId, "button1");
  assert.equal(dwellStarted, true);
  assert.equal(snap.progress, 0);

  // Step 3: Advance 500ms (t = 1500) -> progress ~0.5
  snap = machine.update(target, true, 1500);
  assert.equal(snap.state, "dwelling");
  assert.ok(Math.abs(snap.progress - 0.5) < 0.01, `Progress was ${snap.progress}`);
  assert.equal(activated, false);

  // Step 4: Advance another 500ms (t = 2000) -> reaches 1.0, activates!
  snap = machine.update(target, true, 2000);
  assert.equal(activated, true);
  assert.equal(snap.state, "cooldown");
  assert.equal(snap.targetId, "button1");
  assert.ok(snap.cooldownRemainingMs > 0);
});

test("DwellStateMachine: cooldown prevents immediate re-fire and requires exit to rearm", () => {
  let activations = 0;
  const target: GazeTarget = {
    id: "btnRepeat",
    element: null,
    onActivate: () => {
      activations++;
    },
    dwellMs: 500,
  };

  const machine = new DwellStateMachine({
    defaultDwellMs: 500,
    cooldownMs: 600,
  });

  // Dwell 0 to 500ms -> activates once
  machine.update(target, true, 1000);
  machine.update(target, true, 1500);
  assert.equal(activations, 1);

  // User stays on target during cooldown (t = 1800, 2100) -> should NOT re-fire
  machine.update(target, true, 1800);
  machine.update(target, true, 2200); // Cooldown elapsed (700ms > 600ms) but user never left target!
  machine.update(target, true, 2500);
  assert.equal(activations, 1, "Should not re-fire while user remains on the same target");

  // User looks away (t = 2600)
  machine.update(null, false, 2600);

  // User returns to target (t = 2700) -> now re-armed!
  machine.update(target, true, 2700);
  machine.update(target, true, 3200); // 500ms dwell completed
  assert.equal(activations, 2, "Should re-fire after user glances away and re-dwells");
});

test("DwellStateMachine: brief glance away or blink within grace period pauses progress", () => {
  const target: GazeTarget = {
    id: "btnGrace",
    element: null,
    onActivate: () => {},
    dwellMs: 1000,
  };

  const machine = new DwellStateMachine({
    defaultDwellMs: 1000,
    gracePeriodMs: 250,
  });

  // Dwell to 60% progress (600ms)
  machine.update(target, true, 1000);
  machine.update(target, true, 1600);
  const progressBeforeGrace = machine.getSnapshot().progress;
  assert.ok(Math.abs(progressBeforeGrace - 0.6) < 0.01);

  // Blink / gaze lost for 150ms (inside 250ms grace period) at t = 1750
  const snapGrace = machine.update(null, false, 1750);
  assert.equal(snapGrace.isGracePeriod, true);
  assert.equal(snapGrace.progress, progressBeforeGrace, "Progress must be paused, not reset");

  // Gaze returns at t = 1800
  const snapResumed = machine.update(target, true, 1800);
  assert.equal(snapResumed.isGracePeriod, false);
  assert.ok(snapResumed.progress >= progressBeforeGrace, "Dwell resumes from saved progress");
});

test("DwellStateMachine: gaze lost beyond grace period decays progress smoothly to 0", () => {
  const target: GazeTarget = {
    id: "btnDecay",
    element: null,
    onActivate: () => {},
    dwellMs: 1000,
  };

  const machine = new DwellStateMachine({
    defaultDwellMs: 1000,
    gracePeriodMs: 200,
    decayRatePerMs: 0.005, // 5% per 10ms
  });

  // Dwell to 50%
  machine.update(target, true, 1000);
  machine.update(target, true, 1500);
  assert.ok(Math.abs(machine.getSnapshot().progress - 0.5) < 0.01);

  // Gaze lost: 100ms later (t = 1600) -> inside grace (200ms), still 0.5
  let snap = machine.update(null, false, 1600);
  assert.equal(snap.progress, 0.5);

  // Gaze lost: 300ms later (t = 1900) -> grace expired (300 - 200 = 100ms decay)
  snap = machine.update(null, false, 1900);
  assert.ok(snap.progress < 0.5, "Progress should decay");

  // Gaze lost: 1000ms later (t = 2900) -> progress fully decayed to 0 and state resets to idle
  snap = machine.update(null, false, 2900);
  assert.equal(snap.progress, 0);
  assert.equal(snap.state, "idle");
});

test("DwellStateMachine: switching between targets resets progress to new target", () => {
  const targetA: GazeTarget = { id: "A", element: null, onActivate: () => {}, dwellMs: 1000 };
  const targetB: GazeTarget = { id: "B", element: null, onActivate: () => {}, dwellMs: 1000 };

  const machine = new DwellStateMachine({ defaultDwellMs: 1000 });

  // Dwell on A for 400ms
  machine.update(targetA, true, 1000);
  machine.update(targetA, true, 1400);
  assert.equal(machine.getSnapshot().targetId, "A");

  // Switch gaze directly to B at t = 1450
  const snapB = machine.update(targetB, true, 1450);
  assert.equal(snapB.targetId, "B");
  assert.equal(snapB.state, "dwelling");
  assert.equal(snapB.progress, 0, "Progress should reset to 0 for the newly entered target");
});
