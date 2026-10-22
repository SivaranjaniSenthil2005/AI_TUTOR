import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const ROOT_SCREENSHOTS_DIR = path.resolve(__dirname, "../../docs/screenshots");
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, "../docs/screenshots");

function ensureDirs() {
  if (!fs.existsSync(ROOT_SCREENSHOTS_DIR)) {
    fs.mkdirSync(ROOT_SCREENSHOTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FRONTEND_SCREENSHOTS_DIR)) {
    fs.mkdirSync(FRONTEND_SCREENSHOTS_DIR, { recursive: true });
  }
}

async function saveScreenshot(page: Page, filename: string) {
  ensureDirs();
  const rootPath = path.join(ROOT_SCREENSHOTS_DIR, filename);
  const frontendPath = path.join(FRONTEND_SCREENSHOTS_DIR, filename);

  const buffer = await page.screenshot({ fullPage: false });
  fs.writeFileSync(rootPath, buffer);
  fs.writeFileSync(frontendPath, buffer);
}

test.describe("Visual Regression Screenshots Suite", () => {
  test.beforeAll(() => {
    ensureDirs();
  });

  test("01. Onboarding Screen (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_use_mock", "1");
    });
    await page.goto("/");
    await page.waitForSelector("#onboarding-welcome-next");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "01_onboarding_welcome.png");
  });

  test("02. Empty Ask Screen - 1366x768 Laptop", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "02_empty_ask_1366x768.png");
  });

  test("03. Empty Ask Screen - 1280x720 Laptop HD", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "03_empty_ask_1280x720.png");
  });

  test("04. Empty Ask Screen - 1536x864 HiDPI Laptop", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 864 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "04_empty_ask_1536x864.png");
  });

  test("05. Empty Ask Screen - 1920x1080 Desktop FHD", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "05_empty_ask_1920x1080.png");
  });

  test("05b. Empty Ask Screen - 1880x1140 Desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1880, height: 1140 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "bright");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "05b_empty_ask_1880x1140.png");
  });

  test("06. Empty Ask Screen - Tablet 820x1180", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "06_empty_ask_tablet_820x1180.png");
  });

  test("07. Answer Displayed Screen (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#typed-question-input");

    await page.locator("#typed-question-input").fill("What is photosynthesis?");
    await page.locator("#typed-question-submit-btn").click();
    await page.waitForSelector("#tutor-answer-card", { timeout: 25000 });
    await expect(page.locator("button[id^='read-aloud-']").first()).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(500);

    await saveScreenshot(page, "07_answer_displayed_1366x768.png");
  });

  test("08. Settings Drawer (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#header-settings-btn");
    await page.locator("#header-settings-btn").click();
    await page.waitForSelector("#settings-drawer-dialog");
    await page.waitForTimeout(300);

    await saveScreenshot(page, "08_settings_drawer_1366x768.png");
  });

  test("09. Calibration Screen (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#header-settings-btn");
    await page.locator("#header-settings-btn").click();
    await page.waitForSelector("#settings-recalibrate-btn");
    await page.locator("#settings-recalibrate-btn").click();
    await page.waitForSelector("#calibration-screen-overlay");
    await page.waitForTimeout(400);

    await saveScreenshot(page, "09_calibration_screen_1366x768.png");
  });

  test("10. Theme: Calm Dark (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "calm");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "10_theme_calm_1366x768.png");
  });

  test("11. Theme: High Contrast (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "high-contrast");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");
    await page.waitForTimeout(300);
    await saveScreenshot(page, "11_theme_high_contrast_1366x768.png");
  });

  test("12. Browser Zoom 125% and 150% (1366x768)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_use_mock", "1");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
      window.localStorage.setItem("ai_tutor_theme", "light");
    });
    await page.goto("/");
    await page.waitForSelector("#starter-q-0");

    // Zoom 125%
    await page.evaluate(() => {
      (document.body.style as unknown as Record<string, string>).zoom = "1.25";
    });
    await page.waitForTimeout(300);
    await saveScreenshot(page, "12_zoom_125_1366x768.png");

    // Zoom 150%
    await page.evaluate(() => {
      (document.body.style as unknown as Record<string, string>).zoom = "1.5";
    });
    await page.waitForTimeout(300);
    await saveScreenshot(page, "13_zoom_150_1366x768.png");
  });
});
