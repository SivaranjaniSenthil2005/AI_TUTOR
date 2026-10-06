/**
 * Types and interfaces for the Gaze UI engine.
 */

export interface GazePointLike {
  x: number;          // Normalized [0..1]
  y: number;          // Normalized [0..1]
  xPx: number;        // Viewport pixel X
  yPx: number;        // Viewport pixel Y
  confidence: number; // 0..1
  timestamp: number;
  valid: boolean;
}

export type DwellState = "idle" | "hovering" | "dwelling" | "activated" | "cooldown";

export interface GazeTarget {
  id: string;
  element: HTMLElement | null;
  onActivate: () => void;
  dwellMs?: number;       // Custom override for this specific target
  disabled?: boolean;
  priority?: number;      // Higher priority wins ties (default: 0)
  hitPadding?: number;    // Custom hit padding override in px
}

export interface GazeUiSettings {
  dwellMs: number;          // Default dwell duration in ms (600 - 3000, default 1200)
  hitPadding: number;       // Padding around target in px (12 - 64, default 24)
  stickyMargin: number;     // Additional margin before breaking dwell (default 40)
  gracePeriodMs: number;    // Grace period for blinks / brief exit in ms (default 250)
  cooldownMs: number;       // Cooldown duration after activation in ms (default 1000)
  showGazeDot: boolean;     // Whether to display the floating gaze cursor (default true)
  soundEnabled: boolean;    // Whether Web Audio sounds are enabled (default true)
  reducedMotion: boolean;   // Whether to minimize animations (default false)
  highContrast: boolean;    // High contrast theme mode (default false)
  largeText: boolean;       // Extra large typography mode (default false)
  isPaused: boolean;        // User manual eye control pause (default false)
}

export interface DwellSnapshot {
  state: DwellState;
  targetId: string | null;
  progress: number;         // 0..1
  cooldownRemainingMs: number;
  isGracePeriod: boolean;
}

export interface HitTestResult {
  target: GazeTarget | null;
  distance: number;
  isSticky: boolean;
}
