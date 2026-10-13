# Accessibility & Neurodiverse Usability Audit Checklist

**Project:** AI Tutor (Class 10 TN & CBSE / NCERT)  
**Standard:** WCAG 2.1 Level AA Compliance & Neurodiverse Accessibility Guidelines  
**Status:** Audited & Verified (Phase 13)

---

## 1. Automated Audit Summary

| Tool | Scope | Target | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **@axe-core/playwright** | All core views (Onboarding, Ask, Settings, Privacy, /eval) | 0 violations (wcag2a, wcag2aa, wcag21a, wcag21aa) | **0 Violations** | **PASS** |
| **Lighthouse CLI** | Core landing & ask journey (`http://localhost:3000`) | Accessibility score >= 90 | **96 / 100** | **PASS** |
| **Aria Landmarks & Labels** | Interactive buttons, inputs, modals | Unique IDs & aria-labels present | **100% compliant** | **PASS** |

---

## 2. Manual Verification Checklist

### A. Keyboard-Only Navigation
- [x] **Complete Onboarding without Mouse/Gaze:** User can navigate welcome, setup, board selection, and finish using `Tab`, `Shift+Tab`, `Enter`, and `Space`.
- [x] **Ask Question Flow:** Focus lands cleanly in `#typed-question-input`, user types prompt, hits `Enter` or tabs to submit button.
- [x] **Modal Trapping & Escape:** Settings and Privacy modals trap focus when active and cleanly close on `Escape` key press.
- [x] **Visible Focus Indicators:** High-contrast focus rings (`focus:outline-none focus:ring-4 focus:ring-amber-400`) appear clearly on all active buttons and fields.

### B. Screen Reader Support & Streaming Answers
- [x] **Streaming Answer Announcements:** Streaming tutor responses use `aria-live="polite"` and `role="status"` containers, preventing screen reader stutter while keeping assistive users updated on completion.
- [x] **Audio Dwell Cues:** Gaze activations feature subtle audio feedback (`soundEffects.playDwellClick()`) so visually impaired or low-vision learners receive non-visual confirmation.
- [x] **Descriptive Icon Labels:** Purely visual icons are marked with `aria-hidden="true"`, while interactive icon buttons provide explicit `aria-label` tags.

### C. Neurodiverse & Sensory Settings
- [x] **High-Contrast Theme:** Toggleable in Settings (`.high-contrast` CSS class) offering deep black backgrounds (`#050810`), stark borders, and high-visibility amber accents (`#fbbf24`).
- [x] **Large Text Mode:** Toggleable font enlargement (`.large-text` scaling) ensuring readability from 60–80cm webcam distance without layout clipping.
- [x] **Reduced Motion Support:** Respects system `prefers-reduced-motion` and provides manual in-app toggle; disables spinning animations, floating badges, and high-frequency pulsing rings.
- [x] **Adjustable Dwell Times:** Customizable dwell latency (0.8s, 1.2s default, 1.6s) to accommodate varying ocular-motor speed, tremors, or fatigue.
- [x] **Emergency Gaze Pause:** Prominent pause bar with 3-second recovery grace period prevents accidental triggers ("Midas Touch") during cognitive rests.

---

## 3. Protocol for Testing with Neurodiverse Learners & Volunteers

1. **Informed Consent First:** Adult volunteers must review and sign the plain-language consent screen. No facial imagery, camera video, or personal student names are ever saved.
2. **Setup Distance & Ergonomics:** Position laptop screen 50–70cm from face with camera at eye level. Check room lighting to minimize direct glare on eyeglasses.
3. **Run 5-Point Calibration:** Use the built-in calibration screen (`frontend/components/CalibrationScreen.tsx`). Ensure a "Good" rating before commencing tasks.
4. **Gradual Pacing:** Allow learner to practice dwell selection on Task A targets before introducing real curriculum queries.
5. **Post-Session Feedback:** Administer the 10-item System Usability Scale (SUS) questionnaire and record qualitative observations on cognitive fatigue or delight.
