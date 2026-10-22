"use client";

import React from "react";
import { GazeButton } from "./GazeButton";

export interface PrivacyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPanel({ isOpen, onClose }: PrivacyPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-[9996] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[var(--bg-surface)] border-4 border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-auto">
        <div className="flex items-center justify-between pb-4 border-b-2 border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label="Privacy Shield">
              🛡️
            </span>
            <div>
              <h2
                id="privacy-modal-title"
                className="text-2xl font-black text-[var(--text-primary)] tracking-tight"
              >
                Privacy & Data Security
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[var(--text-muted)]">
                AI Tutor is built with privacy-first standards for students
              </p>
            </div>
          </div>
          <GazeButton
            id="close-privacy-btn"
            onClick={onClose}
            label="Close"
            icon="✕"
            variant="outline"
            size="compact"
            priority={100}
            className="!min-h-[48px] !py-2 !px-4"
          />
        </div>

        <div className="space-y-4 text-[var(--text-primary)] text-sm sm:text-base leading-relaxed">
          <div className="p-4 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] space-y-1">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>👁️</span> Camera & Eye Tracking
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Camera video stays 100% in your browser. Video frames are processed locally by MediaPipe to detect facial landmarks and iris position. No video or images ever leave your device or reach any server.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] space-y-1">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>🎙️</span> Voice Input & Speech Recognition
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Speech-to-text uses the standard Web Speech API. Browsers like Google Chrome or Microsoft Edge may process voice audio through their platform speech service. Audio is never stored or recorded by AI Tutor.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] space-y-1">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>🧠</span> AI Question Processing
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Your questions are sent to the AI Tutor backend only to search your Class 10 textbook and generate an answer using the configured AI model (Ollama, Gemini, Groq, or Mock).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] space-y-1">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>🧹</span> Stateless by Default
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Nothing is stored on disk or in any database by default. Conversation history disappears when you close or reload the tab, unless you explicitly enable &quot;Remember my chat on this device&quot; in Settings.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <GazeButton
            id="privacy-done-btn"
            onClick={onClose}
            label="Understood"
            icon="✓"
            variant="accent"
            size="compact"
            className="!min-h-[50px] !px-6"
          />
        </div>
      </div>
    </div>
  );
}
