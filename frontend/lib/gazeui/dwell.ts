import type { DwellSnapshot, DwellState, GazeTarget } from "./types";

export interface DwellStateMachineOptions {
  defaultDwellMs?: number;
  gracePeriodMs?: number;
  cooldownMs?: number;
  decayRatePerMs?: number; // Rate at which progress decays when gaze is lost (default 0.0025 -> ~400ms decay)
  onActivate?: (target: GazeTarget) => void;
  onDwellStart?: (target: GazeTarget) => void;
  onStateChange?: (state: DwellState, targetId: string | null) => void;
}

export class DwellStateMachine {
  private state: DwellState = "idle";
  private activeTarget: GazeTarget | null = null;
  private progress: number = 0; // 0..1
  private cooldownRemainingMs: number = 0;
  private lockedTargetId: string | null = null; // Target that activated and must be exited before rearming
  private lastHitTime: number = 0;
  private lostTime: number = 0;
  private lastUpdateTime: number = 0;

  public defaultDwellMs: number;
  public gracePeriodMs: number;
  public cooldownMs: number;
  public decayRatePerMs: number;

  public onActivate?: (target: GazeTarget) => void;
  public onDwellStart?: (target: GazeTarget) => void;
  public onStateChange?: (state: DwellState, targetId: string | null) => void;

  constructor(options: DwellStateMachineOptions = {}) {
    this.defaultDwellMs = options.defaultDwellMs ?? 1200;
    this.gracePeriodMs = options.gracePeriodMs ?? 250;
    this.cooldownMs = options.cooldownMs ?? 1000;
    this.decayRatePerMs = options.decayRatePerMs ?? 0.0025;
    this.onActivate = options.onActivate;
    this.onDwellStart = options.onDwellStart;
    this.onStateChange = options.onStateChange;
  }

  public getSnapshot(): DwellSnapshot {
    const isGracePeriod =
      (this.state === "dwelling" || this.state === "hovering") &&
      this.lostTime > 0 &&
      this.lastUpdateTime - this.lostTime <= this.gracePeriodMs;

    return {
      state: this.state,
      targetId: this.activeTarget ? this.activeTarget.id : null,
      progress: this.progress,
      cooldownRemainingMs: this.cooldownRemainingMs,
      isGracePeriod,
    };
  }

  public reset(): void {
    this.state = "idle";
    this.activeTarget = null;
    this.progress = 0;
    this.cooldownRemainingMs = 0;
    this.lockedTargetId = null;
    this.lostTime = 0;
    this.lastHitTime = 0;
  }

  /**
   * Main state machine update step per frame.
   * @param hitTarget Currently hit gaze target (if any, factoring in stickiness)
   * @param isValidGaze Whether the gaze point is currently valid and confident
   * @param now Current timestamp in milliseconds (e.g. performance.now())
   */
  public update(
    hitTarget: GazeTarget | null,
    isValidGaze: boolean,
    now: number = typeof performance !== "undefined" ? performance.now() : Date.now()
  ): DwellSnapshot {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = now;
    }
    const dt = Math.max(0, now - this.lastUpdateTime);
    this.lastUpdateTime = now;

    // Handle Cooldown countdown
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - dt);
    }

    // Rearm locked target if gaze leaves it
    if (this.lockedTargetId && (!hitTarget || hitTarget.id !== this.lockedTargetId)) {
      this.lockedTargetId = null;
    }

    const hasValidHit = isValidGaze && hitTarget !== null && !hitTarget.disabled;

    if (hasValidHit && hitTarget) {
      this.lostTime = 0; // Reset lost timer
      this.lastHitTime = now;

      // Check if this target is in cooldown or locked
      if (
        this.lockedTargetId === hitTarget.id ||
        (this.state === "cooldown" &&
          this.activeTarget?.id === hitTarget.id &&
          this.cooldownRemainingMs > 0)
      ) {
        this.progress = 0;
        return this.getSnapshot();
      }

      // Check if we switched to a DIFFERENT target
      if (this.activeTarget && this.activeTarget.id !== hitTarget.id) {
        this.activeTarget = hitTarget;
        this.progress = 0;
        this.setState("dwelling", hitTarget.id);
        this.onDwellStart?.(hitTarget);
        return this.getSnapshot();
      } else if (!this.activeTarget) {
        // Entering target for first time
        this.activeTarget = hitTarget;
        this.progress = 0;
        this.setState("dwelling", hitTarget.id);
        this.onDwellStart?.(hitTarget);
      }

      // Progress dwell on active target
      const targetDwellMs = this.activeTarget.dwellMs ?? this.defaultDwellMs;
      const progressDelta = dt / Math.max(100, targetDwellMs);
      this.progress = Math.min(1.0, this.progress + progressDelta);

      if (this.progress >= 1.0) {
        // ACTIVATION!
        this.setState("activated", this.activeTarget.id);
        const activatedTarget = this.activeTarget;
        this.lockedTargetId = activatedTarget.id;
        this.cooldownRemainingMs = this.cooldownMs;

        // Fire activation callback
        activatedTarget.onActivate?.();
        this.onActivate?.(activatedTarget);

        // Transition to cooldown
        this.setState("cooldown", activatedTarget.id);
      }
    } else {
      // Gaze lost or out of bounds
      if (this.state === "dwelling" || this.state === "hovering") {
        if (this.lostTime === 0) {
          this.lostTime = now;
        }

        const elapsedLost = now - this.lostTime;

        if (elapsedLost <= this.gracePeriodMs) {
          // Inside grace period: freeze/pause progress!
          // No decay yet
        } else {
          // Grace period expired: decay progress slowly
          this.progress = Math.max(0, this.progress - this.decayRatePerMs * dt);

          if (this.progress <= 0) {
            this.progress = 0;
            this.activeTarget = null;
            this.setState("idle", null);
          }
        }
      } else if (this.state === "cooldown") {
        if (this.cooldownRemainingMs <= 0 && !this.lockedTargetId) {
          this.activeTarget = null;
          this.setState("idle", null);
        }
      } else {
        this.progress = 0;
        this.activeTarget = null;
        if (this.state !== "idle") {
          this.setState("idle", null);
        }
      }
    }

    return this.getSnapshot();
  }

  private setState(newState: DwellState, targetId: string | null): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState, targetId);
    }
  }
}
