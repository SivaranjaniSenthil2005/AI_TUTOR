# AI Tutor Design System & Accessible Learning Platform Architecture

> Modern, bright, neurodiverse-adapted design system for school learners, engineered for rock-solid eye-gaze control and voice navigation.

---

## 1. Core Principles & Mood

The AI Tutor UI is designed to feel:
- **Inviting & Calm:** Clean, airy layouts, soft shadows, rounded surfaces, gentle whitespace, and low visual clutter for neurodiverse school learners.
- **Predictable & Stable:** Gaze targets never move, shift, or resize during any interaction or state change. The entire application runs within a strictly constrained `100dvh` shell with zero page-level scrolling.
- **Motivating & Friendly:** Features the original **"Tutor Buddy"** SVG mascot with 4 dynamic expressions (idle, listening, thinking, speaking) that respond to student learning moments.

---

## 2. Design Tokens

### Theme 1: "Bright" (Default Light Theme)
- **Background (`--bg-app`):** `#F6F8FF` (soft, airy blue-white canvas)
- **Card Surface (`--bg-surface`):** `#FFFFFF` (clean white)
- **Secondary Surface (`--bg-surface-2`):** `#EEF2FF` (tinted soft indigo)
- **Card Border (`--border-subtle`):** `#DDE3F5` (1px soft border)
- **Card Shadow (`--shadow-card`):** `0 8px 24px rgba(79, 70, 229, 0.08)`
- **Text Primary (`--text-primary`):** `#1B2340` (deep navy ink, passes WCAG AAA on white)
- **Text Muted (`--text-muted`):** `#5A6485` (calm slate blue, passes WCAG AA 4.6:1)
- **Text on Primary (`--text-on-primary`):** `#FFFFFF`
- **Primary Brand Indigo (`--primary`):** `#4F46E5` (Hover: `#4338CA`, Soft: `#E0E7FF`)
- **Secondary Violet (`--secondary-violet`):** `#7C3AED` (Soft: `#EDE9FE`)
- **Accent Teal (`--accent-teal`):** `#0D9488` (Soft: `#CCFBF1`)
- **Sky (`--sky`):** `#0284C7` (Soft: `#E0F2FE`)
- **Success (`--success`):** `#15803D` (Soft: `#DCFCE7`)
- **Warning (`--warning`):** `#B45309` (Soft: `#FEF3C7`)
- **Error (`--error`):** `#BE123C` (Soft: `#FFE4E6`)
- **Focus Ring (`--focus-ring`):** `#1D4ED8` (3px with 2px white offset)
- **Dwell Progress Ring (`--dwell-ring`):** `#F59E0B` *(The ONLY place amber is used as a strong color, plus small warning accents)*
- **Brand Gradient:** `linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)` (used on logo mark, greeting banner, and primary gaze buttons)

### Theme 2: "Calm Night" (Dark Option)
- **Background (`--bg-app`):** `#0F1226`
- **Card Surface (`--bg-surface`):** `#181C3A`
- **Secondary Surface (`--bg-surface-2`):** `#20254A`
- **Border (`--border-subtle`):** `#2E345F`
- **Text Primary (`--text-primary`):** `#EEF1FF`
- **Text Muted (`--text-muted`):** `#A9B0D6`
- **Primary (`--primary`):** `#818CF8` (Text on Primary: `#0B1030`)
- **Teal:** `#2DD4BF` | **Violet:** `#A78BFA` | **Sky:** `#38BDF8`
- **Success:** `#4ADE80` | **Warning:** `#FBBF24` | **Error:** `#FB7185`
- **Focus Ring:** `#93C5FD` | **Dwell Ring:** `#FBBF24`
- **Brand Gradient:** `linear-gradient(135deg, #818CF8 0%, #A78BFA 100%)`

### Theme 3: "High Contrast" (Accessibility)
- **Background (`--bg-app`):** `#000000`
- **Card Surface (`--bg-surface`):** `#0A0A0A`
- **Text Primary (`--text-primary`):** `#FFFFFF`
- **Borders (`--border-subtle`):** `#FFFFFF` (2px solid)
- **Primary (`--primary`):** `#FFFFFF` (Text: `#000000`)
- **Focus Ring (`--focus-ring`):** `#00E5FF` (4px solid cyan)
- **Dwell Ring (`--dwell-ring`):** `#FFD400`
- Every state differentiated by **shape, icon, and text**, never color alone.

---

## 3. Subject Color Coding & Learning Modes

Every educational category is coded with **icon + text + color** (never color alone):

| Subject | Color Token | Soft Surface | Icon |
| :--- | :--- | :--- | :--- |
| **Science** | Accent Teal (`#0D9488`) | `#CCFBF1` | `<Atom />` |
| **Social Science** | Secondary Violet (`#7C3AED`) | `#EDE9FE` | `<Globe />` |

Learning Modes (segmented control & answer chip):
- **Simple:** Sky (`#0284C7`) with `<Sparkles />`
- **Step by step:** Violet (`#7C3AED`) with `<ListOrdered />`
- **Example:** Teal (`#0D9488`) with `<Lightbulb />`
- **Exam style:** Indigo (`#4F46E5`) with `<GraduationCap />`

---

## 4. Typography Scale (Lexend)

Engineered specifically with **Lexend** (via `next/font/google`) to reduce reading fatigue for dyslexic and neurodiverse learners.

- **Scale:**
  - 14px: Captions, helper text, status labels
  - 16px: Body text, secondary buttons, dock subtitles
  - 18px: Card subtitles, modal prompts
  - 22px: **Tutor Answer text** (optimized reading size, line-height 1.6)
  - 28px: Section headers, modal titles
  - 36px: Welcome greeting headline
- **Weights:** `400` (Regular), `500` (Medium), `600` (Semibold for headings and buttons). *Never 800-900 heavy black.*
- **Casing:** Normal-case headings (e.g., "You can also ask" instead of all-caps).

---

## 5. Gaze Stability & Target Invariance Rules

1. **Zero Transform:** Never use CSS `transform: scale(...)` or `translate(...)` on hover, gaze-on, or active states.
2. **Fixed 100dvh Grid Shell:** The layout uses an explicit 3-row grid:
   - Top Bar: `64px` fixed
   - Main Area: `minmax(0, 1fr)`
   - Bottom Dock: `112px` fixed
3. **No Ellipsis Truncation on Gaze Buttons:** All button labels use `text-wrap: balance` and room for up to 2 lines without hyphenated syllable breakage (`break-normal`).
4. **Pinned Card Controls:** The camera card pins its Start/Stop button inside the flex column (`mt-auto flex-shrink-0`), guaranteeing it is never pushed outside the viewport on short screens.
5. **Inner Dwell Progress:** Gaze progress is communicated strictly through an internal SVG progress ring or bottom bar within the button boundary.

---

## 6. Color-Blind Safety Verification

Automated token contrast testing and simulated vision tests verify accessibility across all color vision types:

- **Protanopia (Red-Blind):** All critical actions feature distinguishable iconography and text (e.g. microphone icon for "Ask with Voice", checkmark badges for active states, warning triangle icons for alerts).
- **Deuteranopia (Green-Blind):** Success states combine green color with checkmark icons (`<Check />` or `<CheckCircle2 />`) and explicit text labels ("Server connected", "Ready").
- **Tritanopia (Blue-Blind):** Subject color coding pairs Teal with `<Atom />` and Violet with `<Globe />`. Gaze dwell rings use High-Visibility Amber (`#F59E0B`), which retains high luminance contrast.
- **Monochromacy / Achromatopsia:** High Contrast theme provides pure black/white distinction with 2px borders, 4px focus rings, and explicit textual state feedback.

---

## 7. Strict "Don'ts"

- ❌ **No Yellow/Orange Fills:** Yellow or orange must never be used as a primary or dominant fill color anywhere in the application. (Amber `#F59E0B` is reserved strictly for dwell progress rings and small warning icons).
- ❌ **No Ellipsis Truncation on Action Buttons:** Gaze targets must clearly display their full readable label.
- ❌ **No Target Movement:** Bounding boxes must not shift by more than 1px across any modal, stream, or camera state transition.
- ❌ **No Color-Only Meaning:** Every status dot, badge, and mode chip must have accompanying text or iconography.
- ❌ **No Page-Level Scrolling:** Body scroll is strictly disabled; only designated inner containers scroll with scrollbar stability.
