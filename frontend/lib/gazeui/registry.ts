import type { GazeTarget } from "./types";

/**
 * Registry of interactive gaze targets on the screen.
 * Components register themselves on mount and unregister on unmount.
 */
export class GazeTargetRegistry {
  private targets: Map<string, GazeTarget> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Registers a target or updates an existing registration.
   */
  public register(target: GazeTarget): void {
    this.targets.set(target.id, target);
    this.notify();
  }

  /**
   * Unregisters a target by its ID.
   */
  public unregister(id: string): void {
    if (this.targets.delete(id)) {
      this.notify();
    }
  }

  /**
   * Updates an existing registered target.
   */
  public update(target: GazeTarget): void {
    this.targets.set(target.id, target);
  }

  /**
   * Retrieves a target by its ID.
   */
  public getTarget(id: string): GazeTarget | undefined {
    return this.targets.get(id);
  }

  /**
   * Returns all currently active and mounted targets.
   */
  public getAllTargets(): GazeTarget[] {
    return Array.from(this.targets.values());
  }

  /**
   * Subscribes to changes in the target registry.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clears all registered targets.
   */
  public clear(): void {
    this.targets.clear();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
