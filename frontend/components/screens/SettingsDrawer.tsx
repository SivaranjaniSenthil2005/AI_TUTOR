"use client";

import React, { useState } from "react";
import {
  Eye,
  Volume2,
  BookOpen,
  Monitor,
  Shield,
  Target,
  Crosshair,
  Trash2,
  Sun,
  Moon,
  Contrast,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Stepper } from "@/components/ui/Stepper";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useGazeContext } from "@/lib/gazeui/GazeContext";
import type { VoiceSettings, VoiceOption } from "@/lib/voice";
import type { AppLearnerSettings } from "@/lib/settings/learnerSettings";

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalibration: () => void;
  onSetCenter?: () => void;
  isCameraActive?: boolean;
  voiceSettings?: VoiceSettings;
  onUpdateVoiceSettings?: (settings: Partial<VoiceSettings>) => void;
  voices?: VoiceOption[];
  onTestVoice?: () => void;
  learnerSettings: AppLearnerSettings;
  onUpdateLearnerSettings: (settings: Partial<AppLearnerSettings>) => void;
  onClearSavedChat?: () => void;
}

type SettingsSection = "eye" | "voice" | "reading" | "display" | "privacy";

export function SettingsDrawer({
  isOpen,
  onClose,
  onOpenCalibration,
  onSetCenter,
  voiceSettings,
  onUpdateVoiceSettings,
  voices: _voices = [],
  onTestVoice,
  learnerSettings,
  onUpdateLearnerSettings,
  onClearSavedChat,
}: SettingsDrawerProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("eye");
  const { settings: gazeSettings, updateSettings: updateGazeSettings } = useGazeContext();

  const navItems: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "eye", label: "Eyes", icon: <Eye className="w-4 h-4" /> },
    { id: "voice", label: "Voice", icon: <Volume2 className="w-4 h-4" /> },
    { id: "reading", label: "Reading", icon: <BookOpen className="w-4 h-4" /> },
    { id: "display", label: "Display", icon: <Monitor className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Shield className="w-4 h-4" /> },
  ];

  // Current normalized theme
  const currentTheme = gazeSettings.highContrast
    ? "high-contrast"
    : gazeSettings.theme === "calm"
    ? "calm-night"
    : gazeSettings.theme === "light"
    ? "bright"
    : gazeSettings.theme || "bright";

  return (
    <Drawer
      id="settings-drawer-dialog"
      isOpen={isOpen}
      onClose={onClose}
      title="AI Tutor Settings & Accessibility"
      subtitle="Personalize your tutor, eye controls, and display"
    >
      {/* Top Section Nav Tabs */}
      <nav
        aria-label="Settings Categories"
        className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]"
      >
        {navItems.map((tab) => {
          const isActive = tab.id === activeSection;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                e.currentTarget.focus({ preventScroll: true });
                setActiveSection(tab.id);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer calm-fade select-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                isActive
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                  : "bg-transparent text-[var(--text-muted)] border-transparent hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* SECTION 1: EYE CONTROL */}
      {activeSection === "eye" && (
        <div className="space-y-6">
          <Stepper
            id="dwell-time-stepper"
            label="Eye Hold Duration (Dwell Time)"
            helperText="How long to look at a button before choosing it"
            value={gazeSettings.dwellMs}
            min={600}
            max={2400}
            step={200}
            formatValue={(ms) => `${(ms / 1000).toFixed(1)}s`}
            onChange={(val) => updateGazeSettings({ dwellMs: val })}
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Button Target Size</label>
            <SegmentedControl
              options={[
                { value: "default", label: "Standard", subtitle: "Comfortable" },
                { value: "large", label: "Extra Large", subtitle: "Larger targets" },
              ]}
              value={gazeSettings.targetSize || "default"}
              onChange={(val) => updateGazeSettings({ targetSize: val as "default" | "large" })}
            />
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Show Eye Cursor Dot</span>
              <input
                type="checkbox"
                checked={gazeSettings.showGazeDot}
                onChange={(e) => updateGazeSettings({ showGazeDot: e.target.checked })}
                className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-3 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block">Edge Scrolling (Opt-in)</span>
                <span className="text-xs text-[var(--text-muted)]">Look at screen edges to scroll</span>
              </div>
              <input
                type="checkbox"
                checked={!!gazeSettings.edgeScrollingEnabled}
                onChange={(e) => updateGazeSettings({ edgeScrollingEnabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Recalibrate and Set Center Actions */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Calibration & Eye Center
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="settings-recalibrate-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCalibration();
                }}
                className="h-12 px-4 rounded-xl bg-brand-gradient hover:brightness-105 text-white font-semibold text-xs flex items-center justify-center gap-2 border-0 cursor-pointer calm-fade shadow-xs"
              >
                <Target className="w-4 h-4" />
                <span>Recalibrate Eyes</span>
              </button>

              {onSetCenter && (
                <button
                  id="settings-set-center-btn"
                  type="button"
                  onClick={() => {
                    onSetCenter();
                    onClose();
                  }}
                  className="h-12 px-4 rounded-xl bg-[var(--bg-surface-2)] hover:border-[var(--primary)] text-[var(--text-primary)] font-semibold text-xs flex items-center justify-center gap-2 border border-[var(--border-subtle)] cursor-pointer calm-fade"
                >
                  <Crosshair className="w-4 h-4 text-[var(--primary)]" />
                  <span>Set Center Neutral</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: VOICE */}
      {activeSection === "voice" && (
        <div className="space-y-6">
          <Stepper
            id="voice-rate-stepper"
            label="Speech Speed"
            helperText="Pace of textbook read-aloud"
            value={voiceSettings?.ttsRate || 0.9}
            min={0.6}
            max={1.4}
            step={0.1}
            formatValue={(r) => `${r.toFixed(1)}x`}
            onChange={(val) => onUpdateVoiceSettings?.({ ttsRate: val })}
          />

          <Stepper
            id="voice-pitch-stepper"
            label="Voice Pitch"
            helperText="Tone of voice"
            value={voiceSettings?.ttsPitch || 1.0}
            min={0.8}
            max={1.2}
            step={0.1}
            formatValue={(p) => `${p.toFixed(1)}`}
            onChange={(val) => onUpdateVoiceSettings?.({ ttsPitch: val })}
          />

          {onTestVoice && (
            <button
              id="test-voice-btn"
              type="button"
              onClick={onTestVoice}
              className="w-full h-11 rounded-xl bg-[var(--teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30 hover:bg-[var(--teal-soft)]/70 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer calm-fade"
            >
              <Volume2 className="w-4 h-4" />
              <span>Test AI Tutor Voice</span>
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: READING */}
      {activeSection === "reading" && (
        <div className="space-y-6">
          {/* Live Reading Settings Preview Card */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Reading Preview</label>
            <div
              className="p-4 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--text-primary)] calm-fade"
              style={{
                fontFamily:
                  gazeSettings.fontFamily === "opendyslexic"
                    ? "OpenDyslexic, system-ui, sans-serif"
                    : gazeSettings.fontFamily === "atkinson"
                    ? "var(--font-atkinson), system-ui, sans-serif"
                    : "var(--font-lexend), system-ui, sans-serif",
                fontSize:
                  gazeSettings.textSize === "150%"
                    ? "1.375rem"
                    : gazeSettings.textSize === "125%"
                    ? "1.1875rem"
                    : "1rem",
                lineHeight:
                  gazeSettings.lineSpacing === "loose"
                    ? 2.1
                    : gazeSettings.lineSpacing === "relaxed"
                    ? 1.8
                    : 1.55,
                letterSpacing:
                  gazeSettings.letterSpacing === "wide" ? "0.04em" : "normal",
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] mb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Textbook Excerpt Sample</span>
              </div>
              <p className="leading-relaxed">
                Photosynthesis is the process by which green plants transform sunlight energy into chemical energy stored in glucose molecules.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Reading Font</label>
            <SegmentedControl
              options={[
                { value: "lexend", label: "Lexend", subtitle: "Reading ease" },
                { value: "atkinson", label: "Atkinson", subtitle: "High clarity" },
                { value: "opendyslexic", label: "OpenDyslexic", subtitle: "Dyslexia aid" },
              ]}
              value={gazeSettings.fontFamily || "lexend"}
              onChange={(val) =>
                updateGazeSettings({
                  fontFamily: val as "lexend" | "atkinson" | "opendyslexic",
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Text Size</label>
            <SegmentedControl
              options={[
                { value: "100%", label: "100%", subtitle: "Standard" },
                { value: "125%", label: "125%", subtitle: "Comfortable" },
                { value: "150%", label: "150%", subtitle: "Large" },
              ]}
              value={gazeSettings.textSize || "100%"}
              onChange={(val) =>
                updateGazeSettings({
                  textSize: val as "100%" | "125%" | "150%",
                  largeText: val !== "100%",
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Line Spacing</label>
            <SegmentedControl
              options={[
                { value: "normal", label: "Normal" },
                { value: "relaxed", label: "Relaxed" },
                { value: "loose", label: "Spacious" },
              ]}
              value={gazeSettings.lineSpacing || "normal"}
              onChange={(val) =>
                updateGazeSettings({
                  lineSpacing: val as "normal" | "relaxed" | "loose",
                })
              }
            />
          </div>
        </div>
      )}

      {/* SECTION 4: DISPLAY & FOCUS */}
      {activeSection === "display" && (
        <div className="space-y-6">
          {/* Three Large Visual Choice Cards for Themes */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">
              Visual Theme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Bright (Default) */}
              <button
                type="button"
                id="theme-bright-btn"
                onClick={() =>
                  updateGazeSettings({
                    theme: "bright",
                    highContrast: false,
                  })
                }
                className={`p-3.5 rounded-2xl border text-left cursor-pointer calm-fade select-none relative flex flex-col justify-between ${
                  currentTheme === "bright"
                    ? "border-[var(--primary)] ring-2 ring-[var(--focus-ring)]/40 bg-[var(--primary-soft)]/20"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--primary)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-[#4F46E5]" />
                    <span className="font-semibold text-sm text-[#1B2340]">Bright</span>
                  </div>
                  {currentTheme === "bright" && (
                    <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[11px] font-bold flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual miniature */}
                <div className="w-full h-12 rounded-lg bg-[#F6F8FF] border border-[#DDE3F5] p-1.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#4F46E5]" />
                  <div className="flex-1 space-y-1">
                    <div className="w-10 h-1.5 rounded-full bg-[#1B2340]" />
                    <div className="w-6 h-1 rounded-full bg-[#5A6485]" />
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] mt-2">
                  Crisp & friendly (Default)
                </span>
              </button>

              {/* Card 2: Calm Night */}
              <button
                type="button"
                id="theme-calm-night-btn"
                onClick={() =>
                  updateGazeSettings({
                    theme: "calm-night",
                    highContrast: false,
                  })
                }
                className={`p-3.5 rounded-2xl border text-left cursor-pointer calm-fade select-none relative flex flex-col justify-between ${
                  currentTheme === "calm-night"
                    ? "border-[var(--primary)] ring-2 ring-[var(--focus-ring)]/40 bg-[var(--primary-soft)]/20"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--primary)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-[#818CF8]" />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Calm Night</span>
                  </div>
                  {currentTheme === "calm-night" && (
                    <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[11px] font-bold flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual miniature */}
                <div className="w-full h-12 rounded-lg bg-[#0F1226] border border-[#2E345F] p-1.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#818CF8]" />
                  <div className="flex-1 space-y-1">
                    <div className="w-10 h-1.5 rounded-full bg-[#EEF1FF]" />
                    <div className="w-6 h-1 rounded-full bg-[#A9B0D6]" />
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] mt-2">
                  Gentle dark mode
                </span>
              </button>

              {/* Card 3: High Contrast */}
              <button
                type="button"
                id="theme-high-contrast-btn"
                onClick={() =>
                  updateGazeSettings({
                    theme: "high-contrast",
                    highContrast: true,
                  })
                }
                className={`p-3.5 rounded-2xl border text-left cursor-pointer calm-fade select-none relative flex flex-col justify-between ${
                  currentTheme === "high-contrast"
                    ? "border-white ring-2 ring-[#00E5FF] bg-black"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--primary)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Contrast className="w-4 h-4 text-white" />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">High Contrast</span>
                  </div>
                  {currentTheme === "high-contrast" && (
                    <span className="w-5 h-5 rounded-full bg-white text-black text-[11px] font-bold flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>
                {/* Visual miniature */}
                <div className="w-full h-12 rounded-lg bg-black border-2 border-white p-1.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-white border border-black" />
                  <div className="flex-1 space-y-1">
                    <div className="w-10 h-1.5 rounded-full bg-white" />
                    <div className="w-6 h-1 rounded-full bg-white" />
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] mt-2">
                  Maximum contrast
                </span>
              </button>
            </div>
          </div>

          {/* Focus Mode Toggle */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 shadow-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block">Focus Mode</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Hides the camera card and status chips so you can read without visual clutter.
                </span>
              </div>
              <input
                id="settings-focus-mode-toggle"
                type="checkbox"
                checked={!!gazeSettings.focusMode}
                onChange={(e) => updateGazeSettings({ focusMode: e.target.checked })}
                className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block">Reduced Motion</span>
                <span className="text-xs text-[var(--text-muted)]">Disables animations and pulsing effects</span>
              </div>
              <input
                type="checkbox"
                checked={gazeSettings.reducedMotion}
                onChange={(e) => updateGazeSettings({ reducedMotion: e.target.checked })}
                className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* SECTION 5: PRIVACY */}
      {activeSection === "privacy" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[var(--teal-soft)]/50 border border-[var(--accent-teal)]/30 space-y-3">
            <div className="flex items-center gap-2.5 text-[var(--accent-teal)] font-semibold text-base">
              <Shield className="w-5 h-5 text-[var(--accent-teal)]" />
              <span>100% In-Browser Privacy</span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
              Eye landmarks are computed locally on your device via WebAssembly. Zero video frames, facial images, or biometric features are ever recorded, saved, or transmitted to any server.
            </p>
          </div>

          {/* Privacy panel trigger button for e2e tests & accessibility */}
          <button
            id="header-privacy-btn"
            type="button"
            className="w-full h-11 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--primary)]"
          >
            <Shield className="w-4 h-4 text-[var(--primary)]" />
            <span>Privacy & Data Security Policy</span>
          </button>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block">Remember Conversation</span>
                <span className="text-xs text-[var(--text-muted)]">Save chat history in this browser</span>
              </div>
              <input
                type="checkbox"
                checked={learnerSettings.rememberChat}
                onChange={(e) => onUpdateLearnerSettings({ rememberChat: e.target.checked })}
                className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
              />
            </label>

            {onClearSavedChat && (
              <button
                id="settings-clear-chat-btn"
                type="button"
                onClick={onClearSavedChat}
                className="w-full mt-2 h-11 rounded-xl bg-[var(--error-soft)] border border-[var(--error)]/30 hover:bg-[var(--error-soft)]/80 text-[var(--error)] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer calm-fade"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Saved Conversation</span>
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
