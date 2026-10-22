# AI Tutor Design System & Stability Architecture

> Accessible, calm, neurodiverse-adapted design system for school learners, engineered for rock-solid eye-gaze and voice navigation.

---

## 1. Gaze Stability Rules ("Gaze Targets Never Move")

In eye-tracking user interfaces, **target stability is the single most critical engineering requirement**. If a button shifts by even a few pixels when a student fixates on it, the calibration offset drifts, triggering eye fatigue or accidental "Midas Touch" activations.

All future contributors must follow these strict rules:

1. **Zero Transform on Interaction:**
   - **NEVER** use `transform: scale(...)` or `transform: translate(...)` on hover, focus, dwell, active, or click states.
   - Scale animations on buttons make the physical bounding box change under the gaze point, corrupting hit tests.
2. **Reserve Border Space Always:**
   - Use `box-sizing: border-box`.
   - Never change `border-width` or `padding` on state transitions. Reserve the full border thickness (e.g. 4px) in the default idle state.
3. **Show State Changes Visually Without Layout Shifts:**
   - Dwell progress is shown via an **inner SVG ring** or a **bottom progress bar inside the button box**.
   - Activation is communicated via a brief background color flash and sound chime—never a dimensional bounce.
4. **Stable React Mounting & Keys:**
   - Gaze targets must maintain stable React keys.
   - Never conditionally unmount/remount a target while the gaze is fixated on it.
   - When a target is unavailable, **disable it visually** (`disabled`, muted opacity) rather than unmounting it.
5. **No Page-Level Scrolling:**
   - The application root shell is constrained to `height: 100dvh; overflow: hidden;`.
   - Only designated inner content containers scroll (e.g. conversation messages and drawer content) using `overscroll-behavior: contain` and `scrollbar-gutter: stable`.
6. **Rect Cache Freezing:**
   - Target rects are cached to prevent layout thrashing.
   - When a target is active and dwelling, its cached bounding box is **strictly frozen** until the dwell sequence completes or resets.
7. **Explicit Scroll Buttons:**
   - Scrolling is controlled through explicit, large docked "Scroll Up" and "Scroll Down" gaze buttons beside the chat area.

---

## 2. Core Design Tokens

### Color Palette

| Token | Calm (Default) | Light Theme | High Contrast | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--bg-app` | `#070b14` (Deep Navy) | `#f8fafc` (Soft Off-White) | `#000000` (Pure Black) | Main viewport backdrop |
| `--bg-surface` | `#0d1527` (Midnight) | `#ffffff` | `#000000` | Header, Bottom dock |
| `--bg-card` | `#0b1120` (Dark Card) | `#ffffff` | `#000000` | Answer cards, dialogs |
| `--accent-primary` | `#fbbf24` (Amber 400) | `#f59e0b` (Amber 500) | `#facc15` (Bright Yellow) | Primary gaze action |
| `--teal-success` | `#10b981` (Emerald 500) | `#059669` | `#34d399` | Ready / Tracking status |
| `--coral-warning` | `#fb7185` (Rose 400) | `#e11d48` | `#fda4af` | Caution / Low FPS |
| `--text-primary` | `#f8fafc` | `#0f172a` | `#ffffff` | Headings and answers |
| `--text-secondary`| `#94a3b8` | `#334155` | `#fef08a` | Subtitles and chips |

### Spacing Scale (8px Grid)

- `space-1`: 4px (micro spacing)
- `space-2`: 8px (base gap)
- `space-3`: 12px (pill padding)
- `space-4`: 16px (card inner padding)
- `space-5`: 20px
- `space-6`: 24px (enforced minimum gap between neighboring gaze targets)
- `space-8`: 32px

### Border Radii

- Buttons & Cards: `20px` (`rounded-[20px]`)
- Status Pills & Badges: `12px` / `9999px` (Full pill)
- Large Modals: `24px`

### Typography Scale

- **Default Font:** `Lexend` (Google Font via `next/font/google`), engineered specifically to reduce visual stress and reading fatigue.
- **Alternative Fonts:** `Atkinson Hyperlegible` (Braille Institute) and `OpenDyslexic` (bundled locally with SIL Open Font License in `/fonts/`).
- **Answer Text:** Base `22px - 24px`, line-height `1.6`, maximum line length `~65ch`.
- **Button Labels:** `16px - 20px`, font weight `800 - 900`.
- **Labels / Tags:** `12px - 14px`, uppercase tracking `0.05em`.

### Motion & Transitions

- Durations: `150ms - 200ms` only.
- Transitions: Color, opacity, and box-shadow only.
- Respects `prefers-reduced-motion` and the in-app `reducedMotion` setting by disabling animations instantly.

---

## 3. Component Architecture

All UI components reside in `frontend/components/ui/`:

- `GazeButton.tsx`: Accessible gaze button with inner progress ring or bottom bar, zero-scale flash feedback, and `data-gaze-id`.
- `Button.tsx`: Keyboard and mouse accessible standard button.
- `IconButton.tsx`: Clean icon button with accessible text labels.
- `Card.tsx`: Calm surface container with reserved min-heights.
- `Chip.tsx`: Colored status and mode badges.
- `StatusPill.tsx`: Fixed-size (148px) top bar pills for server, camera, eyes, and mic.
- `SegmentedControl.tsx`: Large multi-option radio controls.
- `Stepper.tsx`: Big minus/plus steppers for motor-accessible adjustment.
- `Drawer.tsx`: Right-side slide-over drawer for settings.
- `Toast.tsx`: Non-layout-shifting floating notification overlay.
- `ProgressRing.tsx`: SVG circular progress indicator.
- `EmptyState.tsx`: Greeting state with syllabus-grounded starter questions.
- `Skeleton.tsx`: Reserved-space skeleton loaders for streaming responses.

Screen-level components reside in `frontend/components/screens/`:
- `TopBar.tsx`: Slim 64px header.
- `BottomDock.tsx`: Fixed 112px bottom control bar with 4 primary gaze targets.
- `ConversationArea.tsx`: Scrollable conversation feed with docked explicit scroll buttons.
- `AnswerCard.tsx`: Formatted tutor answer card with numbered steps and source citations.
- `SettingsDrawer.tsx`: Multi-tab drawer for Eye Control, Voice, Reading, Display, and Privacy.
- `TypeQuestionModal.tsx`: Keyboard question input.
- `ExplainModeModal.tsx`: Neurodiverse learning mode chooser.
- `BoardSubjectModal.tsx`: Educational board and subject switcher.
