import type { GazePointLike, GazeTarget, HitTestResult } from "./types";

export interface SimpleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ExpandedBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export function computeExpandedBounds(rect: SimpleRect, padding: number): ExpandedBounds {
  const left = rect.left - padding;
  const top = rect.top - padding;
  const right = rect.right + padding;
  const bottom = rect.bottom + padding;
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;

  return { left, top, right, bottom, centerX, centerY };
}

export function isPointInsideBounds(x: number, y: number, bounds: ExpandedBounds): boolean {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

export function computeDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Manages caching and invalidation of bounding client rects.
 * Prevents forced reflow / layout thrashing on every frame (60-120fps).
 */
export class RectCache {
  private cache: Map<string, { rect: SimpleRect; timestamp: number }> = new Map();
  private maxAgeMs: number;

  constructor(maxAgeMs: number = 100) {
    this.maxAgeMs = maxAgeMs;
  }

  public getRect(target: GazeTarget, now: number = performance.now()): SimpleRect | null {
    const cached = this.cache.get(target.id);
    if (cached && now - cached.timestamp < this.maxAgeMs) {
      return cached.rect;
    }

    if (!target.element) {
      return null;
    }

    // Measure DOM element
    const domRect = target.element.getBoundingClientRect();
    if (domRect.width === 0 && domRect.height === 0) {
      return null; // Invisible or unmounted
    }

    const simple: SimpleRect = {
      left: domRect.left,
      top: domRect.top,
      right: domRect.right,
      bottom: domRect.bottom,
      width: domRect.width,
      height: domRect.height,
    };

    this.cache.set(target.id, { rect: simple, timestamp: now });
    return simple;
  }

  public setRect(id: string, rect: SimpleRect, timestamp: number = performance.now()): void {
    this.cache.set(id, { rect, timestamp });
  }

  public invalidate(id?: string): void {
    if (id) {
      this.cache.delete(id);
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Performs hit testing against all registered gaze targets.
 */
export function performHitTest({
  gazePoint,
  targets,
  defaultPadding = 24,
  stickyMargin = 40,
  activeTargetId = null,
  rectCache,
  now = typeof performance !== "undefined" ? performance.now() : 0,
}: {
  gazePoint: GazePointLike | null;
  targets: GazeTarget[];
  defaultPadding?: number;
  stickyMargin?: number;
  activeTargetId?: string | null;
  rectCache?: RectCache;
  now?: number;
}): HitTestResult {
  if (!gazePoint || !gazePoint.valid) {
    return { target: null, distance: Infinity, isSticky: false };
  }

  const { xPx, yPx } = gazePoint;
  const cache = rectCache || new RectCache();

  // 1. Check STICKINESS: If a target is currently active and dwelled on, check if gaze is within its sticky margin
  if (activeTargetId) {
    const activeTarget = targets.find((t) => t.id === activeTargetId && !t.disabled);
    if (activeTarget) {
      const rect = cache.getRect(activeTarget, now);
      if (rect) {
        const padding = activeTarget.hitPadding ?? defaultPadding;
        const stickyBounds = computeExpandedBounds(rect, padding + stickyMargin);
        if (isPointInsideBounds(xPx, yPx, stickyBounds)) {
          const dist = computeDistance(xPx, yPx, stickyBounds.centerX, stickyBounds.centerY);
          return {
            target: activeTarget,
            distance: dist,
            isSticky: true,
          };
        }
      }
    }
  }

  // 2. Candidate hit testing for all valid targets
  let bestTarget: GazeTarget | null = null;
  let bestDistance = Infinity;
  let bestPriority = -Infinity;

  for (const target of targets) {
    if (target.disabled) continue;

    const rect = cache.getRect(target, now);
    if (!rect) continue;

    const padding = target.hitPadding ?? defaultPadding;
    const bounds = computeExpandedBounds(rect, padding);

    if (isPointInsideBounds(xPx, yPx, bounds)) {
      const dist = computeDistance(xPx, yPx, bounds.centerX, bounds.centerY);
      const priority = target.priority ?? 0;

      if (priority > bestPriority) {
        bestPriority = priority;
        bestDistance = dist;
        bestTarget = target;
      } else if (priority === bestPriority && dist < bestDistance) {
        bestDistance = dist;
        bestTarget = target;
      }
    }
  }

  return {
    target: bestTarget,
    distance: bestDistance,
    isSticky: false,
  };
}
