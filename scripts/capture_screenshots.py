"""
AI Tutor - Automated Screenshot Capture Tool
Captures high-resolution UI screenshots of all key interface views for documentation.
"""

import os
import sys
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(ROOT_DIR, "docs", "screenshots")


def capture_screenshots():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    print(f"\n=======================================================")
    print(f" AI Tutor - Screenshot Capture Runner")
    print(f"=======================================================")
    print(f"Target Directory: {SCREENSHOTS_DIR}")

    capture_script = f"""
import {{ chromium }} from 'playwright';
import path from 'path';

(async () => {{
  const browser = await chromium.launch({{
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  }});
  const context = await browser.newContext({{
    viewport: {{ width: 1440, height: 900 }},
    permissions: ['camera', 'microphone']
  }});
  const page = await context.newPage();

  // 1. Onboarding
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  await page.screenshot({{ path: '{SCREENSHOTS_DIR.replace("\\", "/")}/01_onboarding.png' }});
  console.log('[OK] Captured 01_onboarding.png');

  // 2. Main Workspace
  await page.addInitScript(() => {{
    window.localStorage.setItem('ai_tutor_onboarding_completed', 'true');
    window.localStorage.setItem('ai_tutor_use_mock', '1');
    window.localStorage.setItem('ai_tutor_board', 'tn');
    window.localStorage.setItem('ai_tutor_subject', 'science');
  }});
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  await page.screenshot({{ path: '{SCREENSHOTS_DIR.replace("\\", "/")}/02_main_workspace.png' }});
  console.log('[OK] Captured 02_main_workspace.png');

  // 3. Settings Modal
  await page.locator('#header-settings-btn').click();
  await page.waitForTimeout(1000);
  await page.screenshot({{ path: '{SCREENSHOTS_DIR.replace("\\", "/")}/03_settings_modal.png' }});
  console.log('[OK] Captured 03_settings_modal.png');
  await page.locator('#close-settings-btn').click();

  // 4. Privacy Modal
  await page.locator('#header-privacy-btn').click();
  await page.waitForTimeout(1000);
  await page.screenshot({{ path: '{SCREENSHOTS_DIR.replace("\\", "/")}/04_privacy_panel.png' }});
  console.log('[OK] Captured 04_privacy_panel.png');

  // 5. Evaluation Lab
  await page.goto('http://localhost:3000/eval');
  await page.waitForTimeout(1500);
  await page.screenshot({{ path: '{SCREENSHOTS_DIR.replace("\\", "/")}/05_eval_lab.png' }});
  console.log('[OK] Captured 05_eval_lab.png');

  await browser.close();
}})();
"""

    temp_js = os.path.join(ROOT_DIR, "frontend", "capture_temp.mjs")
    with open(temp_js, "w", encoding="utf-8") as f:
        f.write(capture_script)

    try:
        subprocess.run(["node", "capture_temp.mjs"], cwd=os.path.join(ROOT_DIR, "frontend"), check=True)
    finally:
        if os.path.exists(temp_js):
            os.remove(temp_js)

    print("\n[OK] All screenshots captured successfully.\n")


if __name__ == "__main__":
    capture_screenshots()
