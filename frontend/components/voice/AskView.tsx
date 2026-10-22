"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ChevronUp, ChevronDown, Sparkles, Trash2, RotateCcw, Mic, Volume2 } from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnswerCard } from "@/components/screens/AnswerCard";
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
  onSessionStateChange?: (state: AskMachineSnapshot["state"]) => void;
  onHasAnswerToReadChange?: (hasAnswer: boolean) => void;
}

export interface AskViewHandle {
  startVoice: () => void;
  focusTypeInput: () => void;
  readAloudLatest: () => void;
  reAskLatestMode: (mode: "simple" | "step_by_step" | "example" | "exam") => void;
  executeQuestion: (question: string) => void;
  sessionState: AskMachineSnapshot["state"];
  hasAnswerToRead: boolean;
}

export const AskView = forwardRef<AskViewHandle, AskViewProps>(function AskView(
  {
    board,
    subject,
    boardName,
    subjectName,
    learnerSettings,
    stt,
    tts,
    onChangeBoardSubject,
    onOpenPrivacy,
    onSessionStateChange,
    onHasAnswerToReadChange,
  },
  ref
) {
  // Session State Machine
  const [session, setSession] = useState<AskMachineSnapshot>(initialSessionSnapshot);
  const [messages, setMessages] = useState<ThreadMessage[]>(() => {
    if (typeof window !== "undefined" && learnerSettings.rememberChat) {
      return loadSavedChatHistory() as ThreadMessage[];
    }
    return [];
  });

  const [typedInput, setTypedInput] = useState<string>("");
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);

  // Scroll Container Ref and State
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const userScrolledUpRef = useRef<boolean>(false);

  // References for aborting, memory, and timer
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const activeChapterRef = useRef<number | null>(null);
  const lastQuestionRef = useRef<string>("");

  const capabilities = getButtonCapabilities(session.state);

  // Notify parent of session state changes
  useEffect(() => {
    onSessionStateChange?.(session.state);
  }, [session.state, onSessionStateChange]);

  // Check if there is an answer to read
  const latestTutorMsg = [...messages].reverse().find((m) => m.role === "tutor" && !m.isStreaming);
  const hasAnswerToRead = Boolean(latestTutorMsg && latestTutorMsg.text);

  useEffect(() => {
    onHasAnswerToReadChange?.(hasAnswerToRead);
  }, [hasAnswerToRead, onHasAnswerToReadChange]);

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

  // Update scroll boundaries
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const atTop = el.scrollTop <= 5;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;

    setCanScrollUp(!atTop);
    setCanScrollDown(!atBottom);
    userScrolledUpRef.current = !atBottom;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateScrollState());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      if (ro) ro.disconnect();
    };
  }, [updateScrollState, messages]);

  const handleScrollUp = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ top: -el.clientHeight * 0.8, behavior: "smooth" });
  };

  const handleScrollDown = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
  };

  // Scroll down on new message only if user is already at bottom
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  // Start voice recognition
  const handleStartVoice = useCallback(() => {
    if (session.state === "speaking") {
      tts.stop();
      setActiveSpeakingMsgId(null);
    }
    stt.start();
    setSession((prev) => askMachineTransition(prev, { type: "START_LISTENING" }));
  }, [session.state, tts, stt]);

  const handleStopListening = useCallback(() => {
    stt.stop();
  }, [stt]);

  const handleConfirmYes = useCallback(() => {
    const q = session.context.pendingVoiceTranscript || stt.transcript.trim();
    if (q) {
      setSession((prev) =>
        askMachineTransition(prev, { type: "CONFIRM_VOICE_QUESTION", question: q })
      );
      stt.reset();
      executeAsk(q, true);
    }
  }, [session.context.pendingVoiceTranscript, stt]);

  const handleConfirmRetry = useCallback(() => {
    stt.reset();
    setSession((prev) => askMachineTransition(prev, { type: "RETRY_VOICE" }));
    stt.start();
  }, [stt]);

  const handleConfirmCancel = useCallback(() => {
    stt.reset();
    setSession((prev) => askMachineTransition(prev, { type: "CANCEL_VOICE" }));
  }, [stt]);

  // Main Ask Execution Pipeline
  const executeAsk = useCallback(
    async (
      question: string,
      wasVoice: boolean,
      modeOverride?: "simple" | "step_by_step" | "example" | "exam"
    ) => {
      tts.stop();
      setActiveSpeakingMsgId(null);
      lastQuestionRef.current = question;

      setSession((prev) =>
        askMachineTransition(prev, { type: "SUBMIT_QUESTION", question })
      );

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
      turnsRef.current = appendTurn(turnsRef.current, { role: "student", text: question });

      const request: AskRequest = {
        question,
        board,
        subject,
        class_level: 10,
        mode,
        learning_mode: mode,
        learner_profile: toLearnerProfilePayload(learnerSettings),
        history: turnsRef.current.slice(0, -1),
        active_chapter_no: activeChapterRef.current,
      };

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

        turnsRef.current = appendTurn(turnsRef.current, {
          role: "tutor",
          text: accumulatedAnswer,
        });

        const autoSpeak = tts.settings.autoRead || wasVoice;
        setSession((prev) =>
          askMachineTransition(prev, { type: "FINISH_ANSWER", autoSpeak })
        );

        if (autoSpeak && finalSpeechText) {
          setActiveSpeakingMsgId(tutorMsgId);
          tts.speak(finalSpeechText);
        }
      } catch (err: unknown) {
        const apiErr = err instanceof ApiError ? err : new ApiError("unknown", String(err));
        if (apiErr.type === "aborted") {
          setSession((prev) => askMachineTransition(prev, { type: "STOP_REQUEST" }));
        } else {
          setSession((prev) =>
            askMachineTransition(prev, { type: "ERROR", error: apiErr.message })
          );
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tutorMsgId
              ? {
                  ...m,
                  text:
                    accumulatedAnswer ||
                    "I had trouble connecting to the textbook server. Please try asking again.",
                  isStreaming: false,
                  grounded: false,
                }
              : m
          )
        );
      }
    },
    [board, subject, learnerSettings, tts]
  );

  const handleTypedSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedInput.trim() || !capabilities.canType) return;
    const q = typedInput.trim();
    setTypedInput("");
    executeAsk(q, false);
  };

  const handleSpeakTutorMessage = useCallback(
    (msgId: string, textToSpeak: string) => {
      if (tts.speaking) {
        tts.stop();
      }
      setActiveSpeakingMsgId(msgId);
      setSession((prev) => askMachineTransition(prev, { type: "START_SPEAKING" }));
      tts.speak(textToSpeak);
    },
    [tts]
  );

  const handleStopSpeaking = useCallback(() => {
    tts.stop();
    setActiveSpeakingMsgId(null);
    setSession((prev) => askMachineTransition(prev, { type: "STOP_SPEAKING" }));
  }, [tts]);

  const handleNewTopic = useCallback(() => {
    activeChapterRef.current = null;
    turnsRef.current = [];
  }, []);

  const handleClearConversation = useCallback(() => {
    setMessages([]);
    turnsRef.current = [];
    activeChapterRef.current = null;
    clearSavedChatHistory();
  }, []);

  // Expose imperative handle to parent (for BottomDock and shortcuts)
  useImperativeHandle(
    ref,
    () => ({
      startVoice: handleStartVoice,
      focusTypeInput: () => {
        typeInputRef.current?.focus({ preventScroll: true });
      },
      readAloudLatest: () => {
        if (latestTutorMsg) {
          handleSpeakTutorMessage(
            latestTutorMsg.id,
            latestTutorMsg.speechText || latestTutorMsg.text
          );
        }
      },
      reAskLatestMode: (newMode) => {
        if (latestTutorMsg && latestTutorMsg.originalQuestion) {
          executeAsk(latestTutorMsg.originalQuestion, false, newMode);
        }
      },
      executeQuestion: (q: string) => {
        executeAsk(q, false);
      },
      sessionState: session.state,
      hasAnswerToRead,
    }),
    [
      handleStartVoice,
      latestTutorMsg,
      handleSpeakTutorMessage,
      executeAsk,
      session.state,
      hasAnswerToRead,
    ]
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden relative">
      {/* Top Header of Ask Area: Topic Context, New Topic, and Clear Chat */}
      <div className="h-14 px-4 sm:px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] truncate">
          <span>{boardName || board.toUpperCase()}</span>
          <span>•</span>
          <span className="text-amber-700 dark:text-amber-300 font-extrabold">{subjectName || subject}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="new-topic-btn"
            type="button"
            onClick={handleNewTopic}
            disabled={!capabilities.canClearHistory}
            className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-amber-500 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer calm-fade disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span className="hidden sm:inline">New Topic</span>
          </button>
          <button
            id="clear-conversation-btn"
            type="button"
            onClick={handleClearConversation}
            disabled={!capabilities.canClearHistory || messages.length === 0}
            className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-rose-400 text-[var(--text-muted)] hover:text-rose-600 dark:hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer calm-fade disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Typed Question Bar (Always visible for direct typing and test reliability) */}
      <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-shrink-0">
        <form
          id="typed-question-form"
          onSubmit={handleTypedSubmit}
          className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto"
        >
          <input
            ref={typeInputRef}
            id="typed-question-input"
            type="text"
            value={typedInput}
            disabled={!capabilities.canType}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder={`Ask a question (e.g. What is photosynthesis?)...`}
            className="flex-1 h-12 bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] focus:border-amber-500 rounded-2xl px-4 text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-amber-400/30 calm-fade disabled:opacity-50"
          />
          <button
            id="typed-question-submit-btn"
            type="submit"
            disabled={!typedInput.trim() || !capabilities.canType}
            className="h-12 px-6 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-base rounded-2xl calm-fade shadow cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Ask</span>
          </button>
        </form>
      </div>

      {/* Dynamic Voice Listening / Confirmation Card */}
      {session.state === "listening" && (
        <div
          id="voice-listening-card"
          className="mx-4 sm:mx-6 my-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border-2 border-amber-400 text-center space-y-2 flex-shrink-0 calm-fade shadow-md"
        >
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300 font-black text-sm uppercase tracking-wider">
            <Mic className="w-5 h-5 animate-pulse" />
            <span>I am listening... Speak now</span>
          </div>
          <p className="text-lg font-bold text-[var(--text-primary)] min-h-[28px]">
            {stt.transcript || "Say your question..."}
          </p>
          <button
            type="button"
            onClick={handleStopListening}
            className="px-4 py-1.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-300 cursor-pointer"
          >
            Done Speaking
          </button>
        </div>
      )}

      {session.state === "confirming" && (
        <div
          id="voice-confirmation-card"
          className="mx-4 sm:mx-6 my-3 p-5 rounded-2xl bg-[var(--bg-surface)] border-4 border-amber-400 text-center space-y-4 flex-shrink-0 calm-fade shadow-xl"
        >
          <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Did you say:
          </div>
          <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
            &ldquo;{session.context.pendingVoiceTranscript || stt.transcript}&rdquo;
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
            <GazeButton
              id="voice-confirm-yes-btn"
              onClick={handleConfirmYes}
              label="Yes, Ask Tutor"
              variant="accent"
              size="compact"
              className="w-full justify-center !min-h-[56px] font-black"
            />
            <GazeButton
              id="voice-confirm-retry-btn"
              onClick={handleConfirmRetry}
              label="Try Again"
              variant="secondary"
              size="compact"
              className="w-full justify-center !min-h-[56px]"
            />
            <GazeButton
              id="voice-confirm-cancel-btn"
              onClick={handleConfirmCancel}
              label="Cancel"
              variant="outline"
              size="compact"
              className="w-full justify-center !min-h-[56px]"
            />
          </div>
        </div>
      )}

      {/* Main Conversation Region with Docked Large Gaze Scroll Buttons */}
      <div className="flex-1 min-h-0 flex items-stretch gap-4 p-4 sm:p-6 overflow-hidden">
        {/* Scrollable Message List */}
        <div
          ref={scrollContainerRef}
          id="chat-scroll-container"
          tabIndex={0}
          aria-label="Tutor Conversation Messages"
          className="flex-1 h-full stable-scroll-region space-y-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          {messages.length === 0 ? (
            <EmptyState
              board={board}
              subject={subject}
              boardName={boardName}
              subjectName={subjectName}
              onSelectQuestion={(q) => executeAsk(q, false)}
            />
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg) => {
                if (msg.role === "student") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[75%] rounded-3xl p-5 sm:p-6 bg-amber-50 dark:bg-[#131f38] border-2 border-amber-300 dark:border-amber-400/50 shadow-sm">
                        <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1.5 flex items-center justify-between gap-4">
                          <span>You</span>
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Tutor Answer Card
                const isSpeakingThis = activeSpeakingMsgId === msg.id && tts.speaking;

                return (
                  <div key={msg.id}>
                    <AnswerCard
                      id={msg.id}
                      answerText={msg.text}
                      speechText={msg.speechText}
                      sources={msg.sources}
                      grounded={msg.grounded}
                      isStreaming={msg.isStreaming}
                      mode={msg.mode}
                      originalQuestion={msg.originalQuestion}
                      suggestedQuestions={msg.suggestedQuestions}
                      onSelectSuggestion={(q) => executeAsk(q, false)}
                      onReadAloud={() =>
                        handleSpeakTutorMessage(msg.id, msg.speechText || msg.text)
                      }
                      onReAskMode={(m) =>
                        executeAsk(msg.originalQuestion || msg.text, false, m)
                      }
                      isSpeakingThis={isSpeakingThis}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Docked Large Gaze Scroll Buttons beside chat area */}
        <aside
          aria-label="Chat Scroll Controls"
          className="flex flex-col justify-between py-2 flex-shrink-0 w-28 sm:w-32 z-10"
        >
          <GazeButton
            id="scroll-up-btn"
            onClick={handleScrollUp}
            label="Scroll Up"
            icon={<ChevronUp className="w-6 h-6 text-amber-300" />}
            disabled={!canScrollUp}
            variant="card"
            size="default"
            className="w-full !h-24 !min-h-[80px] !min-w-[110px] flex-col justify-center items-center text-center font-black text-xs gap-1"
          />

          <div className="flex-1" />

          <GazeButton
            id="scroll-down-btn"
            onClick={handleScrollDown}
            label="Scroll Down"
            icon={<ChevronDown className="w-6 h-6 text-amber-300" />}
            disabled={!canScrollDown}
            variant="card"
            size="default"
            className="w-full !h-24 !min-h-[80px] !min-w-[110px] flex-col justify-center items-center text-center font-black text-xs gap-1"
          />
        </aside>
      </div>
    </div>
  );
});
