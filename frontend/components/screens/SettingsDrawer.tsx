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
  Sparkles,
  Trash2,
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
  voices = [],
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
        className="grid grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-subtle)]"
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
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer calm-fade select-none border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isActive
                  ? "bg-amber-500 text-white dark:text-slate-950 border-amber-400 font-black shadow-md"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
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
            <label className="text-sm font-bold text-[var(--text-primary)]">Button Target Size</label>
            <SegmentedControl
              options={[
                { value: "default", label: "Standard", subtitle: "88px buttons" },
                { value: "large", label: "Extra Large", subtitle: "104px buttons" },
              ]}
              value={gazeSettings.targetSize || "default"}
              onChange={(val) => updateGazeSettings({ targetSize: val as "default" | "large" })}
            />
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-[var(--text-primary)]">Show Eye Cursor Dot</span>
              <input
                type="checkbox"
                checked={gazeSettings.showGazeDot}
                onChange={(e) => updateGazeSettings({ showGazeDot: e.target.checked })}
                className="w-6 h-6 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-3 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-sm font-bold text-[var(--text-primary)] block">Edge Scrolling (Opt-in)</span>
                <span className="text-xs text-[var(--text-muted)]">Look at edges to scroll (buttons are recommended)</span>
              </div>
              <input
                type="checkbox"
                checked={!!gazeSettings.edgeScrollingEnabled}
                onChange={(e) => updateGazeSettings({ edgeScrollingEnabled: e.target.checked })}
                className="w-6 h-6 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Recalibrate and Set Center Actions */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Accuracy & Calibration
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="settings-recalibrate-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCalibration();
                }}
                className="h-14 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white dark:text-slate-950 font-black text-sm flex items-center justify-center gap-2 border-2 border-amber-400 cursor-pointer calm-fade shadow"
              >
                <Target className="w-5 h-5" />
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
                  className="h-14 px-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center gap-2 border-2 border-[var(--border-strong)] hover:border-amber-500 cursor-pointer calm-fade"
                >
                  <Crosshair className="w-5 h-5 text-amber-700 dark:text-amber-300" />
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

          {voices && voices.length > 0 && (
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] space-y-2">
              <label className="text-sm font-bold text-[var(--text-primary)] block">Choose Tutor Voice</label>
              <select
                value={voiceSettings?.ttsVoiceURI || ""}
                onChange={(e) => onUpdateVoiceSettings?.({ ttsVoiceURI: e.target.value })}
                className="w-full h-12 px-3 rounded-xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] text-[var(--text-primary)] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {onTestVoice && (
            <button
              id="settings-test-voice-btn"
              type="button"
              onClick={onTestVoice}
              className="w-full h-14 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] hover:border-amber-500 text-amber-700 dark:text-amber-300 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer calm-fade"
            >
              <Volume2 className="w-5 h-5" />
              <span>Test Voice Audio</span>
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: READING & COGNITIVE ADAPTATIONS */}
      {activeSection === "reading" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-primary)]">Default Learning Mode</label>
            <SegmentedControl
              options={[
                { value: "simple", label: "Simple", subtitle: "Clear & short" },
                { value: "step_by_step", label: "Steps", subtitle: "Numbered flow" },
                { value: "example", label: "Example", subtitle: "Real scenarios" },
                { value: "exam", label: "Exam Style", subtitle: "Key definitions" },
              ]}
              value={learnerSettings.mode}
              onChange={(val) =>
                onUpdateLearnerSettings({
                  mode: val as AppLearnerSettings["mode"],
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-primary)]">Reading Level</label>
            <SegmentedControl
              options={[
                { value: "easy", label: "Easy", subtitle: "Simple grade vocab" },
                { value: "standard", label: "Standard", subtitle: "Complete textbook" },
              ]}
              value={learnerSettings.reading_level}
              onChange={(val) =>
                onUpdateLearnerSettings({
                  reading_level: val as "easy" | "standard",
                })
              }
            />
          </div>

          <Stepper
            id="max-sentences-stepper"
            label="Maximum Sentences per Answer"
            helperText="Keeps explanations concise and manageable"
            value={learnerSettings.max_sentences}
            min={2}
            max={10}
            step={1}
            unit="sentences"
            onChange={(val) => onUpdateLearnerSettings({ max_sentences: val })}
          />

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-primary)]">Reading Font</label>
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
            <label className="text-sm font-bold text-[var(--text-primary)]">Text Size</label>
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
            <label className="text-sm font-bold text-[var(--text-primary)]">Line Spacing</label>
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
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-primary)]">Visual Theme</label>
            <SegmentedControl
              options={[
                { value: "light", label: "Light", subtitle: "Soft off-white (Standard)" },
                { value: "calm", label: "Calm", subtitle: "Deep navy & amber" },
                { value: "high-contrast", label: "High Contrast", subtitle: "Pure black & yellow" },
              ]}
              value={
                gazeSettings.highContrast
                  ? "high-contrast"
                  : gazeSettings.theme || "light"
              }
              onChange={(val) =>
                updateGazeSettings({
                  theme: val as "calm" | "light" | "high-contrast",
                  highContrast: val === "high-contrast",
                })
              }
            />
          </div>

          {/* Focus Mode Toggle */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-amber-500/50 space-y-2 shadow-sm">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-base font-black text-amber-700 dark:text-amber-300 block">Focus Mode</span>
                <span className="text-xs text-[var(--text-muted)]">
                  Hides the camera preview and status chips so you can read without visual clutter.
                </span>
              </div>
              <input
                id="settings-focus-mode-toggle"
                type="checkbox"
                checked={!!gazeSettings.focusMode}
                onChange={(e) => updateGazeSettings({ focusMode: e.target.checked })}
                className="w-7 h-7 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-[var(--text-primary)] block">Reduced Motion</span>
                <span className="text-xs text-[var(--text-muted)]">Disables animations and pulsing effects</span>
              </div>
              <input
                type="checkbox"
                checked={gazeSettings.reducedMotion}
                onChange={(e) => updateGazeSettings({ reducedMotion: e.target.checked })}
                className="w-6 h-6 accent-amber-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* SECTION 5: PRIVACY */}
      {activeSection === "privacy" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-[#0a1e17] border-2 border-emerald-500/50 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-black text-base">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>100% In-Browser Privacy</span>
            </div>
            <p className="text-sm text-emerald-950 dark:text-emerald-100 leading-relaxed">
              Eye landmarks are computed locally on your device via WebAssembly. Zero video frames, facial images, or biometric features are ever recorded, saved, or transmitted to any server.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-bold text-[var(--text-primary)] block">Remember Conversation</span>
                <span className="text-xs text-[var(--text-muted)]">Save chat history in this browser</span>
              </div>
              <input
                type="checkbox"
                checked={learnerSettings.rememberChat}
                onChange={(e) => onUpdateLearnerSettings({ rememberChat: e.target.checked })}
                className="w-6 h-6 accent-amber-500 rounded cursor-pointer"
              />
            </label>

            {onClearSavedChat && (
              <button
                id="settings-clear-chat-btn"
                type="button"
                onClick={onClearSavedChat}
                className="w-full mt-3 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-400 dark:border-rose-700 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer calm-fade"
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
