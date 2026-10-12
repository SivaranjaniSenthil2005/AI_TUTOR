"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { GazeButton } from "@/components/gaze/GazeButton";
import { AnswerDisplay } from "./AnswerDisplay";
import {
  askMachineTransition,
  initialSessionSnapshot,
  getButtonCapabilities,
  AskMachineSnapshot,
} from "@/lib/session/askMachine";
import { streamAskQuestion } from "@/lib/api/client";
import {
  AskRequest,
  SourceCitation,
  Turn,
  ApiError,
} from "@/lib/api/types";
import {
  AppLearnerSettings,
  toLearnerProfilePayload,
  saveChatHistory,
  loadSavedChatHistory,
  clearSavedChatHistory,
} from "@/lib/settings/learnerSettings";
import { appendTurn, extractActiveChapter } from "@/lib/session/memory";
import type { UseSpeechRecognitionReturn } from "@/hooks/useSpeechRecognition";
import type { UseSpeechSynthesisReturn } from "@/hooks/useSpeechSynthesis";

export interface ThreadMessage {
  id: string;
  role: "student" | "tutor";
  text: string;
  speechText?: string;
  sources?: SourceCitation[];
  grounded?: boolean;
  provider?: string;
  model?: string;
  mode?: string;
  suggestedQuestions?: string[];
  isStreaming?: boolean;
  timestamp: number;
  originalQuestion?: string;
}

export type ChatMessage = ThreadMessage;

export interface AskViewProps {
  board: string;
  subject: string;
  boardName?: string;
  subjectName?: string;
  learnerSettings: AppLearnerSettings;
  stt: UseSpeechRecognitionReturn;
  tts: UseSpeechSynthesisReturn;
  onChangeBoardSubject: () => void;
  onOpenPrivacy: () => void;
}

export function AskView({
  board,
  subject,
  boardName,
  subjectName,
  learnerSettings,
  stt,
  tts,
  onChangeBoardSubject,
  onOpenPrivacy,
}: AskViewProps) {
  // Session State Machine
  const [session, setSession] = useState<AskMachineSnapshot>(initialSessionSnapshot);
  const [messages, setMessages] = useState<ThreadMessage[]>(() => {
    if (typeof window !== "undefined" && learnerSettings.rememberChat) {
      return loadSavedChatHistory() as ThreadMessage[];
    }
    return [];
  });

  const [typedInput, setTypedInput] = useState<string>("");
  const [isSlowAnswer, setIsSlowAnswer] = useState<boolean>(false);
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);

  // References for aborting, memory, and slow timer
  const abortControllerRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const activeChapterRef = useRef<number | null>(null);
  const lastQuestionRef = useRef<string>("");

  const capabilities = getButtonCapabilities(session.state);

  // Sync TTS speaking state with session machine
  useEffect(() => {
    if (!tts.speaking && session.state === "speaking") {
      const timer = setTimeout(() => {
        setActiveSpeakingMsgId(null);
        setSession((prev) => askMachineTransition(prev, { type: "STOP_SPEAKING" }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [tts.speaking, session.state]);

  // Sync STT interim & final with session machine
  useEffect(() => {
    if (stt.state === "listening" && session.state !== "listening") {
      const timer = setTimeout(() => {
        setSession((prev) => askMachineTransition(prev, { type: "START_LISTENING" }));
      }, 0);
      return () => clearTimeout(timer);
    } else if (stt.state !== "listening" && session.state === "listening") {
      const timer = setTimeout(() => {
        setSession((prev) =>
          askMachineTransition(prev, {
            type: "STOP_LISTENING",
            transcript: stt.transcript,
          })
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [stt.state, stt.transcript, session.state]);

  // Persist chat when updated if rememberChat is enabled
  useEffect(() => {
    if (learnerSettings.rememberChat) {
      saveChatHistory(messages, true);
    }
  }, [messages, learnerSettings.rememberChat]);

  // Mutual exclusion: stop speaking when listening starts
  const handleStartVoice = () => {
    if (session.state === "speaking") {
      tts.stop();
      setActiveSpeakingMsgId(null);
    }
    stt.start();
    setSession((prev) => askMachineTransition(prev, { type: "START_LISTENING" }));
  };

  const handleStopListening = () => {
    stt.stop();
  };

  const handleConfirmYes = () => {
    const q = session.context.pendingVoiceTranscript || stt.transcript.trim();
    if (q) {
      setSession((prev) =>
        askMachineTransition(prev, { type: "CONFIRM_VOICE_QUESTION", question: q })
      );
      stt.reset();
      executeAsk(q, true);
    }
  };

  const handleConfirmRetry = () => {
    stt.reset();
    setSession((prev) => askMachineTransition(prev, { type: "RETRY_VOICE" }));
    stt.start();
  };

  const handleConfirmCancel = () => {
    stt.reset();
    setSession((prev) => askMachineTransition(prev, { type: "CANCEL_VOICE" }));
  };

  const handleTypedSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedInput.trim() || !capabilities.canType) return;
    const q = typedInput.trim();
    setTypedInput("");
    executeAsk(q, false);
  };

  // Main Ask Execution Pipeline
  const executeAsk = useCallback(
    async (
      question: string,
      wasVoice: boolean,
      modeOverride?: "simple" | "step_by_step" | "example" | "exam"
    ) => {
      // 1. Mutual exclusion: stop any ongoing TTS speech
      tts.stop();
      setActiveSpeakingMsgId(null);

      lastQuestionRef.current = question;

      // 2. Transition machine to thinking
      setSession((prev) =>
        askMachineTransition(prev, { type: "SUBMIT_QUESTION", question })
      );

      // 3. Setup slow timer (8 seconds)
      setIsSlowAnswer(false);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      slowTimerRef.current = setTimeout(() => {
        setIsSlowAnswer(true);
      }, 8000);

      // 4. Update messages with student bubble
      const studentMsgId = `stu-${Date.now()}`;
      const tutorMsgId = `tut-${Date.now() + 1}`;
      const mode = modeOverride || learnerSettings.mode;

      const studentMsg: ThreadMessage = {
        id: studentMsgId,
        role: "student",
        text: question,
        timestamp: Date.now(),
      };

      const tutorPlaceholder: ThreadMessage = {
        id: tutorMsgId,
        role: "tutor",
        text: "",
        isStreaming: true,
        mode,
        originalQuestion: question,
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, studentMsg, tutorPlaceholder]);

      // 5. Append student turn to sliding memory
      turnsRef.current = appendTurn(turnsRef.current, { role: "student", text: question });

      // 6. Build Request
      const request: AskRequest = {
        question,
        board,
        subject,
        class_level: 10,
        mode,
        learning_mode: mode,
        learner_profile: toLearnerProfilePayload(learnerSettings),
        history: turnsRef.current.slice(0, -1), // previous history excluding current turn
        active_chapter_no: activeChapterRef.current,
      };

      // 7. AbortController setup
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedAnswer = "";
      let finalSpeechText = "";
      let finalSources: SourceCitation[] = [];
      let finalGrounded = true;
      let finalProvider = "llm";
      let finalModel = "";
      let finalSuggestions: string[] = [];

      try {
        for await (const event of streamAskQuestion(request, { signal: controller.signal })) {
          if (controller.signal.aborted) break;

          if (event.event === "meta") {
            setSession((prev) =>
              askMachineTransition(prev, { type: "RECEIVE_STREAM_START" })
            );
          } else if (event.event === "sources") {
            finalSources = event.data.sources || [];
            const chap = extractActiveChapter(finalSources);
            if (chap) activeChapterRef.current = chap;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === tutorMsgId ? { ...m, sources: finalSources } : m
              )
            );
          } else if (event.event === "token") {
            accumulatedAnswer += event.data.delta;
            setSession((prev) =>
              askMachineTransition(prev, { type: "RECEIVE_TOKEN", token: event.data.delta })
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tutorMsgId ? { ...m, text: accumulatedAnswer } : m
              )
            );
          } else if (event.event === "done") {
            finalSources = event.data.sources || finalSources;
            finalGrounded = event.data.grounded;
            finalProvider = event.data.provider;
            finalModel = event.data.model;
            finalSpeechText = event.data.speech_text || accumulatedAnswer;
            finalSuggestions = event.data.suggested_questions || [];

            const chap = extractActiveChapter(finalSources, event.data.topic_hint);
            if (chap) activeChapterRef.current = chap;
          } else if (event.event === "error") {
            throw new ApiError("provider", event.data.message);
          }
        }

        // Clean up slow timer
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        setIsSlowAnswer(false);

        // Finalize tutor message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tutorMsgId
              ? {
                  ...m,
                  text: accumulatedAnswer,
                  speechText: finalSpeechText,
                  sources: finalSources,
                  grounded: finalGrounded,
                  provider: finalProvider,
                  model: finalModel,
                  suggestedQuestions: finalSuggestions,
                  isStreaming: false,
                }
              : m
          )
        );

        // Append tutor turn to memory
        turnsRef.current = appendTurn(turnsRef.current, {
          role: "tutor",
          text: accumulatedAnswer,
        });

        // Determine auto-speak
        const autoSpeak = tts.settings.autoRead || wasVoice;
        setSession((prev) =>
          askMachineTransition(prev, { type: "FINISH_ANSWER", autoSpeak })
        );

        if (autoSpeak && finalSpeechText) {
          setActiveSpeakingMsgId(tutorMsgId);
          tts.speak(finalSpeechText);
        }
      } catch (err: unknown) {
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        setIsSlowAnswer(false);

        const apiErr = err instanceof ApiError ? err : new ApiError("unknown", String(err));
        if (apiErr.type === "aborted") {
          setSession((prev) => askMachineTransition(prev, { type: "STOP_REQUEST" }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tutorMsgId
                ? { ...m, isStreaming: false, text: accumulatedAnswer || "(Answer stopped)" }
                : m
            )
          );
        } else {
          setSession((prev) =>
            askMachineTransition(prev, { type: "ERROR", error: apiErr.studentMessage })
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tutorMsgId
                ? { ...m, isStreaming: false, text: `⚠️ ${apiErr.studentMessage}` }
                : m
            )
          );
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [board, subject, learnerSettings, tts]
  );

  const handleStopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRetryLast = () => {
    if (lastQuestionRef.current) {
      executeAsk(lastQuestionRef.current, false);
    } else {
      setSession((prev) => askMachineTransition(prev, { type: "RESET_TO_IDLE" }));
    }
  };

  const handleNewTopic = () => {
    turnsRef.current = [];
    activeChapterRef.current = null;
    tts.stop();
    setActiveSpeakingMsgId(null);
    setSession((prev) => askMachineTransition(prev, { type: "RESET_TO_IDLE" }));
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: "tutor",
        text: "Started a fresh topic! Previous chapter context cleared.",
        timestamp: Date.now(),
      },
    ]);
  };

  const handleClearConversation = () => {
    turnsRef.current = [];
    activeChapterRef.current = null;
    tts.stop();
    setActiveSpeakingMsgId(null);
    setMessages([]);
    clearSavedChatHistory();
    setSession((prev) => askMachineTransition(prev, { type: "RESET_TO_IDLE" }));
  };

  const handleSpeakTutorMessage = (msgId: string, speechText: string) => {
    stt.stop();
    setActiveSpeakingMsgId(msgId);
    setSession((prev) => askMachineTransition(prev, { type: "START_SPEAKING" }));
    tts.speak(speechText);
  };

  const handleStopSpeakingMessage = () => {
    tts.stop();
    setActiveSpeakingMsgId(null);
    setSession((prev) => askMachineTransition(prev, { type: "STOP_SPEAKING" }));
  };

  // Find latest tutor message for suggestions
  const latestTutorMsg = [...messages].reverse().find((m) => m.role === "tutor" && !m.isStreaming);
  const candidateTranscript = session.context.pendingVoiceTranscript || stt.transcript.trim();

  return (
    <div className="space-y-6">
      {/* 1. Active Curriculum Header & Change Button */}
      <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-xl">
            📚
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {boardName || board.toUpperCase()} • Class 10 {subjectName || subject}
            </h3>
            <p className="text-xs text-amber-300 font-semibold">
              Mode: {learnerSettings.mode.toUpperCase()} • Max {learnerSettings.max_sentences} Sentences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GazeButton
            id="change-board-subject-btn"
            onClick={onChangeBoardSubject}
            label="Change Board / Subject"
            icon="🔄"
            variant="card"
            size="compact"
            className="!min-h-[44px] text-xs font-bold"
          />
          <GazeButton
            id="open-privacy-btn"
            onClick={onOpenPrivacy}
            label="Privacy"
            icon="🛡️"
            variant="outline"
            size="compact"
            className="!min-h-[44px] text-xs font-bold text-slate-300"
          />
        </div>
      </div>

      {/* 2. Slow Answer Warning Banner (shown after 8s of thinking) */}
      {isSlowAnswer && (session.state === "thinking" || session.state === "answering") && (
        <div className="bg-amber-950/80 border-2 border-amber-400 rounded-2xl p-4 flex items-center justify-between gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-spin">⏳</span>
            <div>
              <p className="text-sm font-black text-amber-200">
                Still thinking... Searching all Class 10 textbook chapters
              </p>
              <p className="text-xs text-amber-300/80">
                Large textbooks can take a few extra moments. You can wait or cancel below.
              </p>
            </div>
          </div>
          <GazeButton
            id="slow-answer-stop-btn"
            onClick={handleStopRequest}
            label="Stop"
            icon="⏹️"
            variant="danger"
            size="compact"
            className="!min-h-[44px] text-xs font-bold"
          />
        </div>
      )}

      {/* 3. Error Banner with Student-Friendly Retry Button */}
      {session.state === "error" && (
        <div className="bg-rose-950/90 border-3 border-rose-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h4 className="text-base font-black text-white">Let&apos;s try that again!</h4>
              <p className="text-sm text-rose-200">{session.context.errorMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GazeButton
              id="error-try-again-btn"
              onClick={handleRetryLast}
              label="Try Again"
              icon="🔄"
              variant="accent"
              size="compact"
              className="!min-h-[50px] !px-5 text-sm font-black"
            />
            <GazeButton
              id="error-cancel-btn"
              onClick={() => setSession((prev) => askMachineTransition(prev, { type: "RESET_TO_IDLE" }))}
              label="Dismiss"
              variant="outline"
              size="compact"
              className="!min-h-[50px] text-sm"
            />
          </div>
        </div>
      )}

      {/* 4. Live Voice Listening Card */}
      {session.state === "listening" && (
        <div className="bg-gradient-to-br from-[#131f38] via-[#0d1527] to-[#131f38] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center shadow-2xl animate-pulse">
          <div className="relative w-24 h-24 rounded-full bg-amber-400/20 border-4 border-amber-400 flex items-center justify-center text-4xl mb-4 text-amber-300 shadow-[0_0_30px_#fbbf24]">
            🎤
            <span className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-50" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
            I&apos;m listening... Speak your question!
          </h3>
          <p className="text-sm font-bold text-amber-300 mb-4">
            Speak naturally. When you finish, look at &quot;Done Speaking&quot;.
          </p>

          <div className="w-full max-w-lg min-h-[64px] bg-[#070b14] border-2 border-slate-700 rounded-2xl p-4 mb-6 text-center">
            {stt.interimTranscript ? (
              <p className="text-lg font-bold text-amber-200 italic">
                &ldquo;{stt.interimTranscript}&rdquo;
              </p>
            ) : (
              <p className="text-sm text-slate-500 font-semibold">
                Listening for your voice... (Try saying: &quot;What are Newton&apos;s laws of motion?&quot;)
              </p>
            )}
          </div>

          <GazeButton
            id="stop-listening-btn"
            onClick={handleStopListening}
            label="Done Speaking"
            icon="⏹️"
            variant="danger"
            size="large"
            className="w-full max-w-md"
          />
        </div>
      )}

      {/* 5. Voice Confirmation Step (Phase 7 rule) */}
      {session.state === "confirming" && (
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

      {/* 6. Normal Input Section (Big Mic + Typed Fallback) */}
      {session.state !== "listening" && session.state !== "confirming" && (
        <div className="space-y-4">
          {/* Big Mic GazeButton */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex-1">
              <GazeButton
                id="start-voice-query-btn"
                onClick={handleStartVoice}
                disabled={!capabilities.canListen}
                label="Ask with Voice"
                subtitle="Dwell here to speak your question"
                icon="🎙️"
                variant="accent"
                size="large"
                className="w-full !min-h-[80px] shadow-[0_0_20px_rgba(251,191,36,0.25)]"
              />
            </div>
            {capabilities.canStopRequest && (
              <GazeButton
                id="stop-request-btn"
                onClick={handleStopRequest}
                label="Stop"
                icon="⏹️"
                variant="danger"
                size="large"
                className="!min-h-[80px] !px-8"
              />
            )}
          </div>

          {/* Typed Fallback Input Box */}
          <form
            onSubmit={handleTypedSubmit}
            className="flex flex-col sm:flex-row items-stretch gap-3 bg-[#131f38] p-3 rounded-2xl border-2 border-slate-700"
          >
            <input
              id="typed-question-input"
              type="text"
              value={typedInput}
              disabled={!capabilities.canType}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={`Ask a Class 10 ${subject} question (e.g. What is photosynthesis?)...`}
              className="flex-1 bg-[#070b14] border-2 border-slate-600 focus:border-amber-400 rounded-xl px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
            />
            <button
              id="typed-question-submit-btn"
              type="submit"
              disabled={!typedInput.trim() || !capabilities.canType}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-base rounded-xl transition-all shadow cursor-pointer"
            >
              Ask
            </button>
          </form>
        </div>
      )}

      {/* 7. Conversation Messages Feed */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-base font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>💬</span> Answers & Textbook Study
          </h3>
          <div className="flex items-center gap-2">
            <GazeButton
              id="new-topic-btn"
              onClick={handleNewTopic}
              disabled={!capabilities.canClearHistory}
              label="New Topic"
              icon="🌱"
              variant="card"
              size="compact"
              className="!min-h-[40px] text-xs"
            />
            <GazeButton
              id="clear-conversation-btn"
              onClick={handleClearConversation}
              disabled={!capabilities.canClearHistory}
              label="Clear Chat"
              icon="🧹"
              variant="outline"
              size="compact"
              className="!min-h-[40px] text-xs text-slate-400"
            />
          </div>
        </div>

        {/* Empty Conversation State */}
        {messages.length === 0 && session.state === "idle" && (
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center bg-[#070b14]/50 space-y-4">
            <p className="text-base font-bold text-slate-400">
              No questions asked yet. Speak or type above to start learning!
            </p>
            <div className="text-xs text-amber-300 font-semibold">
              Or look at one of these sample questions:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {[
                subject === "science"
                  ? "Explain Newton's laws of motion"
                  : "Describe the Constitution of India",
                subject === "science"
                  ? "What happens during photosynthesis?"
                  : "What were the causes of the Revolt of 1857?",
                subject === "science"
                  ? "What is the structure of a human eye?"
                  : "Explain the types of resources in geography",
              ].map((sampleQ, idx) => (
                <GazeButton
                  key={idx}
                  id={`sample-q-${idx}`}
                  onClick={() => executeAsk(sampleQ, false)}
                  label={sampleQ}
                  variant="card"
                  size="compact"
                  className="!min-h-[58px] text-xs justify-center text-center"
                />
              ))}
            </div>
          </div>
        )}

        {/* Messages Thread */}
        {messages.map((msg) => {
          const isTutor = msg.role === "tutor";
          const isSpeakingThis = activeSpeakingMsgId === msg.id && tts.speaking;

          return (
            <div
              key={msg.id}
              className={`rounded-2xl p-5 border-2 transition-all ${
                isTutor
                  ? "bg-[#0d1527] border-slate-700 shadow-md"
                  : "bg-[#131f38] border-amber-400/40 ml-4 sm:ml-8"
              }`}
            >
              {/* Header Info */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs font-black uppercase tracking-wider">
                <span
                  className={
                    isTutor
                      ? "text-cyan-300 flex items-center gap-1.5"
                      : "text-amber-300 flex items-center gap-1.5"
                  }
                >
                  <span>{isTutor ? "🤖 AI Tutor" : "👤 You"}</span>
                  {isTutor && msg.provider && (
                    <span className="text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-slate-700 font-semibold">
                      {msg.provider}
                    </span>
                  )}
                </span>
                <span className="text-slate-500 font-medium">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Message Content */}
              {isTutor ? (
                <div className="space-y-4">
                  <AnswerDisplay
                    answerText={msg.text}
                    speechText={msg.speechText}
                    sources={msg.sources}
                    grounded={msg.grounded}
                    isStreaming={msg.isStreaming}
                    isSpeaking={isSpeakingThis}
                    currentSpeechSentenceIdx={tts.currentSentenceIndex}
                    mode={msg.mode}
                  />

                  {/* Read Aloud Playback Controls */}
                  {!msg.isStreaming && msg.text && (
                    <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-slate-800">
                      {!isSpeakingThis ? (
                        <GazeButton
                          id={`read-aloud-${msg.id}`}
                          onClick={() =>
                            handleSpeakTutorMessage(msg.id, msg.speechText || msg.text)
                          }
                          label="Read Aloud"
                          icon="🔊"
                          variant="secondary"
                          size="compact"
                          className="!min-h-[44px] text-xs font-bold text-amber-300"
                        />
                      ) : (
                        <>
                          <GazeButton
                            id={`pause-read-${msg.id}`}
                            onClick={tts.paused ? tts.resume : tts.pause}
                            label={tts.paused ? "Resume Audio" : "Pause Audio"}
                            icon={tts.paused ? "▶️" : "⏸️"}
                            variant="accent"
                            size="compact"
                            className="!min-h-[44px] text-xs font-bold"
                          />
                          <GazeButton
                            id={`stop-read-${msg.id}`}
                            onClick={handleStopSpeakingMessage}
                            label="Stop Audio"
                            icon="⏹️"
                            variant="danger"
                            size="compact"
                            className="!min-h-[44px] text-xs font-bold"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Mode Buttons: Simple, Step by step, Example, Exam style */}
                  {!msg.isStreaming && msg.originalQuestion && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                        Re-explain this answer in another mode:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <GazeButton
                          id={`re-ask-simple-${msg.id}`}
                          onClick={() => executeAsk(msg.originalQuestion!, false, "simple")}
                          label="Simple"
                          variant={msg.mode === "simple" ? "active" : "card"}
                          size="compact"
                          className="!min-h-[48px] text-xs justify-center"
                        />
                        <GazeButton
                          id={`re-ask-step-${msg.id}`}
                          onClick={() => executeAsk(msg.originalQuestion!, false, "step_by_step")}
                          label="Step by Step"
                          variant={msg.mode === "step_by_step" ? "active" : "card"}
                          size="compact"
                          className="!min-h-[48px] text-xs justify-center"
                        />
                        <GazeButton
                          id={`re-ask-example-${msg.id}`}
                          onClick={() => executeAsk(msg.originalQuestion!, false, "example")}
                          label="Example"
                          variant={msg.mode === "example" ? "active" : "card"}
                          size="compact"
                          className="!min-h-[48px] text-xs justify-center"
                        />
                        <GazeButton
                          id={`re-ask-exam-${msg.id}`}
                          onClick={() => executeAsk(msg.originalQuestion!, false, "exam")}
                          label="Exam Style"
                          variant={msg.mode === "exam" ? "active" : "card"}
                          size="compact"
                          className="!min-h-[48px] text-xs justify-center"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-base sm:text-lg text-white font-semibold leading-relaxed">
                  {msg.text}
                </p>
              )}
            </div>
          );
        })}

        {/* 8. Follow-up Suggestions under the latest tutor message */}
        {latestTutorMsg &&
          latestTutorMsg.suggestedQuestions &&
          latestTutorMsg.suggestedQuestions.length > 0 &&
          session.state === "idle" && (
            <div className="bg-[#131f38] border-2 border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>💡</span> Suggested Follow-Up Questions (Look to Ask):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {latestTutorMsg.suggestedQuestions.slice(0, 3).map((sug, idx) => (
                  <GazeButton
                    key={idx}
                    id={`suggested-q-${idx}`}
                    onClick={() => executeAsk(sug, false)}
                    label={sug}
                    variant="card"
                    size="large"
                    className="!min-h-[68px] text-xs leading-snug justify-center"
                  />
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
