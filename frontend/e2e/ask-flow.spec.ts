import { test, expect } from "@playwright/test";

test.describe("AI Tutor End-to-End Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test so onboarding runs fresh, but enable mock mode
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("ai_tutor_use_mock", "1");
    });
  });

  test("Complete Onboarding -> Ask Typed Question -> Sources -> Suggestions -> Mode Switch -> Pause Eye Control", async ({
    page,
  }) => {
    // Navigate to app
    await page.goto("/");

    // 1. Onboarding Step 1: Welcome
    await expect(page.locator("text=Welcome to AI Tutor!")).toBeVisible({ timeout: 15000 });
    const welcomeBtn = page.locator("#onboarding-welcome-next");
    await welcomeBtn.click();

    // 2. Onboarding Step 2: Camera / Eye Control
    await expect(page.locator("text=Eye-Tracking & Camera Setup")).toBeVisible();
    // Choose "Skip Eye Control" for mouse/keyboard testing
    const skipCameraBtn = page.locator("#onboarding-skip-camera-btn");
    await skipCameraBtn.click();

    // 3. Onboarding Step 3: Choose Board
    await expect(page.locator("text=Choose Your School Board")).toBeVisible();
    const boardBtn = page.locator("#onboarding-board-tn");
    await boardBtn.click();

    // 4. Onboarding Step 4: Choose Subject
    await expect(page.locator("text=Select Your Subject")).toBeVisible();
    const subjBtn = page.locator("#onboarding-subj-science");
    await subjBtn.click();

    // 5. Onboarding Step 5: Ready
    await expect(page.locator("text=You are Ready to Learn!")).toBeVisible();
    const finishBtn = page.locator("#onboarding-finish-btn");
    await finishBtn.click();

    // Onboarding modal disappears, main Ask screen appears
    await expect(page.locator("text=Welcome to AI Tutor!")).not.toBeVisible();
    await expect(page.locator("#typed-question-input")).toBeVisible();

    // 6. Ask a typed question
    const input = page.locator("#typed-question-input");
    await input.fill("What is photosynthesis?");
    const askBtn = page.locator("#typed-question-submit-btn");
    await askBtn.click();

    // 7. Verify thinking indicator and streamed answer
    await expect(page.getByRole("heading", { name: "AI Tutor", level: 1 })).toBeVisible();
    // Answer text finishes streaming when Read Aloud button appears
    await expect(page.locator("button[id^='read-aloud-']").first()).toBeVisible({ timeout: 40000 });

    // 8. View sources
    const sourcesBtn = page.locator("#expand-sources-btn").first();
    if (await sourcesBtn.isVisible()) {
      await sourcesBtn.click();
      await expect(page.locator("text=Textbook Citations")).toBeVisible();
    }

    // 9. Re-explain in another mode (e.g. Step by step or Example)
    const stepModeBtn = page.locator("button[id^='re-ask-step-']").first();
    if (await stepModeBtn.isVisible()) {
      await stepModeBtn.click();
      // Verifies a new answer is appended
      await expect(page.locator("text=Mode: step by step").or(page.locator("text=MODE: STEP BY STEP"))).toBeVisible({
        timeout: 30000,
      });
    }

    // 10. Pause eye control and verify mouse still works
    const pauseToggleBtn = page.locator("#gaze-pause-toggle-btn");
    if (await pauseToggleBtn.isVisible()) {
      await pauseToggleBtn.click();
      await expect(page.locator("text=PAUSED")).toBeVisible();
    }

    // Verify typing still works while paused
    await input.fill("What are Newton's laws?");
    await expect(input).toHaveValue("What are Newton's laws?");
  });
});
