import { test, expect, Page } from "@playwright/test";

/**
 * AI Tutor Layout Stability Test Suite
 *
 * Enforces zero-layout-shift gaze requirements:
 * 1. Bounding boxes of [data-gaze-id] targets change by < 1px across all key state changes.
 * 2. Strict 100dvh shell: document.documentElement.scrollHeight <= window.innerHeight (zero page scroll).
 * 3. Zero horizontal scrollbar/overflow: document.documentElement.scrollWidth <= window.innerWidth.
 * 4. Cumulative Layout Shift (CLS) < 0.02 across interactive flows.
 */

interface TargetBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getGazeTargetBoxes(page: Page): Promise<Record<string, TargetBox>> {
  return await page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-gaze-id]"));
    const map: Record<string, TargetBox> = {};
    for (const el of targets) {
      const id = el.getAttribute("data-gaze-id") || el.id;
      if (!id) continue;
      const rect = el.getBoundingClientRect();
      // Only record visible elements
      if (rect.width > 0 && rect.height > 0) {
        map[id] = {
          id,
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        };
      }
    }
    return map;
  });
}

function assertStableBoxes(
  before: Record<string, TargetBox>,
  after: Record<string, TargetBox>,
  options: { allowedDifference?: number; targetIds?: string[] } = {}
) {
  const tolerance = options.allowedDifference ?? 1.0;
  const idsToCheck = options.targetIds ?? Object.keys(before).filter((id) => id in after);

  for (const id of idsToCheck) {
    const b = before[id];
    const a = after[id];
    if (!b || !a) continue;

    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const dw = Math.abs(a.width - b.width);
    const dh = Math.abs(a.height - b.height);

    expect(
      dx,
      `Target "${id}" shifted horizontally by ${dx}px (allowed <= ${tolerance}px)`
    ).toBeLessThanOrEqual(tolerance);

    expect(
      dy,
      `Target "${id}" shifted vertically by ${dy}px (allowed <= ${tolerance}px)`
    ).toBeLessThanOrEqual(tolerance);

    expect(
      dw,
      `Target "${id}" width changed by ${dw}px (allowed <= ${tolerance}px)`
    ).toBeLessThanOrEqual(tolerance);

    expect(
      dh,
      `Target "${id}" height changed by ${dh}px (allowed <= ${tolerance}px)`
    ).toBeLessThanOrEqual(tolerance);
  }
}

test.describe("Layout Stability & Zero Gaze Target Movement", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
    });
  });

  test("1. App Shell Constraints: Strictly 100dvh, zero page-level scroll, zero horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#dock-ask-voice-btn")).toBeVisible({ timeout: 15000 });

    const scrollMetrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      return {
        windowHeight: window.innerHeight,
        windowWidth: window.innerWidth,
        docScrollHeight: doc.scrollHeight,
        docScrollWidth: doc.scrollWidth,
        bodyScrollHeight: body.scrollHeight,
        bodyScrollWidth: body.scrollWidth,
        hasVerticalScrollbar: doc.scrollHeight > window.innerHeight,
        hasHorizontalScrollbar: doc.scrollWidth > window.innerWidth,
      };
    });

    expect(
      scrollMetrics.docScrollHeight,
      `Root document scrollHeight (${scrollMetrics.docScrollHeight}) must be <= windowHeight (${scrollMetrics.windowHeight})`
    ).toBeLessThanOrEqual(scrollMetrics.windowHeight);

    expect(
      scrollMetrics.docScrollWidth,
      `Root document scrollWidth (${scrollMetrics.docScrollWidth}) must be <= windowWidth (${scrollMetrics.windowWidth})`
    ).toBeLessThanOrEqual(scrollMetrics.windowWidth);

    expect(scrollMetrics.hasVerticalScrollbar).toBe(false);
    expect(scrollMetrics.hasHorizontalScrollbar).toBe(false);
  });

  test("2. Camera Start/Stop: Gaze targets do not shift by > 1px", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#dock-ask-voice-btn")).toBeVisible({ timeout: 15000 });

    const startCameraBtn = page.locator("#start-camera-btn");
    await expect(startCameraBtn).toBeVisible();

    const beforeStart = await getGazeTargetBoxes(page);

    // Click Start Camera
    await startCameraBtn.click();
    await expect(page.locator("#stop-camera-btn")).toBeVisible({ timeout: 10000 });

    const afterStart = await getGazeTargetBoxes(page);

    // Verify dock targets and header targets didn't move
    assertStableBoxes(beforeStart, afterStart, {
      targetIds: [
        "dock-ask-voice-btn",
        "dock-type-question-btn",
        "dock-read-aloud-btn",
        "dock-explain-mode-btn",
        "gaze-pause-toggle-btn",
        "header-settings-btn",
        "header-privacy-btn",
      ],
    });

    // Click Stop Camera
    await page.locator("#stop-camera-btn").click();
    await expect(page.locator("#start-camera-btn")).toBeVisible({ timeout: 10000 });

    const afterStop = await getGazeTargetBoxes(page);
    assertStableBoxes(beforeStart, afterStop, {
      targetIds: [
        "dock-ask-voice-btn",
        "dock-type-question-btn",
        "dock-read-aloud-btn",
        "dock-explain-mode-btn",
        "gaze-pause-toggle-btn",
        "header-settings-btn",
        "header-privacy-btn",
      ],
    });
  });

  test("3. Settings Drawer Open & Close: Main workspace targets behind drawer do NOT shift", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#header-settings-btn")).toBeVisible({ timeout: 15000 });

    const beforeOpen = await getGazeTargetBoxes(page);

    // Open Settings Drawer
    await page.locator("#header-settings-btn").click();
    await expect(page.locator("#settings-drawer-dialog")).toBeVisible();

    // Verify main dock buttons didn't move behind drawer
    const whileOpen = await getGazeTargetBoxes(page);
    assertStableBoxes(beforeOpen, whileOpen, {
      targetIds: [
        "dock-ask-voice-btn",
        "dock-type-question-btn",
        "dock-read-aloud-btn",
        "dock-explain-mode-btn",
        "gaze-pause-toggle-btn",
      ],
    });

    // Close Settings Drawer
    await page.locator("#close-settings-btn").click();
    await expect(page.locator("#settings-drawer-dialog")).not.toBeVisible();

    const afterClose = await getGazeTargetBoxes(page);
    assertStableBoxes(beforeOpen, afterClose);
  });

  test("4. Focus Mode Toggle: Retained targets (Dock, TopBar) stay in identical coordinates", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#dock-ask-voice-btn")).toBeVisible({ timeout: 15000 });

    const beforeFocus = await getGazeTargetBoxes(page);

    // Open settings and enable Focus Mode
    await page.locator("#header-settings-btn").click();
    await page.locator("button:has-text('Display')").click();
    await page.locator("#settings-focus-mode-toggle").click();
    await page.locator("#close-settings-btn").click();

    const afterFocus = await getGazeTargetBoxes(page);

    // Dock buttons and top bar buttons must not have shifted by more than 1px
    assertStableBoxes(beforeFocus, afterFocus, {
      targetIds: [
        "dock-ask-voice-btn",
        "dock-type-question-btn",
        "dock-read-aloud-btn",
        "dock-explain-mode-btn",
        "gaze-pause-toggle-btn",
        "header-settings-btn",
      ],
    });
  });

  test("5. Question Answer Streaming & Completion: Dock and Header stay rock-solid", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#typed-question-input")).toBeVisible({ timeout: 15000 });

    const beforeAsk = await getGazeTargetBoxes(page);

    await page.locator("#typed-question-input").fill("What is photosynthesis?");
    await page.locator("#typed-question-submit-btn").click();

    // Check during answer appearance / stream
    await expect(page.locator("button[id^='read-aloud-']").first()).toBeVisible({ timeout: 20000 });

    const afterAnswer = await getGazeTargetBoxes(page);

    assertStableBoxes(beforeAsk, afterAnswer, {
      targetIds: [
        "dock-ask-voice-btn",
        "dock-type-question-btn",
        "dock-read-aloud-btn",
        "dock-explain-mode-btn",
        "gaze-pause-toggle-btn",
        "header-settings-btn",
      ],
    });
  });

  test("6. Calibration Screen Entrance & Exit: Seamless overlay, exact target restoration", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await expect(page.locator("#header-settings-btn")).toBeVisible({ timeout: 15000 });

    const beforeCalib = await getGazeTargetBoxes(page);

    // Open calibration via Settings -> Eyes -> Recalibrate
    await page.locator("#header-settings-btn").click();
    await page.locator("#settings-recalibrate-btn").click();

    // Verify calibration screen is open and fullscreen overlay is present
    await expect(page.locator("#calibration-screen-overlay")).toBeVisible();

    // Cancel calibration with Cancel button
    await page.locator("#calibration-cancel-btn").click();
    await expect(page.locator("#calibration-screen-overlay")).not.toBeVisible();

    const afterCalib = await getGazeTargetBoxes(page);
    assertStableBoxes(beforeCalib, afterCalib);
  });

  test("7. Cumulative Layout Shift (CLS) is strictly < 0.02 during full user interaction", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });

    // Inject PerformanceObserver before page scripts run
    await page.addInitScript(() => {
      (window as unknown as { __clsScore: number }).__clsScore = 0;
      try {
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as unknown as { hadRecentInput?: boolean }).hadRecentInput) {
              (window as unknown as { __clsScore: number }).__clsScore += (
                entry as unknown as { value: number }
              ).value;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      } catch {}
    });

    await page.goto("/");
    await expect(page.locator("#typed-question-input")).toBeVisible({ timeout: 15000 });

    // Perform interactions: ask question, switch mode, open drawer
    await page.locator("#typed-question-input").fill("Explain acids and bases");
    await page.locator("#typed-question-submit-btn").click();
    await expect(page.locator("button[id^='read-aloud-']").first()).toBeVisible({ timeout: 20000 });

    // Toggle pause
    await page.locator("#gaze-pause-toggle-btn").click();
    await page.locator("#gaze-pause-toggle-btn").click();

    // Read CLS
    const measuredCls = await page.evaluate(() => {
      return (window as unknown as { __clsScore: number }).__clsScore || 0;
    });

    expect(measuredCls, `Cumulative Layout Shift (${measuredCls}) must be strictly < 0.02`).toBeLessThan(0.02);
  });
});
