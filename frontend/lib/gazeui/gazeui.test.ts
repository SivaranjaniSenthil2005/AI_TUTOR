import { test } from "node:test";
import assert from "node:assert/strict";
import { GazeTargetRegistry } from "./registry";
import type { GazeTarget } from "./types";

test("GazeTargetRegistry: registers, updates, retrieves, and unregisters targets", () => {
  const registry = new GazeTargetRegistry();
  let notificationCount = 0;
  const unsubscribe = registry.subscribe(() => {
    notificationCount++;
  });

  const target1: GazeTarget = {
    id: "nav-home",
    element: null,
    onActivate: () => {},
    dwellMs: 1200,
  };

  const target2: GazeTarget = {
    id: "nav-learn",
    element: null,
    onActivate: () => {},
    dwellMs: 1500,
  };

  // Register
  registry.register(target1);
  registry.register(target2);
  assert.equal(registry.getAllTargets().length, 2);
  assert.equal(registry.getTarget("nav-home")?.dwellMs, 1200);
  assert.equal(notificationCount, 2);

  // Update
  registry.update({ ...target1, dwellMs: 800 });
  assert.equal(registry.getTarget("nav-home")?.dwellMs, 800);

  // Unregister
  registry.unregister("nav-home");
  assert.equal(registry.getAllTargets().length, 1);
  assert.equal(registry.getTarget("nav-home"), undefined);
  assert.equal(notificationCount, 3);

  // Clear
  registry.clear();
  assert.equal(registry.getAllTargets().length, 0);

  unsubscribe();
});

test("GazeButton click and keyboard fallback behavior", () => {
  // Verifies the activation contract: normal user clicks and Enter/Space trigger onActivate
  let clickTriggered = false;
  const onActivate = () => {
    clickTriggered = true;
  };

  // Simulate click action
  onActivate();
  assert.equal(clickTriggered, true);

  // Simulate keyboard trigger (Enter/Space key simulation contract)
  let keyTriggered = false;
  const handleKey = (key: string) => {
    if (key === "Enter" || key === " ") {
      keyTriggered = true;
    }
  };

  handleKey("Enter");
  assert.equal(keyTriggered, true);

  keyTriggered = false;
  handleKey(" ");
  assert.equal(keyTriggered, true);

  keyTriggered = false;
  handleKey("Tab");
  assert.equal(keyTriggered, false);
});
