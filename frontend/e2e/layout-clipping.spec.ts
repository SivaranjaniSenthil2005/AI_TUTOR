import { test, expect } from "@playwright/test";

/**
 * Layout Clipping & Viewport Overflow Test Suite
 *
 * Enforces zero-clipping across all required school laptop and desktop resolutions:
 * 1280x720, 1366x768, 1536x864, 1880x1140, 1920x1080, plus zoom 125% and 150%.
 *
 * Rules:
 * 1. Zero horizontal overflow (scrollWidth <= innerWidth).
 * 2. Zero vertical page scroll (scrollHeight <= innerHeight).
 * 3. No element's bounding rect right edge exceeds viewport width.
 * 4. Pinned Start/Stop Camera button is fully visible inside viewport.
 * 5. Bottom dock controls and Top bar controls are 100% inside viewport bounds.
 * 6. No primary button labels truncated with ellipsis.
 */

const VIEWPORTS = [
  { name: "1280x720 (Standard HD / 150% Zoom on 1080p)", width: 1280, height: 720 },
  { name: "1366x768 (Most common student Chromebook/laptop)", width: 1366, height: 768 },
  { name: "1536x864 (125% Zoom on 1080p)", width: 1536, height: 864 },
  { name: "1880x1140 (User's reported screenshot resolution)", width: 1880, height: 1140 },
  { name: "1920x1080 (Full HD Desktop)", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`Viewport ${vp.name} (${vp.width}x${vp.height}): Zero clipping and zero overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.addInitScript(() => {
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_theme", "bright");
    });

    await page.goto("/");
    await expect(page.locator("#app-root")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#start-camera-btn")).toBeVisible();
    await expect(page.locator("#dock-ask-voice-btn")).toBeVisible();

    // 1. Strict Shell Containment
    const dimensions = await page.evaluate(() => {
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.innerHeight);

    // 2. Element Right Edge Bound Check (Nothing overflows right edge)
    const overflowingElements = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLElement>("header, main, nav, button, [data-gaze-id]"));
      const violations: { id: string; tag: string; right: number; innerWidth: number }[] = [];
      const w = window.innerWidth;

      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Allow 1.5px rounding variance
          if (rect.right > w + 1.5) {
            violations.push({
              id: el.id || el.getAttribute("data-gaze-id") || el.className.slice(0, 30),
              tag: el.tagName,
              right: Math.round(rect.right),
              innerWidth: w,
            });
          }
        }
      }
      return violations;
    });

    expect(overflowingElements).toEqual([]);

    // 3. Start Camera button must be pinned and fully visible inside viewport
    const startCameraBox = await page.locator("#start-camera-btn").boundingBox();
    expect(startCameraBox).not.toBeNull();
    if (startCameraBox) {
      expect(startCameraBox.y + startCameraBox.height).toBeLessThanOrEqual(vp.height);
      expect(startCameraBox.x + startCameraBox.width).toBeLessThanOrEqual(vp.width);
    }

    // 4. Bottom Dock buttons must all be fully visible inside viewport
    const dockIds = [
      "#dock-ask-voice-btn",
      "#dock-type-question-btn",
      "#dock-read-aloud-btn",
      "#dock-explain-mode-btn",
    ];

    for (const dockId of dockIds) {
      const box = await page.locator(dockId).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      }
    }

    // 5. Verify no ellipsis truncation on dock buttons and starter cards
    const truncatedElements = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-gaze-id]"));
      const truncated: string[] = [];
      for (const el of targets) {
        // If an element contains text and scrollWidth > clientWidth with text-overflow ellipsis
        const textContainers = Array.from(el.querySelectorAll<HTMLElement>("div, span, p"));
        for (const tc of textContainers) {
          const style = window.getComputedStyle(tc);
          if (style.textOverflow === "ellipsis" && tc.scrollWidth > tc.clientWidth + 1) {
            truncated.push(el.id || tc.innerText.slice(0, 20));
          }
        }
      }
      return truncated;
    });

    expect(truncatedElements).toEqual([]);
  });
}
