"use client";

import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  Server,
  Camera,
  Eye,
  Mic,
  Settings,
  Shield,
  Pause,
  Play,
  Wrench,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { GazeButton } from "@/components/ui/GazeButton";
import { isMockMode } from "@/lib/api/client";
import type { SpeechToTextState } from "@/lib/voice";

export interface TopBarProps {
  board: string;
  subject: string;
  boardName?: string;
  subjectName?: string;
  backendStatus: "connected" | "checking" | "disconnected";
  isCameraActive: boolean;
  isCalibrated: boolean;
  calibrationGrade?: string;
  micState: SpeechToTextState;
  isEyePaused: boolean;
  focusMode: boolean;
  isSimGazeActive?: boolean;
  onToggleSimGaze?: () => void;
  onTogglePauseEye: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onChangeBoardSubject: () => void;
  onRefreshHealth?: () => void;
  onToggleStabilityMonitor?: () => void;
  isStabilityMonitorOpen?: boolean;
}

export function TopBar({
  board,
  subject,
  boardName,
  subjectName,
  backendStatus,
  isCameraActive,
  isCalibrated,
  calibrationGrade,
  micState,
  isEyePaused,
  focusMode,
  isSimGazeActive,
  onToggleSimGaze,
  onTogglePauseEye,
  onOpenSettings,
  onOpenPrivacy,
  onChangeBoardSubject,
  onRefreshHealth,
  onToggleStabilityMonitor,
  isStabilityMonitorOpen,
}: TopBarProps) {
  const [isDevMenuOpen, setIsDevMenuOpen] = useState(false);

  const isDevToolsEnabled =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DEV_TOOLS === "1" ||
      process.env.NODE_ENV !== "production");

  // Friendly status labels
  const serverStatus = {
    connected: { label: "Server", val: "Server connected", variant: "success" as const },
    checking: { label: "Server", val: "Connecting...", variant: "warning" as const },
    disconnected: { label: "Server", val: "Server offline", variant: "danger" as const },
  }[backendStatus];

  const cameraStatus = isCameraActive
    ? { val: "Camera on", variant: "success" as const }
    : { val: "Camera off", variant: "neutral" as const };

  const eyeStatus = isCalibrated
    ? { val: "Eyes ready", variant: "success" as const }
    : { val: "Eyes need setup", variant: "warning" as const };

  const micStatus =
    micState === "listening"
      ? { val: "Mic listening", variant: "warning" as const }
      : micState === "processing"
      ? { val: "Mic processing", variant: "warning" as const }
      : micState === "error"
      ? { val: "Mic error", variant: "danger" as const }
      : micState === "unsupported"
      ? { val: "Mic unsupported", variant: "danger" as const }
      : { val: "Mic ready", variant: "neutral" as const };

  const displayBoardSubject = `${
    board === "tn" ? "Tamil Nadu" : "CBSE"
  } · ${subject === "science" ? "Science" : "Social Science"}`;

  return (
    <header className="h-16 w-full max-w-full border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 flex items-center justify-between gap-2 select-none flex-shrink-0 z-30 shadow-xs overflow-clip">
      {/* Left: Brand Logo, Title & Context Chip (Anchored strictly to left) */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="w-[190px] min-w-[190px] max-w-[190px] flex items-center gap-3 flex-shrink-0 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-inner flex-shrink-0">
            <Sparkles className="w-5 h-5 text-slate-950 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)] leading-none">
              AI Tutor
            </h1>
            <div className="w-12 h-5 flex items-center flex-shrink-0">
              {isMockMode() && (
                <span
                  id="demo-mode-badge"
                  className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-600/90 dark:text-white dark:border-purple-400 inline-block"
                >
                  Demo
                </span>
              )}
            </div>
          </div>
        </div>

        <GazeButton
          id="header-change-board-btn"
          onClick={onChangeBoardSubject}
          label={displayBoardSubject}
          icon={<BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-300" />}
          variant="card"
          size="compact"
          progressType="bar"
          className="!h-10 !min-h-[40px] !w-[170px] !min-w-[170px] !max-w-[170px] !px-3 !py-1 text-xs font-bold text-amber-700 dark:text-amber-300 border-[var(--border-strong)] hover:border-amber-500"
        />
      </div>

      {/* Center-Right: Fixed Status Pills (Reserved Slot, Hidden in Focus Mode) */}
      <div
        className={`hidden xl:flex items-center gap-2 flex-shrink-0 ${
          focusMode ? "invisible pointer-events-none" : ""
        }`}
      >
        <StatusPill
          id="status-server-pill"
          icon={<Server className="w-3.5 h-3.5" />}
          label="Server"
          value={serverStatus.val}
          variant={serverStatus.variant}
          onClick={onRefreshHealth}
        />
        <StatusPill
          id="status-camera-pill"
          icon={<Camera className="w-3.5 h-3.5" />}
          label="Camera"
          value={cameraStatus.val}
          variant={cameraStatus.variant}
        />
        <StatusPill
          id="status-eye-pill"
          icon={<Eye className="w-3.5 h-3.5" />}
          label="Eyes"
          value={eyeStatus.val}
          variant={eyeStatus.variant}
        />
        <StatusPill
          id="status-mic-pill"
          icon={<Mic className="w-3.5 h-3.5" />}
          label="Microphone"
          value={micStatus.val}
          variant={micStatus.variant}
        />
      </div>

      {/* Right: Pause Eye Control, Settings, Privacy, and Dev Menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Pause / Resume Eye Control Button (Always Active) */}
        <GazeButton
          id="gaze-pause-toggle-btn"
          onClick={onTogglePauseEye}
          label={isEyePaused ? "PAUSED (Look)" : "Pause Eye Control"}
          icon={isEyePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          priority={950}
          variant={isEyePaused ? "active" : "outline"}
          size="compact"
          progressType="bar"
          className={`!h-10 !min-h-[40px] !w-[150px] !min-w-[150px] !max-w-[150px] !px-3 !py-1 text-xs font-extrabold ${
            isEyePaused
              ? "!bg-amber-400 !text-slate-950 !border-amber-400"
              : "text-[var(--text-primary)] border-[var(--border-strong)]"
          }`}
        />

        {/* Settings Drawer Button */}
        <GazeButton
          id="header-settings-btn"
          onClick={onOpenSettings}
          label="Settings"
          icon={<Settings className="w-4 h-4" />}
          variant="card"
          size="compact"
          progressType="bar"
          className="!h-10 !min-h-[40px] !w-[100px] !min-w-[100px] !max-w-[100px] !px-3 !py-1 text-xs font-bold border-[var(--border-strong)] hover:border-amber-500"
        />

        {/* Privacy Panel Button */}
        <GazeButton
          id="header-privacy-btn"
          onClick={onOpenPrivacy}
          label="Privacy"
          icon={<Shield className="w-4 h-4" />}
          variant="card"
          size="compact"
          progressType="bar"
          className="!h-10 !min-h-[40px] !w-[96px] !min-w-[96px] !max-w-[96px] !px-3 !py-1 text-xs font-bold border-[var(--border-strong)] hover:border-amber-500 hidden lg:inline-flex"
        />

        {/* Dev Tools Dropdown (Dev Only, NOT floating over content) */}
        {isDevToolsEnabled && (
          <div className="relative">
            <button
              id="dev-menu-btn"
              type="button"
              onClick={() => setIsDevMenuOpen((prev) => !prev)}
              aria-label="Developer tools menu"
              title="Dev Tools"
              className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-300 dark:bg-purple-950/80 dark:border-purple-500/70 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-200 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <Wrench className="w-4 h-4" />
            </button>

            {isDevMenuOpen && (
              <div
                id="dev-menu-dropdown"
                className="absolute right-0 top-12 w-64 bg-[var(--bg-surface)] border-2 border-purple-400 rounded-2xl p-3 shadow-2xl z-50 space-y-2 text-xs"
              >
                <div className="font-black text-purple-700 dark:text-purple-300 pb-1 border-b border-[var(--border-subtle)]">
                  Dev Diagnostics & Simulation
                </div>
                {onToggleSimGaze && (
                  <button
                    id="toggle-gaze-simulator-btn"
                    type="button"
                    onClick={() => {
                      onToggleSimGaze();
                      setIsDevMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-[var(--bg-surface-raised)] border border-[var(--border-strong)] hover:border-purple-500 flex items-center justify-between font-bold text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Simulate Gaze (Mouse)</span>
                    <span className={isSimGazeActive ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-muted)]"}>
                      {isSimGazeActive ? "ON" : "OFF"}
                    </span>
                  </button>
                )}
                {onToggleStabilityMonitor && (
                  <button
                    id="toggle-stability-monitor-btn"
                    type="button"
                    onClick={() => {
                      onToggleStabilityMonitor();
                      setIsDevMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-[var(--bg-surface-raised)] border border-[var(--border-strong)] hover:border-purple-500 flex items-center justify-between font-bold text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Layout Stability Monitor</span>
                    <span className={isStabilityMonitorOpen ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-muted)]"}>
                      {isStabilityMonitorOpen ? "ON" : "OFF"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
