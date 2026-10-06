"use client";

import React, { useState } from "react";
import { GazeButton } from "@/components/gaze/GazeButton";
import { ReadAlongText } from "./ReadAlongText";
import type { UseSpeechRecognitionReturn } from "@/hooks/useSpeechRecognition";
import type { UseSpeechSynthesisReturn } from "@/hooks/useSpeechSynthesis";

export interface ChatMessage {
  id: string;
  role: "user" | "tutor";
  text: string;
  timestamp: number;
  wasVoice?: boolean;
}

export interface AskViewProps {
  messages: ChatMessage[];
  onAskQuestion: (question: string, wasVoice: boolean) => void;
  isThinking: boolean;
  stt: UseSpeechRecognitionReturn;
  tts: UseSpeechSynthesisReturn;
  activeSpeakingId: string | null;
  onSpeakMessage: (id: string, text: string) => void;
  onStopSpeaking: () => void;
  tutorContext?: { board?: string; className?: string; subject?: string };
}

const PRIVACY_DISMISS_KEY = "ai_tutor_stt_privacy_dismissed";

export function AskView({
  messages,
  onAskQuestion,
  isThinking,
  stt,
  tts,
  activeSpeakingId,
  onSpeakMessage,
  onStopSpeaking,
  tutorContext,
}: AskViewProps) {
  const [typedInput, setTypedInput] = useState<string>("");
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(PRIVACY_DISMISS_KEY) !== "true";
      } catch {}
    }
    return true;
  });

  // Candidate transcript ready for confirmation
  const candidateTranscript = stt.transcript.trim();
  const hasPendingConfirmation = candidateTranscript.length > 0 && stt.state !== "listening";

  const handleDismissPrivacy = () => {
    setShowPrivacyNotice(false);
    try {
      localStorage.setItem(PRIVACY_DISMISS_KEY, "true");
    } catch {}
  };

  const handleConfirmYes = () => {
    if (candidateTranscript) {
      onAskQuestion(candidateTranscript, true);
      stt.reset();
    }
  };

  const handleConfirmRetry = () => {
    stt.reset();
    stt.start();
  };

  const handleConfirmCancel = () => {
    stt.reset();
  };

  const handleTypedSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (typedInput.trim()) {
      onAskQuestion(typedInput.trim(), false);
      setTypedInput("");
    }
  };

  const sampleQuestions = [
    "Explain photosynthesis in plants",
    "What is the Pythagorean theorem?",
    "Describe Newton's laws of motion",
  ];

  return (
    <div className="space-y-6">
      {/* 1. Browser Speech Service Privacy Notice (Dismissible once) */}
      {showPrivacyNotice && (
        <div className="bg-[#131f38] border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl" role="img" aria-label="Privacy Shield">
              🛡️
            </span>
            <div>
              <h4 className="text-base font-black text-white">Voice Privacy & Browser Support</h4>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                AI Tutor uses standard Web Speech APIs. Your browser (Chrome/Edge) may process speech via its secure cloud recognition. Text-to-speech runs 100% locally. We do not store or record your voice.
              </p>
            </div>
          </div>
          <GazeButton
            id="dismiss-voice-privacy-btn"
            onClick={handleDismissPrivacy}
            label="I Understand"
            variant="accent"
            size="compact"
            className="!min-h-[48px] !py-2 !px-4 text-xs font-bold whitespace-nowrap"
          />
        </div>
      )}

      {/* 2. Active Voice Listening State */}
      {stt.state === "listening" && (
        <div className="bg-gradient-to-br from-[#131f38] via-[#0d1527] to-[#131f38] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center shadow-2xl animate-pulse">
          <div className="relative w-24 h-24 rounded-full bg-amber-400/20 border-4 border-amber-400 flex items-center justify-center text-4xl mb-4 text-amber-300 shadow-[0_0_30px_#fbbf24]">
            🎤
            <span className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-50" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
            I&apos;m listening... Speak your question!
          </h3>
          <p className="text-sm font-bold text-amber-300 mb-4">
            Speak naturally. When you stop speaking, I will verify your question.
          </p>

          {/* Live Interim Transcript Display */}
          <div className="w-full max-w-lg min-h-[64px] bg-[#070b14] border-2 border-slate-700 rounded-2xl p-4 mb-6 text-center">
            {stt.interimTranscript ? (
              <p className="text-lg font-bold text-amber-200 italic">
                &ldquo;{stt.interimTranscript}&rdquo;
              </p>
            ) : (
              <p className="text-sm text-slate-500 font-semibold">
                Listening for speech... (Try saying: &quot;What is photosynthesis?&quot;)
              </p>
            )}
          </div>

          <GazeButton
            id="stop-listening-btn"
            onClick={stt.stop}
            label="Done Speaking"
            icon="⏹️"
            variant="danger"
            size="large"
            className="w-full max-w-md"
          />
        </div>
      )}

      {/* 3. CONFIRMATION STEP: "Did I hear you right?" */}
      {hasPendingConfirmation && (
        <div className="bg-[#0f172a] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-700">
            <span className="text-3xl" role="img" aria-label="Speech Question">
              👂
            </span>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Did I hear you right?
              </h3>
              <p className="text-xs sm:text-sm font-bold text-amber-300">
                Confirm your question before asking AI Tutor
              </p>
            </div>
          </div>

          <div className="bg-[#070b14] border-3 border-amber-400/50 rounded-2xl p-5 text-xl sm:text-2xl font-black text-white shadow-inner">
            &ldquo;{candidateTranscript}&rdquo;
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GazeButton
              id="confirm-ask-yes"
              onClick={handleConfirmYes}
              label="Yes, Ask Tutor"
              icon="✓"
              variant="accent"
              size="large"
              className="!min-h-[80px]"
            />
            <GazeButton
              id="confirm-ask-retry"
              onClick={handleConfirmRetry}
              label="Try Again"
              icon="🔄"
              variant="card"
              size="large"
              className="!min-h-[80px]"
            />
            <GazeButton
              id="confirm-ask-cancel"
              onClick={handleConfirmCancel}
              label="Cancel"
              icon="✕"
              variant="outline"
              size="large"
              className="!min-h-[80px]"
            />
          </div>
        </div>
      )}

      {/* 4. Normal Action Controls: Large Mic Button + Typed Fallback */}
      {!hasPendingConfirmation && stt.state !== "listening" && (
        <div className="space-y-4">
          {/* Large Voice Action Button */}
          {stt.isSupported ? (
            <GazeButton
              id="start-voice-query-btn"
              onClick={() => stt.start()}
              label="Ask with Voice"
              subtitle="Dwell here to turn on microphone & speak your question"
              icon="🎙️"
              tag="Voice STT"
              variant="accent"
              size="large"
              className="w-full !min-h-[84px] shadow-[0_0_20px_rgba(251,191,36,0.25)]"
            />
          ) : (
            <div className="bg-amber-950/80 border-2 border-amber-400 rounded-2xl p-4 text-amber-200 text-sm font-bold">
              Speech recognition is not supported in this browser. Please use Chrome/Edge or use the typed box below.
            </div>
          )}

          {/* STT Error Banner if any */}
          {stt.error && (
            <div className="p-3 bg-rose-950/80 border-2 border-rose-500 rounded-xl text-rose-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2">
              <span>⚠️ {stt.error.message}</span>
              <button
                onClick={stt.reset}
                className="px-2 py-1 bg-rose-900 rounded text-xs text-white hover:bg-rose-800"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Typed Fallback Input Box */}
          <form
            onSubmit={handleTypedSubmit}
            className="flex flex-col sm:flex-row items-stretch gap-3 bg-[#131f38] p-3 rounded-2xl border-2 border-slate-700"
          >
            <input
              id="typed-question-input"
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Or type your question here (e.g. What is photosynthesis?)..."
              className="flex-1 bg-[#070b14] border-2 border-slate-600 focus:border-amber-400 rounded-xl px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              id="typed-question-submit-btn"
              type="submit"
              disabled={!typedInput.trim()}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-base rounded-xl transition-all shadow cursor-pointer"
            >
              Ask
            </button>
          </form>

          {/* Quick Curriculum Prompts for fast dwell testing */}
          {messages.length === 0 && (
            <div className="pt-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                Quick Sample Questions (Look to Ask):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {sampleQuestions.map((q, idx) => (
                  <GazeButton
                    key={idx}
                    id={`quick-sample-q-${idx}`}
                    onClick={() => onAskQuestion(q, false)}
                    label={q}
                    variant="card"
                    size="compact"
                    className="!min-h-[60px] text-xs"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Chat History & Read-Aloud Message Feed */}
      <div className="space-y-4 pt-2">
        <h3 className="text-base font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span>💬</span> Conversation & Answers
        </h3>

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="bg-[#131f38] border-2 border-cyan-400/60 rounded-2xl p-5 flex items-center gap-3 animate-pulse">
            <span className="text-2xl animate-spin">⏳</span>
            <div>
              <p className="text-base font-black text-white">AI Tutor is thinking...</p>
              <p className="text-xs text-cyan-300 font-semibold">
                Searching curriculum textbooks for standard-aligned answer
              </p>
            </div>
          </div>
        )}

        {messages.length === 0 && !isThinking ? (
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center bg-[#070b14]/50">
            <p className="text-base font-bold text-slate-400">
              No questions asked yet. Speak or type a question above to start!
            </p>
            {tutorContext?.subject && (
              <p className="text-xs text-amber-300 mt-1">
                Active Topic: {tutorContext.board} • {tutorContext.className} • {tutorContext.subject}
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isTutor = msg.role === "tutor";
            const isSpeakingThis = activeSpeakingId === msg.id && tts.speaking;

            return (
              <div
                key={msg.id}
                className={`rounded-2xl p-5 border-2 transition-all ${
                  isTutor
                    ? "bg-[#0d1527] border-slate-700 shadow-md"
                    : "bg-[#131f38] border-amber-400/40 ml-4 sm:ml-8"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-black uppercase tracking-wider">
                  <span className={isTutor ? "text-cyan-300 flex items-center gap-1.5" : "text-amber-300 flex items-center gap-1.5"}>
                    <span>{isTutor ? "🤖 AI Tutor" : "👤 You"}</span>
                    {msg.wasVoice && <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">🎤 Voice</span>}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {isTutor ? (
                  <div>
                    <ReadAlongText
                      text={msg.text}
                      isSpeaking={isSpeakingThis}
                      currentCharIndex={tts.currentCharIndex}
                      currentSentenceIndex={tts.currentSentenceIndex}
                      className="text-base sm:text-lg"
                    />

                    {/* Read Aloud Playback Controls */}
                    <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      {!isSpeakingThis ? (
                        <GazeButton
                          id={`read-msg-${msg.id}`}
                          onClick={() => onSpeakMessage(msg.id, msg.text)}
                          label="Read Aloud"
                          icon="🔊"
                          variant="secondary"
                          size="compact"
                          className="!min-h-[48px] !py-2 !px-4 text-xs font-bold text-amber-300"
                        />
                      ) : (
                        <>
                          <GazeButton
                            id={`pause-msg-${msg.id}`}
                            onClick={tts.paused ? tts.resume : tts.pause}
                            label={tts.paused ? "Resume" : "Pause"}
                            icon={tts.paused ? "▶️" : "⏸️"}
                            variant="accent"
                            size="compact"
                            className="!min-h-[48px] !py-2 !px-4 text-xs font-bold"
                          />
                          <GazeButton
                            id={`stop-msg-${msg.id}`}
                            onClick={onStopSpeaking}
                            label="Stop"
                            icon="⏹️"
                            variant="danger"
                            size="compact"
                            className="!min-h-[48px] !py-2 !px-4 text-xs font-bold"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-base sm:text-lg text-white font-semibold">{msg.text}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
