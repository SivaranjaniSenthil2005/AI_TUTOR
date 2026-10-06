"use client";

import React from "react";
import { GazeButton } from "@/components/gaze/GazeButton";
import { ReadAlongText } from "./ReadAlongText";
import type { UseSpeechSynthesisReturn } from "@/hooks/useSpeechSynthesis";
import type { ChatMessage } from "./AskView";

export interface ListenViewProps {
  latestTutorMessage: ChatMessage | null;
  tts: UseSpeechSynthesisReturn;
  onGoToAsk: () => void;
}

const SPEED_STEPS = [0.7, 0.9, 1.0, 1.2, 1.4];

export function ListenView({
  latestTutorMessage,
  tts,
  onGoToAsk,
}: ListenViewProps) {
  const currentSpeed = tts.settings.ttsRate;

  const handleSlower = () => {
    const currentIndex = SPEED_STEPS.indexOf(currentSpeed);
    if (currentIndex > 0) {
      tts.updateSettings({ ttsRate: SPEED_STEPS[currentIndex - 1] });
    } else if (currentSpeed > 0.6) {
      tts.updateSettings({ ttsRate: Math.max(0.6, Number((currentSpeed - 0.1).toFixed(1))) });
    }
  };

  const handleFaster = () => {
    const currentIndex = SPEED_STEPS.indexOf(currentSpeed);
    if (currentIndex >= 0 && currentIndex < SPEED_STEPS.length - 1) {
      tts.updateSettings({ ttsRate: SPEED_STEPS[currentIndex + 1] });
    } else if (currentSpeed < 1.5) {
      tts.updateSettings({ ttsRate: Math.min(1.5, Number((currentSpeed + 0.1).toFixed(1))) });
    }
  };

  const handleCycleVoice = () => {
    if (tts.voices.length === 0) return;
    const currentIdx = tts.voices.findIndex((v) => v.voiceURI === tts.settings.ttsVoiceURI);
    const nextIdx = (currentIdx + 1) % tts.voices.length;
    tts.updateSettings({ ttsVoiceURI: tts.voices[nextIdx].voiceURI });
  };

  const currentVoiceObj = tts.voices.find((v) => v.voiceURI === tts.settings.ttsVoiceURI);
  const voiceDisplayName = currentVoiceObj
    ? `${currentVoiceObj.name} (${currentVoiceObj.lang})`
    : "System Default English Voice";

  const handlePlayLatest = () => {
    if (latestTutorMessage) {
      tts.speak(latestTutorMessage.text);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Audio Center Overview */}
      <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🔊</span> Audio & Speech Center
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-amber-300 mt-0.5">
            Paced text-to-speech with high-contrast read-along highlighting
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#0d1527] px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">
          <span>Current Speed:</span>
          <span className="text-amber-300 font-extrabold">{currentSpeed.toFixed(1)}x</span>
        </div>
      </div>

      {/* 2. Latest Message Reader or Empty State */}
      {latestTutorMessage ? (
        <div className="bg-[#0b1120] border-4 border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800 text-xs font-black uppercase tracking-wider text-slate-400">
            <span className="text-amber-300">Latest Explanation</span>
            <span>{new Date(latestTutorMessage.timestamp).toLocaleTimeString()}</span>
          </div>

          {/* Large Read-Along Text Body */}
          <div className="bg-[#070b14] border-2 border-slate-800 rounded-2xl p-6 shadow-inner">
            <ReadAlongText
              text={latestTutorMessage.text}
              isSpeaking={tts.speaking}
              currentCharIndex={tts.currentCharIndex}
              currentSentenceIndex={tts.currentSentenceIndex}
              className="text-xl sm:text-2xl font-semibold !leading-relaxed text-slate-100"
            />
          </div>

          {/* Large Playback Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!tts.speaking ? (
              <GazeButton
                id="listen-play-btn"
                onClick={handlePlayLatest}
                label="Read Aloud"
                icon="🔊"
                variant="accent"
                size="large"
                className="!min-h-[76px]"
              />
            ) : (
              <>
                <GazeButton
                  id="listen-pause-resume-btn"
                  onClick={tts.paused ? tts.resume : tts.pause}
                  label={tts.paused ? "Resume Audio" : "Pause Audio"}
                  icon={tts.paused ? "▶️" : "⏸️"}
                  variant="accent"
                  size="large"
                  className="!min-h-[76px]"
                />
                <GazeButton
                  id="listen-stop-btn"
                  onClick={tts.stop}
                  label="Stop Audio"
                  icon="⏹️"
                  variant="danger"
                  size="large"
                  className="!min-h-[76px]"
                />
              </>
            )}

            <GazeButton
              id="listen-goto-ask-btn"
              onClick={onGoToAsk}
              label="Ask Another Question"
              icon="💬"
              variant="card"
              size="large"
              className="!min-h-[76px]"
            />
          </div>
        </div>
      ) : (
        <div className="bg-[#0f172a] border-3 border-dashed border-slate-700 rounded-3xl p-10 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-cyan-400/20 border border-cyan-400/50 flex items-center justify-center text-4xl mx-auto text-cyan-300">
            💬
          </div>
          <h4 className="text-2xl font-black text-white">No Tutor Answer Ready Yet</h4>
          <p className="text-base text-slate-300 max-w-md mx-auto">
            Ask a question in the Ask screen to have textbook explanations read aloud with synchronized highlight!
          </p>
          <GazeButton
            id="empty-listen-goto-ask-btn"
            onClick={onGoToAsk}
            label="Go to Ask Mode"
            icon="🎙️"
            variant="accent"
            size="large"
            className="max-w-xs mx-auto"
          />
        </div>
      )}

      {/* 3. Audio & Voice Customization Section */}
      <div className="bg-[#131f38] border-2 border-slate-700 rounded-3xl p-6 space-y-4">
        <h4 className="text-lg font-black text-white flex items-center gap-2">
          <span>⚙️</span> Speech Pacing & Voice Customization
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Speed Adjusters */}
          <div className="bg-[#0d1527] p-4 rounded-2xl border border-slate-700 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                Speech Rate ({currentSpeed.toFixed(1)}x)
              </span>
              <p className="text-xs text-slate-300">
                Adjust speed for comfortable auditory comprehension.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <GazeButton
                id="speed-slower-btn"
                onClick={handleSlower}
                label="Slower 🐢"
                variant="card"
                size="compact"
                disabled={currentSpeed <= 0.6}
                className="!min-h-[52px] text-xs justify-center"
              />
              <GazeButton
                id="speed-faster-btn"
                onClick={handleFaster}
                label="Faster 🐇"
                variant="card"
                size="compact"
                disabled={currentSpeed >= 1.4}
                className="!min-h-[52px] text-xs justify-center"
              />
            </div>
          </div>

          {/* Voice Switcher */}
          <div className="bg-[#0d1527] p-4 rounded-2xl border border-slate-700 flex flex-col justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                Active English Voice
              </span>
              <p className="text-xs text-amber-300 font-bold truncate">
                {voiceDisplayName}
              </p>
            </div>
            <GazeButton
              id="cycle-voice-btn"
              onClick={handleCycleVoice}
              label="Change Voice 🔄"
              variant="card"
              size="compact"
              disabled={tts.voices.length <= 1}
              className="!min-h-[52px] text-xs justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
