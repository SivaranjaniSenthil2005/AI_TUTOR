"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type {
  GazePointLike,
  GazeUiSettings,
  DwellState,
  DwellSnapshot,
} from "./types";
import { GazeTargetRegistry } from "./registry";
import { performHitTest, RectCache } from "./hitTest";
import { DwellStateMachine } from "./dwell";
import { globalSoundEffects } from "./sound";

const SETTINGS_STORAGE_KEY = "ai_tutor_gaze_settings";

const DEFAULT_SETTINGS: GazeUiSettings = {
  dwellMs: 1200,
  hitPadding: 24,
  stickyMargin: 40,
  gracePeriodMs: 250,
  cooldownMs: 1000,
  showGazeDot: true,
  soundEnabled: true,
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  isPaused: false,
};

export type TargetProgressSubscriber = (
  progress: number,
  state: DwellState,
  isGrace: boolean
) => void;

export interface GazeContextValue {
  settings: GazeUiSettings;
  updateSettings: (newSettings: Partial<GazeUiSettings>) => void;
  resetSettings: () => void;
  isPaused: boolean;
  autoPaused: boolean;
  pauseEyeControl: () => void;
  resumeEyeControl: () => void;
  togglePause: () => void;
  registry: GazeTargetRegistry;
  subscribeToTarget: (id: string, callback: TargetProgressSubscriber) => () => void;
  gazePointRef: React.RefObject<GazePointLike>;
  rectCache: RectCache;
  activeTargetId: string | null;
  dwellState: DwellState;
}

const GazeContext = createContext<GazeContextValue | null>(null);

export interface GazeProviderProps {
  children: React.ReactNode;
  gazePointRef: React.RefObject<GazePointLike>;
  isCameraActive?: boolean;
}

export function GazeProvider({
  children,
  gazePointRef,
  isCameraActive = false,
}: GazeProviderProps) {
  // Load initial settings
  const [settings, setSettings] = useState<GazeUiSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      } catch {}
      // Check prefers-reduced-motion
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return { ...DEFAULT_SETTINGS, reducedMotion: true };
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [autoPaused, setAutoPaused] = useState<boolean>(false);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [dwellState, setDwellState] = useState<DwellState>("idle");

  const registry = useMemo(() => new GazeTargetRegistry(), []);
  const rectCache = useMemo(() => new RectCache(120), []);
  const subscribersRef = useRef<Map<string, Set<TargetProgressSubscriber>>>(new Map());

  const lastValidFaceTimeRef = useRef<number>(0);
  const wasFaceLostRef = useRef<boolean>(false);
  const prevActiveTargetIdRef = useRef<string | null>(null);

  // Sync sound setting
  useEffect(() => {
    globalSoundEffects.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Sync HTML classes for theme accessibility
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (settings.highContrast) {
        root.classList.add("high-contrast");
      } else {
        root.classList.remove("high-contrast");
      }

      if (settings.largeText) {
        root.classList.add("large-text");
      } else {
        root.classList.remove("large-text");
      }

      if (settings.reducedMotion) {
        root.classList.add("reduced-motion");
      } else {
        root.classList.remove("reduced-motion");
      }
    }
  }, [settings.highContrast, settings.largeText, settings.reducedMotion]);

  // Invalidate rect cache on scroll or resize
  useEffect(() => {
    const handleInvalidate = () => {
      rectCache.invalidate();
    };

    window.addEventListener("resize", handleInvalidate, { passive: true });
    window.addEventListener("scroll", handleInvalidate, { passive: true, capture: true });

    return () => {
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("scroll", handleInvalidate, { capture: true });
    };
  }, [rectCache]);

  const updateSettings = useCallback((newSettings: Partial<GazeUiSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {}
  }, []);

  const pauseEyeControl = useCallback(() => {
    updateSettings({ isPaused: true });
    globalSoundEffects.playPauseTone();
  }, [updateSettings]);

  const resumeEyeControl = useCallback(() => {
    updateSettings({ isPaused: false });
    setAutoPaused(false);
    globalSoundEffects.playResumeTone();
  }, [updateSettings]);

  const togglePause = useCallback(() => {
    if (settings.isPaused || autoPaused) {
      resumeEyeControl();
    } else {
      pauseEyeControl();
    }
  }, [settings.isPaused, autoPaused, resumeEyeControl, pauseEyeControl]);

  // Keyboard shortcut: Press 'P' or 'p' to toggle pause/resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePause]);

  const subscribeToTarget = useCallback(
    (id: string, callback: TargetProgressSubscriber) => {
      if (!subscribersRef.current.has(id)) {
        subscribersRef.current.set(id, new Set());
      }
      const set = subscribersRef.current.get(id)!;
      set.add(callback);

      return () => {
        set.delete(callback);
        if (set.size === 0) {
          subscribersRef.current.delete(id);
        }
      };
    },
    []
  );

  // Dwell state machine
  const dwellMachineRef = useRef<DwellStateMachine>(
    new DwellStateMachine({
      defaultDwellMs: settings.dwellMs,
      gracePeriodMs: settings.gracePeriodMs,
      cooldownMs: settings.cooldownMs,
      onDwellStart: () => {
        globalSoundEffects.playTick();
      },
      onActivate: () => {
        globalSoundEffects.playActivationChime();
      },
    })
  );

  // Sync settings into dwell machine
  useEffect(() => {
    dwellMachineRef.current.defaultDwellMs = settings.dwellMs;
    dwellMachineRef.current.gracePeriodMs = settings.gracePeriodMs;
    dwellMachineRef.current.cooldownMs = settings.cooldownMs;
  }, [settings.dwellMs, settings.gracePeriodMs, settings.cooldownMs]);

  // High-performance rAF loop for gaze hit testing & dwell progress
  useEffect(() => {
    let animId: number;
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;

      const now = performance.now();
      if (lastValidFaceTimeRef.current === 0) {
        lastValidFaceTimeRef.current = now;
      }

      const currentPoint = gazePointRef.current;
      const isValid = Boolean(currentPoint && currentPoint.valid);

      // Auto-pause detection: if face is lost for > 3.0s while camera active
      if (isCameraActive) {
        if (isValid) {
          lastValidFaceTimeRef.current = now;
          if (wasFaceLostRef.current) {
            wasFaceLostRef.current = false;
            setAutoPaused(false);
            globalSoundEffects.playResumeTone();
          }
        } else {
          const lostDuration = now - lastValidFaceTimeRef.current;
          if (lostDuration >= 3000 && !wasFaceLostRef.current) {
            wasFaceLostRef.current = true;
            setAutoPaused(true);
            globalSoundEffects.playPauseTone();
          }
        }
      }

      const effectivelyPaused = settings.isPaused || autoPaused;

      // When effectively paused, filter targets: only targets with priority >= 900 (e.g. Resume button) remain active
      const allTargets = registry.getAllTargets();
      const eligibleTargets = effectivelyPaused
        ? allTargets.filter((t) => (t.priority ?? 0) >= 900)
        : allTargets;

      const hitResult = performHitTest({
        gazePoint: currentPoint,
        targets: eligibleTargets,
        defaultPadding: settings.hitPadding,
        stickyMargin: settings.stickyMargin,
        activeTargetId: prevActiveTargetIdRef.current,
        rectCache: rectCache,
        now,
      });

      // Update dwell state machine
      const snapshot: DwellSnapshot = dwellMachineRef.current.update(
        hitResult.target,
        isValid,
        now
      );

      const currentActiveId = snapshot.targetId;
      const prevActiveId = prevActiveTargetIdRef.current;

      // Notify previous active target subscribers if it was deactivated
      if (prevActiveId && prevActiveId !== currentActiveId) {
        const prevSubs = subscribersRef.current.get(prevActiveId);
        if (prevSubs) {
          for (const sub of prevSubs) {
            sub(0, "idle", false);
          }
        }
      }

      // Notify current active target subscribers with updated progress
      if (currentActiveId) {
        const activeSubs = subscribersRef.current.get(currentActiveId);
        if (activeSubs) {
          for (const sub of activeSubs) {
            sub(snapshot.progress, snapshot.state, snapshot.isGracePeriod);
          }
        }
      }

      prevActiveTargetIdRef.current = currentActiveId;

      // Update coarse context state when target changes
      if (currentActiveId !== activeTargetId) {
        setActiveTargetId(currentActiveId);
      }
      if (snapshot.state !== dwellState) {
        setDwellState(snapshot.state);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [
    gazePointRef,
    isCameraActive,
    settings.isPaused,
    settings.hitPadding,
    settings.stickyMargin,
    autoPaused,
    activeTargetId,
    dwellState,
    registry,
    rectCache,
  ]);

  const value = useMemo<GazeContextValue>(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      isPaused: settings.isPaused,
      autoPaused,
      pauseEyeControl,
      resumeEyeControl,
      togglePause,
      registry,
      subscribeToTarget,
      gazePointRef,
      rectCache,
      activeTargetId,
      dwellState,
    }),
    [
      settings,
      updateSettings,
      resetSettings,
      autoPaused,
      pauseEyeControl,
      resumeEyeControl,
      togglePause,
      registry,
      subscribeToTarget,
      gazePointRef,
      rectCache,
      activeTargetId,
      dwellState,
    ]
  );

  return <GazeContext.Provider value={value}>{children}</GazeContext.Provider>;
}

export function useGazeContext(): GazeContextValue {
  const ctx = useContext(GazeContext);
  if (!ctx) {
    throw new Error("useGazeContext must be used within a GazeProvider");
  }
  return ctx;
}
