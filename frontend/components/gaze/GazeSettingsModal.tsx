"use client";

import React from "react";
import { useGazeContext } from "@/lib/gazeui/GazeContext";
import { GazeButton } from "./GazeButton";
import { globalSoundEffects } from "@/lib/gazeui/sound";
import type { VoiceSettings, VoiceOption } from "@/lib/voice";

export interface GazeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalibration: () => void;
  onSetCenter?: () => void;
  isCameraActive?: boolean;
  voiceSettings?: VoiceSettings;
  onUpdateVoiceSettings?: (settings: Partial<VoiceSettings>) => void;
  voices?: VoiceOption[];
  onTestVoice?: () => void;
}

export function GazeSettingsModal({
  isOpen,
  onClose,
  onOpenCalibration,
  onSetCenter,
  isCameraActive = false,
  voiceSettings,
  onUpdateVoiceSettings,
  voices = [],
  onTestVoice,
}: GazeSettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useGazeContext();

  if (!isOpen) return null;

  const dwellOptions = [
    { ms: 800, label: "Fast (0.8s)" },
    { ms: 1200, label: "Normal (1.2s)" },
    { ms: 1800, label: "Relaxed (1.8s)" },
    { ms: 2400, label: "Careful (2.4s)" },
  ];

  const paddingOptions = [
    { px: 16, label: "Tight (16px)" },
    { px: 24, label: "Standard (24px)" },
    { px: 36, label: "Generous (36px)" },
  ];

  const voiceRateOptions = [
    { rate: 0.7, label: "0.7x Slow" },
    { rate: 0.9, label: "0.9x Normal" },
    { rate: 1.1, label: "1.1x Brisk" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-[9995] bg-[#070b14]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[#0b1120] border-4 border-slate-700 rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl flex flex-col gap-6 my-auto max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label="Settings Cog">
              ⚙️
            </span>
            <div>
              <h2
                id="settings-modal-title"
                className="text-2xl sm:text-3xl font-black text-white tracking-tight"
              >
                Gaze & Voice Accessibility Settings
              </h2>
              <p className="text-sm font-semibold text-amber-300">
                Personalize dwell time, speech speed, voice output, and visual comfort
              </p>
            </div>
          </div>

          <GazeButton
            id="close-settings-btn"
            onClick={onClose}
            label="Close"
            icon="✕"
            variant="outline"
            size="compact"
            priority={100}
            className="!min-h-[50px] !py-2 !px-4"
          />
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Dwell Duration */}
          <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⏱️</span> Dwell Selection Time
              </h3>
              <span className="text-sm font-black text-amber-300 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                {(settings.dwellMs / 1000).toFixed(1)}s
              </span>
            </div>
            <p className="text-xs text-slate-300">
              How long you must look at a button before it activates.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {dwellOptions.map((opt) => (
                <GazeButton
                  key={opt.ms}
                  id={`dwell-opt-${opt.ms}`}
                  onClick={() => updateSettings({ dwellMs: opt.ms })}
                  label={opt.label}
                  variant={settings.dwellMs === opt.ms ? "active" : "card"}
                  size="compact"
                  className="!min-h-[56px] text-xs justify-center"
                />
              ))}
            </div>
          </div>

          {/* Section 2: Hit Area Padding */}
          <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🎯</span> Hit Area Forgiveness
              </h3>
              <span className="text-sm font-black text-amber-300 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                +{settings.hitPadding}px
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Expands target boundaries so slightly imperfect gaze still hits buttons.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {paddingOptions.map((opt) => (
                <GazeButton
                  key={opt.px}
                  id={`padding-opt-${opt.px}`}
                  onClick={() => updateSettings({ hitPadding: opt.px })}
                  label={opt.label}
                  variant={settings.hitPadding === opt.px ? "active" : "card"}
                  size="compact"
                  className="!min-h-[56px] text-xs justify-center"
                />
              ))}
            </div>
          </div>

          {/* Section 3: Voice Input & Output Settings */}
          {voiceSettings && onUpdateVoiceSettings && (
            <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700 flex flex-col gap-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🎙️</span> Voice & Audio Narration Controls
                </h3>
                <span className="text-xs font-bold text-cyan-300 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                  Rate: {voiceSettings.ttsRate}x • {voiceSettings.sttLang}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Speech Pacing Options */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Speech Rate:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {voiceRateOptions.map((v) => (
                      <GazeButton
                        key={v.rate}
                        id={`voice-rate-${v.rate}`}
                        onClick={() => onUpdateVoiceSettings({ ttsRate: v.rate })}
                        label={v.label}
                        variant={voiceSettings.ttsRate === v.rate ? "active" : "card"}
                        size="compact"
                        className="!min-h-[48px] text-[10px] justify-center text-center !p-1"
                      />
                    ))}
                  </div>
                </div>

                {/* Auto-Read Answers Toggle */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Auto-Read Answers:</span>
                  <GazeButton
                    id="toggle-autoread-btn"
                    onClick={() => onUpdateVoiceSettings({ autoRead: !voiceSettings.autoRead })}
                    label={voiceSettings.autoRead ? "Auto-Read: ON 🔊" : "Auto-Read: OFF 🔇"}
                    variant={voiceSettings.autoRead ? "accent" : "outline"}
                    size="compact"
                    className="!min-h-[48px] text-xs justify-center w-full"
                  />
                </div>

                {/* STT Language Toggle */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase">Voice Input Dialect:</span>
                  <GazeButton
                    id="toggle-stt-lang-btn"
                    onClick={() =>
                      onUpdateVoiceSettings({
                        sttLang: voiceSettings.sttLang === "en-IN" ? "en-US" : "en-IN",
                      })
                    }
                    label={voiceSettings.sttLang === "en-IN" ? "English (India) 🇮🇳" : "English (US) 🇺🇸"}
                    variant="card"
                    size="compact"
                    className="!min-h-[48px] text-xs justify-center w-full"
                  />
                </div>
              </div>

              {/* Voice Switcher & Test Audio Row */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <GazeButton
                    id="settings-cycle-voice-btn"
                    onClick={() => {
                      if (voices.length > 0) {
                        const curIdx = voices.findIndex((v) => v.voiceURI === voiceSettings.ttsVoiceURI);
                        const nextIdx = (curIdx + 1) % voices.length;
                        onUpdateVoiceSettings({ ttsVoiceURI: voices[nextIdx].voiceURI });
                      }
                    }}
                    label="Switch English Voice 🔄"
                    variant="card"
                    size="compact"
                    className="!min-h-[46px] text-xs"
                  />
                  {onTestVoice && (
                    <GazeButton
                      id="settings-test-voice-btn"
                      onClick={onTestVoice}
                      label="Test Voice Audio 🔊"
                      variant="secondary"
                      size="compact"
                      className="!min-h-[46px] text-xs text-amber-300"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Audio & Gaze Dot */}
          <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔊</span> UI Sound & Cursor Feedback
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <GazeButton
                id="toggle-sound-btn"
                onClick={() => {
                  const next = !settings.soundEnabled;
                  updateSettings({ soundEnabled: next });
                  if (next) globalSoundEffects.playActivationChime();
                }}
                label={settings.soundEnabled ? "Clicks: ON" : "Clicks: OFF"}
                icon={settings.soundEnabled ? "🔔" : "🔕"}
                variant={settings.soundEnabled ? "accent" : "outline"}
                size="compact"
                className="!min-h-[56px] text-xs"
              />

              <GazeButton
                id="toggle-dot-btn"
                onClick={() => updateSettings({ showGazeDot: !settings.showGazeDot })}
                label={settings.showGazeDot ? "Gaze Dot: ON" : "Gaze Dot: OFF"}
                icon="👁️"
                variant={settings.showGazeDot ? "accent" : "outline"}
                size="compact"
                className="!min-h-[56px] text-xs"
              />
            </div>
          </div>

          {/* Section 5: Visual Accessibility */}
          <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>♿</span> Visual Comfort & Theme
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <GazeButton
                id="toggle-contrast-btn"
                onClick={() => updateSettings({ highContrast: !settings.highContrast })}
                label={settings.highContrast ? "Contrast: HI" : "Contrast: Normal"}
                icon="🌓"
                variant={settings.highContrast ? "accent" : "card"}
                size="compact"
                className="!min-h-[56px] text-xs"
              />

              <GazeButton
                id="toggle-text-btn"
                onClick={() => updateSettings({ largeText: !settings.largeText })}
                label={settings.largeText ? "Text: XL" : "Text: Normal"}
                icon="🔤"
                variant={settings.largeText ? "accent" : "card"}
                size="compact"
                className="!min-h-[56px] text-xs"
              />

              <GazeButton
                id="toggle-motion-btn"
                onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                label={settings.reducedMotion ? "Motion: OFF" : "Motion: ON"}
                icon="🍃"
                variant={settings.reducedMotion ? "accent" : "card"}
                size="compact"
                className="!min-h-[56px] text-xs"
              />
            </div>
          </div>
        </div>

        {/* Calibration & Reset Actions Bar */}
        <div className="pt-4 border-t-2 border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <GazeButton
              id="settings-recalibrate-btn"
              onClick={() => {
                onClose();
                onOpenCalibration();
              }}
              label="Recalibrate Eye Tracker"
              icon="🎯"
              variant="accent"
              size="compact"
              className="!min-h-[54px] text-sm"
            />

            {onSetCenter && isCameraActive && (
              <GazeButton
                id="settings-set-center-btn"
                onClick={onSetCenter}
                label="Quick Set Center"
                icon="📍"
                variant="secondary"
                size="compact"
                className="!min-h-[54px] text-sm"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <GazeButton
              id="reset-settings-btn"
              onClick={resetSettings}
              label="Reset Defaults"
              variant="outline"
              size="compact"
              className="!min-h-[54px] text-sm text-slate-400"
            />

            <GazeButton
              id="settings-done-btn"
              onClick={onClose}
              label="Done"
              icon="✓"
              variant="accent"
              size="compact"
              priority={100}
              className="!min-h-[54px] text-sm font-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
