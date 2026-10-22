"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnswerCard } from "./AnswerCard";
import type { ThreadMessage } from "@/components/voice/AskView";

export interface ConversationAreaProps {
  messages: ThreadMessage[];
  board: string;
  subject: string;
  boardName?: string;
  subjectName?: string;
  isThinking: boolean;
  onAskQuestion: (question: string) => void;
  onSelectSuggestion: (question: string) => void;
}

export function ConversationArea({
  messages,
  board,
  subject,
  boardName,
  subjectName,
  isThinking: _isThinking,
  onAskQuestion,
  onSelectSuggestion,
}: ConversationAreaProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const userScrolledUpRef = useRef<boolean>(false);

  // Check scroll position to enable/disable scroll buttons
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

    const handleScroll = () => {
      updateScrollState();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateScrollState();
      });
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollState);
      if (ro) ro.disconnect();
    };
  }, [updateScrollState, messages]);

  // Scroll Up by ~80% of viewable height smoothly
  const handleScrollUp = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.clientHeight * 0.8;
    el.scrollBy({ top: -distance, behavior: "smooth" });
  };

  // Scroll Down by ~80% of viewable height smoothly
  const handleScrollDown = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.clientHeight * 0.8;
    el.scrollBy({ top: distance, behavior: "smooth" });
  };

  // Auto-scroll on new message ONLY if user hasn't scrolled up to read earlier content
  useEffect(() => {
    if (!userScrolledUpRef.current && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  return (
    <div className="flex-1 h-full min-h-0 flex items-stretch gap-4 overflow-hidden relative">
      {/* Main Internal Scroll Container */}
      <div
        ref={scrollContainerRef}
        id="chat-scroll-container"
        tabIndex={0}
        aria-label="Conversation with AI Tutor"
        className="flex-1 h-full stable-scroll-region p-4 sm:p-6 space-y-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      >
        {messages.length === 0 ? (
          <EmptyState
            board={board}
            subject={subject}
            boardName={boardName}
            subjectName={subjectName}
            onSelectQuestion={onAskQuestion}
          />
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg) => {
              if (msg.role === "student") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[75%] rounded-3xl p-5 sm:p-6 bg-[var(--primary-soft)] border border-[var(--primary)]/30 shadow-xs">
                      <div className="text-xs font-semibold text-[var(--primary)] mb-1.5 flex items-center justify-between gap-4">
                        <span>You</span>
                        <span className="text-[var(--text-muted)] font-normal">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                );
              }

              // Tutor Message
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
                    suggestedQuestions={msg.suggestedQuestions}
                    onSelectSuggestion={onSelectSuggestion}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Docked Explicit Gaze Scroll Controls (Fixed beside the chat area) */}
      <aside
        aria-label="Page Scrolling Controls"
        className="flex flex-col justify-between py-2 flex-shrink-0 w-28 sm:w-32 z-10"
      >
        <GazeButton
          id="scroll-up-btn"
          onClick={handleScrollUp}
          label="Scroll Up"
          icon={<ChevronUp className="w-5 h-5 text-[var(--primary)]" />}
          disabled={!canScrollUp}
          variant="card"
          size="default"
          className="w-full !h-24 !min-h-[80px] !min-w-[110px] flex-col justify-center items-center text-center font-semibold text-xs gap-1"
        />

        <div className="flex-1" />

        <GazeButton
          id="scroll-down-btn"
          onClick={handleScrollDown}
          label="Scroll Down"
          icon={<ChevronDown className="w-5 h-5 text-[var(--primary)]" />}
          disabled={!canScrollDown}
          variant="card"
          size="default"
          className="w-full !h-24 !min-h-[80px] !min-w-[110px] flex-col justify-center items-center text-center font-semibold text-xs gap-1"
        />
      </aside>
    </div>
  );
}
