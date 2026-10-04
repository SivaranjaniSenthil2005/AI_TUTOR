/**
 * AI Tutor - Signal Smoothing Filters
 * Implements the 1€ (One Euro) Filter for low-latency adaptive jitter reduction and EMA smoothing.
 *
 * Reference: Casiez et al., "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in HCI" (CHI 2012)
 */

function alpha(cutoff: number, dt: number): number {
  const tau = 1.0 / (2.0 * Math.PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

export interface OneEuroConfig {
  minCutoff?: number; // Minimum cutoff frequency in Hz (default: 1.0)
  beta?: number;      // Speed coefficient (default: 0.007)
  dCutoff?: number;   // Derivative cutoff frequency in Hz (default: 1.0)
}

/**
 * Single-channel 1€ Filter.
 */
export class OneEuroFilter {
  public minCutoff: number;
  public beta: number;
  public dCutoff: number;

  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(config: OneEuroConfig = {}) {
    this.minCutoff = config.minCutoff ?? 1.0;
    this.beta = config.beta ?? 0.007;
    this.dCutoff = config.dCutoff ?? 1.0;
  }

  public filter(x: number, timestampMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = timestampMs;
      return x;
    }

    const dt = (timestampMs - this.tPrev) / 1000.0;
    // Guard against non-monotonic or zero dt
    if (dt <= 1e-5) {
      return this.xPrev;
    }

    this.tPrev = timestampMs;

    // Estimate derivative
    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1.0 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    // Adaptive cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);

    // Filter value
    const xHat = a * x + (1.0 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }

  public reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

/**
 * Exponential Moving Average (EMA) Filter.
 */
export class EMAFilter {
  private alpha: number;
  private value: number | null = null;

  constructor(alpha: number = 0.25) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  public filter(x: number): number {
    if (this.value === null) {
      this.value = x;
      return x;
    }
    this.value = this.alpha * x + (1.0 - this.alpha) * this.value;
    return this.value;
  }

  public reset() {
    this.value = null;
  }
}

export interface GazeFeaturesVector {
  irisX: number;
  irisY: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Multi-channel feature smoother using One Euro Filters.
 */
export class GazeFeatureSmoother {
  private filterIrisX: OneEuroFilter;
  private filterIrisY: OneEuroFilter;
  private filterYaw: OneEuroFilter;
  private filterPitch: OneEuroFilter;
  private filterRoll: OneEuroFilter;

  constructor(config: OneEuroConfig = {}) {
    this.filterIrisX = new OneEuroFilter(config);
    this.filterIrisY = new OneEuroFilter(config);
    this.filterYaw = new OneEuroFilter(config);
    this.filterPitch = new OneEuroFilter(config);
    this.filterRoll = new OneEuroFilter(config);
  }

  public updateConfig(config: OneEuroConfig) {
    if (config.minCutoff !== undefined) {
      this.filterIrisX.minCutoff = config.minCutoff;
      this.filterIrisY.minCutoff = config.minCutoff;
      this.filterYaw.minCutoff = config.minCutoff;
      this.filterPitch.minCutoff = config.minCutoff;
      this.filterRoll.minCutoff = config.minCutoff;
    }
    if (config.beta !== undefined) {
      this.filterIrisX.beta = config.beta;
      this.filterIrisY.beta = config.beta;
      this.filterYaw.beta = config.beta;
      this.filterPitch.beta = config.beta;
      this.filterRoll.beta = config.beta;
    }
    if (config.dCutoff !== undefined) {
      this.filterIrisX.dCutoff = config.dCutoff;
      this.filterIrisY.dCutoff = config.dCutoff;
      this.filterYaw.dCutoff = config.dCutoff;
      this.filterPitch.dCutoff = config.dCutoff;
      this.filterRoll.dCutoff = config.dCutoff;
    }
  }

  public smooth(raw: GazeFeaturesVector, timestampMs: number): GazeFeaturesVector {
    return {
      irisX: this.filterIrisX.filter(raw.irisX, timestampMs),
      irisY: this.filterIrisY.filter(raw.irisY, timestampMs),
      yaw: this.filterYaw.filter(raw.yaw, timestampMs),
      pitch: this.filterPitch.filter(raw.pitch, timestampMs),
      roll: this.filterRoll.filter(raw.roll, timestampMs),
    };
  }

  public reset() {
    this.filterIrisX.reset();
    this.filterIrisY.reset();
    this.filterYaw.reset();
    this.filterPitch.reset();
    this.filterRoll.reset();
  }
}
