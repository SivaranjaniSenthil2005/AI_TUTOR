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
      className="h-28 w-full max-w-full border-t-2 border-slate-800 bg-[#0d1527] px-4 sm:px-6 py-3 select-none flex-shrink-0 z-20 shadow-2xl flex items-center overflow-clip"
    >
      <div className="w-full grid grid-cols-4 gap-4 items-center h-full">
        {/* 1. Ask with Voice (Primary Action, Largest) */}
        <div className="h-full flex items-center">
          <GazeButton
            id="dock-ask-voice-btn"
            onClick={onAskWithVoice}
            label={isListening ? "Listening..." : "Ask with Voice"}
            subtitle={isListening ? "Speak now" : "Speak your question"}
            icon={<Mic className="w-6 h-6 sm:w-7 sm:h-7" />}
            variant={isListening ? "active" : "primary"}
            size="xl"
            disabled={isThinking}
            className="w-full !h-full font-black text-slate-950 !border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.35)]"
          />
        </div>

        {/* 2. Type a Question */}
        <div className="h-full flex items-center">
          <GazeButton
            id="dock-type-question-btn"
            onClick={onTypeQuestion}
            label="Type Question"
            subtitle="Keyboard input"
            icon={<Keyboard className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />}
            variant="card"
            size="large"
            disabled={isThinking}
            className="w-full !h-full font-extrabold"
          />
        </div>

        {/* 3. Read Aloud (In-place Swap for Audio Playback) */}
        <div className="h-full flex items-center">
          {!isSpeaking ? (
            <GazeButton
              id="dock-read-aloud-btn"
              onClick={onReadAloud}
              label="Read Aloud"
              subtitle={hasAnswerToRead ? "Listen to tutor" : "Available on answer"}
              icon={<Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />}
              variant="card"
              size="large"
              disabled={!hasAnswerToRead || isThinking}
              className="w-full !h-full font-extrabold"
            />
          ) : (
            <div className="w-full h-full grid grid-cols-2 gap-2">
              <GazeButton
                id="dock-pause-resume-btn"
                onClick={onPauseResumeAudio || onReadAloud}
                label={isAudioPaused ? "Resume" : "Pause"}
                icon={isAudioPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                variant="accent"
                size="compact"
                className="w-full !h-full font-extrabold"
              />
              <GazeButton
                id="dock-stop-audio-btn"
                onClick={onStopAudio || onReadAloud}
                label="Stop"
                icon={<Square className="w-5 h-5" />}
                variant="danger"
                size="compact"
                className="w-full !h-full font-extrabold"
              />
            </div>
          )}
        </div>

        {/* 4. Explain Differently (Mode Picker) */}
        <div className="h-full flex items-center">
          <GazeButton
            id="dock-explain-mode-btn"
            onClick={onExplainDifferently}
            label="Explain Differently"
            subtitle={`Mode: ${modeLabel}`}
            tag={modeLabel}
            icon={<Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />}
            variant="card"
            size="large"
            disabled={isThinking}
            className="w-full !h-full font-extrabold"
          />
        </div>
      </div>
    </nav>
  );
});
