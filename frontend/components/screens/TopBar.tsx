"use client";

import React, { useState, useSyncExternalStore } from "react";
import {
  Sparkles,
  Server,
  Camera,
  Eye,
  Mic,
  Pause,
  Play,
  Menu,
  Atom,
  Globe,
  RefreshCw,
  X,
  Shield,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { GazeButton } from "@/components/ui/GazeButton";
import { isMockMode } from "@/lib/api/client";
import type { SpeechToTextState } from "@/lib/voice";

const subscribeNoop = () => () => {};

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
  backendStatus,
  isCameraActive,
  isCalibrated,
  micState,
  isEyePaused,
  focusMode,
  onTogglePauseEye,
  onOpenSettings,
  onOpenPrivacy,
  onChangeBoardSubject,
  onRefreshHealth,
}: TopBarProps) {
  const isMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);

  // Detailed statuses for tooltip & popover
  const serverStatus = {
    connected: { short: "Server", detail: "Server connected (healthy)", variant: "success" as const },
    checking: { short: "Server", detail: "Connecting to server...", variant: "warning" as const },
    disconnected: { short: "Server", detail: "Server offline (tap to retry)", variant: "danger" as const },
  }[backendStatus];

  const cameraStatus = isCameraActive
    ? { short: "Camera", detail: "Camera active (tracking gaze)", variant: "success" as const }
    : { short: "Camera", detail: "Camera off", variant: "neutral" as const };

  const eyeStatus = isCalibrated
    ? { short: "Eyes", detail: "Eye calibration ready", variant: "success" as const }
    : { short: "Eyes", detail: "Eyes need calibration", variant: "warning" as const };

  const micStatus =
    micState === "listening"
      ? { short: "Mic", detail: "Microphone listening...", variant: "warning" as const }
      : micState === "processing"
      ? { short: "Mic", detail: "Processing voice question...", variant: "warning" as const }
      : micState === "error"
      ? { short: "Mic", detail: "Microphone error", variant: "danger" as const }
      : micState === "unsupported"
      ? { short: "Mic", detail: "Speech recognition unsupported", variant: "danger" as const }
      : { short: "Mic", detail: "Microphone ready", variant: "neutral" as const };

  // Subject color coding (Teal for Science, Violet for Social Science)
  const isScience = subject === "science";
  const subjectLabel = isScience ? "Science" : "Social";
  const boardLabel = board === "tn" ? "TN" : "CBSE";
  const chipSubjectText = `${boardLabel} · ${subjectLabel}`;

  const subjectChipStyle = isScience
    ? "bg-[#CCFBF1] text-[#0D9488] border-[#0D9488]/30 dark:bg-[#133E3B] dark:text-[#2DD4BF]"
    : "bg-[#EDE9FE] text-[#7C3AED] border-[#7C3AED]/30 dark:bg-[#2E2559] dark:text-[#A78BFA]";

  return (
    <header className="h-16 w-full max-w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 flex items-center justify-between gap-3 select-none flex-shrink-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* 1. Brand Logo + Name & Context Chip (Strictly <= 2 items on left) */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-[190px] min-w-[190px] max-w-[190px] flex items-center gap-2.5 flex-shrink-0 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xl font-semibold tracking-tight text-[var(--text-primary)] leading-none">
              AI Tutor
            </span>
            <div className="w-12 h-5 flex items-center flex-shrink-0">
              {isMounted && isMockMode() && (
                <span
                  id="demo-mode-badge"
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--violet-soft)] text-[var(--secondary-violet)] border border-[var(--secondary-violet)]/30 inline-block"
                >
                  Demo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Context Chip (Subject Color Coded: Teal for Science, Violet for Social Science) */}
        <GazeButton
          id="header-change-board-btn"
          onClick={onChangeBoardSubject}
          label={chipSubjectText}
          icon={isScience ? <Atom className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
          variant="card"
          size="compact"
          progressType="bar"
          className={`!h-9 !min-h-[36px] !max-h-[36px] !w-[145px] !min-w-[145px] !max-w-[145px] !px-3 !py-1 text-xs font-semibold rounded-full border ${subjectChipStyle}`}
        />
      </div>

      {/* 2. Compact Group of Status Indicators (Reserved slot, hidden in Focus Mode) */}
      <div
        className={`hidden md:flex items-center gap-1.5 relative flex-shrink-0 ${
          focusMode ? "invisible pointer-events-none" : ""
        }`}
      >
        <div
          className="flex items-center gap-1.5 bg-[var(--bg-surface-2)] p-1 rounded-full border border-[var(--border-subtle)]"
        >
          <StatusPill
            id="status-server-pill"
            icon={<Server className="w-3 h-3" />}
            label={serverStatus.short}
            value={serverStatus.detail}
            variant={serverStatus.variant}
            onClick={() => {
              if (backendStatus === "disconnected" && onRefreshHealth) {
                onRefreshHealth();
              } else {
                setIsStatusPopoverOpen((prev) => !prev);
              }
            }}
          />
          <StatusPill
            id="status-camera-pill"
            icon={<Camera className="w-3 h-3" />}
            label={cameraStatus.short}
            value={cameraStatus.detail}
            variant={cameraStatus.variant}
            onClick={() => setIsStatusPopoverOpen((prev) => !prev)}
          />
          <StatusPill
            id="status-eye-pill"
            icon={<Eye className="w-3 h-3" />}
            label={eyeStatus.short}
            value={eyeStatus.detail}
            variant={eyeStatus.variant}
            onClick={() => setIsStatusPopoverOpen((prev) => !prev)}
          />
          <StatusPill
            id="status-mic-pill"
            icon={<Mic className="w-3 h-3" />}
            label={micStatus.short}
            value={micStatus.detail}
            variant={micStatus.variant}
            onClick={() => setIsStatusPopoverOpen((prev) => !prev)}
          />
        </div>

        {/* Status Popover Modal */}
        {isStatusPopoverOpen && (
          <div
            id="status-diagnostics-popover"
            className="absolute top-12 left-1/2 -translate-x-1/2 w-80 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-xl z-50 space-y-3 calm-fade"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <h2 className="font-semibold text-sm text-[var(--text-primary)]">System Diagnostics</h2>
              <button
                type="button"
                onClick={() => setIsStatusPopoverOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close status popover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-2)]">
                <span className="font-medium">Backend Server</span>
                <span className="font-semibold">{serverStatus.detail}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-2)]">
                <span className="font-medium">Camera Feed</span>
                <span className="font-semibold">{cameraStatus.detail}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-2)]">
                <span className="font-medium">Gaze Tracking</span>
                <span className="font-semibold">{eyeStatus.detail}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-2)]">
                <span className="font-medium">Voice Input</span>
                <span className="font-semibold">{micStatus.detail}</span>
              </div>
            </div>
            {onRefreshHealth && (
              <button
                type="button"
                onClick={() => {
                  onRefreshHealth();
                  setIsStatusPopoverOpen(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[var(--primary-hover)]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Right: Pause/Resume, Privacy & Menu Button (Total <= 5 controls in header) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Pause / Resume Eye Control Button */}
        <GazeButton
          id="gaze-pause-toggle-btn"
          onClick={onTogglePauseEye}
          label={isEyePaused ? "Resume Eyes" : "Pause Eyes"}
          icon={isEyePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          priority={950}
          variant={isEyePaused ? "active" : "outline"}
          size="compact"
          progressType="bar"
          className="!h-9 !min-h-[36px] !max-h-[36px] !w-[140px] !min-w-[140px] !max-w-[140px] !px-3 !py-1 text-xs font-semibold"
        />

        {/* Privacy Button */}
        <GazeButton
          id="header-privacy-btn"
          onClick={onOpenPrivacy}
          label="Privacy"
          icon={<Shield className="w-4 h-4 text-[var(--accent-teal)]" />}
          variant="card"
          size="compact"
          progressType="bar"
          className="!h-9 !min-h-[36px] !max-h-[36px] !w-[105px] !min-w-[105px] !max-w-[105px] !px-3 !py-1 text-xs font-semibold"
        />

        {/* Menu Button (Opens Settings Drawer containing Settings, Privacy, Eye Setup, Recalibrate, Set center) */}
        <GazeButton
          id="header-settings-btn"
          onClick={onOpenSettings}
          label="Menu"
          icon={<Menu className="w-4 h-4" />}
          variant="card"
          size="compact"
          progressType="bar"
          className="!h-9 !min-h-[36px] !max-h-[36px] !w-[95px] !min-w-[95px] !max-w-[95px] !px-3 !py-1 text-xs font-semibold"
        />
      </div>
    </header>
  );
}
