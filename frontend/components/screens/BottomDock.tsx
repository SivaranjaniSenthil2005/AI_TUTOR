"use client";

import React from "react";
import { Mic, Keyboard, Volume2, Pause, Play, Square, Sparkles } from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";

export interface BottomDockProps {
  onAskWithVoice: () => void;
  onTypeQuestion: () => void;
  onReadAloud: () => void;
  onPauseResumeAudio?: () => void;
  onStopAudio?: () => void;
  onExplainDifferently: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  isAudioPaused: boolean;
  activeMode: string;
  hasAnswerToRead: boolean;
  isThinking: boolean;
}

export const BottomDock = React.memo(function BottomDock({
  onAskWithVoice,
  onTypeQuestion,
  onReadAloud,
  onPauseResumeAudio,
  onStopAudio,
  onExplainDifferently,
  isListening,
  isSpeaking,
  isAudioPaused,
  activeMode,
  hasAnswerToRead,
  isThinking,
}: BottomDockProps) {
  // Mode label formatting
  const modeLabel = {
    simple: "Simple",
    step_by_step: "Steps",
    example: "Example",
    exam: "Exam",
  }[activeMode] || "Simple";

  return (
    <nav
      id="bottom-dock-container"
      aria-label="Primary Learning Controls"
      className="h-28 max-h-28 w-full max-w-full border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-6 py-3 select-none flex-shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex items-center overflow-hidden"
      style={{ boxSizing: "border-box" }}
    >
      <div
        className="w-full h-full grid gap-4 items-center"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          boxSizing: "border-box",
        }}
      >
        {/* 1. Ask with Voice (Primary Action: Brand Gradient, Largest Visual Weight) */}
        <div className="h-full min-w-0 flex items-center">
          <GazeButton
            id="dock-ask-voice-btn"
            onClick={onAskWithVoice}
            label={isListening ? "Listening..." : "Ask with Voice"}
            subtitle={isListening ? "Speak now" : "Use microphone"}
            icon={<Mic className="w-5 h-5 text-white" />}
            variant={isListening ? "active" : "primary"}
            size="large"
            disabled={isThinking}
            className={`w-full !h-full font-semibold min-w-0 ${
              isListening
                ? "!border-[var(--primary)] ring-3 ring-[var(--focus-ring)]/50 !bg-[var(--primary-soft)]"
                : ""
            }`}
          />
        </div>

        {/* 2. Type Question (White Card, Keyboard Icon) */}
        <div className="h-full min-w-0 flex items-center">
          <GazeButton
            id="dock-type-question-btn"
            onClick={onTypeQuestion}
            label="Type"
            subtitle="Use keyboard"
            icon={<Keyboard className="w-5 h-5 text-[var(--primary)]" />}
            variant="card"
            size="large"
            disabled={isThinking}
            className="w-full !h-full font-semibold min-w-0"
          />
        </div>

        {/* 3. Read Aloud (Teal-tinted, Speaker Icon; In-place Swap for Audio Controls) */}
        <div className="h-full min-w-0 flex items-center">
          {!isSpeaking ? (
            <GazeButton
              id="dock-read-aloud-btn"
              onClick={onReadAloud}
              label="Read Aloud"
              subtitle={hasAnswerToRead ? "Listen to tutor" : "When answer ready"}
              icon={<Volume2 className="w-5 h-5 text-[var(--accent-teal)]" />}
              variant="card"
              size="large"
              disabled={!hasAnswerToRead || isThinking}
              className="w-full !h-full font-semibold min-w-0 !bg-[var(--teal-soft)]/40 hover:!bg-[var(--teal-soft)]/70 !border-[var(--accent-teal)]/30"
            />
          ) : (
            <div className="w-full h-full grid grid-cols-2 gap-2 min-w-0">
              <GazeButton
                id="dock-pause-resume-btn"
                onClick={onPauseResumeAudio || onReadAloud}
                label={isAudioPaused ? "Resume" : "Pause"}
                icon={isAudioPaused ? <Play className="w-4 h-4 text-[var(--accent-teal)]" /> : <Pause className="w-4 h-4 text-[var(--accent-teal)]" />}
                variant="card"
                size="compact"
                className="w-full !h-full font-semibold min-w-0 !bg-[var(--teal-soft)]/40 !border-[var(--accent-teal)]/30"
              />
              <GazeButton
                id="dock-stop-audio-btn"
                onClick={onStopAudio || onReadAloud}
                label="Stop"
                icon={<Square className="w-4 h-4 text-[var(--error)]" />}
                variant="danger"
                size="compact"
                className="w-full !h-full font-semibold min-w-0"
              />
            </div>
          )}
        </div>

        {/* 4. Explain Again (Violet-tinted, Mode Chip, Sparkles Icon) */}
        <div className="h-full min-w-0 flex items-center">
          <GazeButton
            id="dock-explain-mode-btn"
            onClick={onExplainDifferently}
            label="Explain Again"
            subtitle={`Mode: ${modeLabel}`}
            tag={modeLabel}
            icon={<Sparkles className="w-5 h-5 text-[var(--secondary-violet)]" />}
            variant="card"
            size="large"
            disabled={isThinking}
            className="w-full !h-full font-semibold min-w-0 !bg-[var(--violet-soft)]/40 hover:!bg-[var(--violet-soft)]/70 !border-[var(--secondary-violet)]/30"
          />
        </div>
      </div>
    </nav>
  );
});
