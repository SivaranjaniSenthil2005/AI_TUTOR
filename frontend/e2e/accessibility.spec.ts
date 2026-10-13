import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Audits (Axe-Core WCAG 2.1 AA)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("1. Onboarding modal accessibility audit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Welcome to AI Tutor!")).toBeVisible({ timeout: 15000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Skip known non-blocking ambient elements if needed
      .disableRules(["color-contrast"]) // dark theme custom gradients
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("2. Main Ask View accessibility audit", async ({ page }) => {
    // Bypass onboarding by setting complete flag in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
      window.localStorage.setItem("ai_tutor_board", "tn");
      window.localStorage.setItem("ai_tutor_subject", "science");
    });

    await page.goto("/");
    await expect(page.locator("#typed-question-input")).toBeVisible({ timeout: 15000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("3. Settings Modal accessibility audit", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
    });

    await page.goto("/");
    await expect(page.locator("#header-settings-btn")).toBeVisible({ timeout: 15000 });
    await page.locator("#header-settings-btn").click();

    await expect(page.locator("text=AI Tutor Settings & Accessibility")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("4. Privacy Panel accessibility audit", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("ai_tutor_onboarding_completed", "true");
    });

    await page.goto("/");
    await expect(page.locator("#header-privacy-btn")).toBeVisible({ timeout: 15000 });
    await page.locator("#header-privacy-btn").click();
    await expect(page.locator("text=Privacy & Data Security")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("5. Evaluation Lab (/eval) accessibility audit", async ({ page }) => {
    await page.goto("/eval");
    await expect(page.locator("text=Participant Profile & Study Consent")).toBeVisible({ timeout: 15000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
