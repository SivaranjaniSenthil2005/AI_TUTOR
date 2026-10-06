"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGazeContext } from "./GazeContext";
import type { DwellState, GazeTarget } from "./types";

export interface UseGazeTargetOptions {
  id: string;
  onActivate: () => void;
  dwellMs?: number;
  disabled?: boolean;
  priority?: number;
  hitPadding?: number;
}

export interface UseGazeTargetReturn {
  progress: number;
  dwellState: DwellState;
  isGrace: boolean;
  isHovered: boolean;
  isDwelling: boolean;
  isActivated: boolean;
  isCooldown: boolean;
  triggerActivate: () => void;
}

export function useGazeTarget(
  elementRef: React.RefObject<HTMLElement | null>,
  options: UseGazeTargetOptions
): UseGazeTargetReturn {
  const { registry, subscribeToTarget } = useGazeContext();
  const { id, onActivate, dwellMs, disabled = false, priority = 0, hitPadding } = options;

  const [progress, setProgress] = useState<number>(0);
  const [dwellState, setDwellState] = useState<DwellState>("idle");
  const [isGrace, setIsGrace] = useState<boolean>(false);
  const onActivateRef = useRef(onActivate);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onActivateRef.current = onActivate;
    disabledRef.current = disabled;
  }, [onActivate, disabled]);

  // Register on mount / unregister on unmount
  useEffect(() => {
    const target: GazeTarget = {
      id,
      element: elementRef.current,
      onActivate: () => {
        if (!disabledRef.current) {
          onActivateRef.current?.();
        }
      },
      dwellMs,
      disabled,
      priority,
      hitPadding,
    };

    registry.register(target);

    return () => {
      registry.unregister(id);
    };
  }, [id, dwellMs, disabled, priority, hitPadding, registry, elementRef]);

  // Update element reference if element mount changes
  useEffect(() => {
    if (elementRef.current) {
      registry.update({
        id,
        element: elementRef.current,
        onActivate: () => {
          if (!disabledRef.current) {
            onActivateRef.current?.();
          }
        },
        dwellMs,
        disabled,
        priority,
        hitPadding,
      });
    }
  });

  // Subscribe to progress updates for this specific target
  useEffect(() => {
    const unsubscribe = subscribeToTarget(id, (newProgress, newState, newIsGrace) => {
      setProgress(newProgress);
      setDwellState(newState);
      setIsGrace(newIsGrace);
    });

    return () => {
      unsubscribe();
    };
  }, [id, subscribeToTarget]);

  const triggerActivate = useCallback(() => {
    if (!disabledRef.current) {
      onActivateRef.current?.();
    }
  }, []);

  return {
    progress,
    dwellState,
    isGrace,
    isHovered: dwellState === "hovering" || dwellState === "dwelling",
    isDwelling: dwellState === "dwelling",
    isActivated: dwellState === "activated",
    isCooldown: dwellState === "cooldown",
    triggerActivate,
  };
}
