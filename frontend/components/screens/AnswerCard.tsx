"use client";

import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Sparkles, AlertCircle, Volume2 } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { GazeButton } from "@/components/ui/GazeButton";
import type { SourceCitation } from "@/lib/api/types";

export interface AnswerCardProps {
  id: string;
  answerText: string;
  speechText?: string;
  sources?: SourceCitation[];
  grounded?: boolean;
  isStreaming?: boolean;
  mode?: string;
  originalQuestion?: string;
  suggestedQuestions?: string[];
  onSelectSuggestion?: (question: string) => void;
  onReadAloud?: () => void;
  onReAskMode?: (mode: "simple" | "step_by_step" | "example" | "exam") => void;
  isSpeakingThis?: boolean;
  className?: string;
}

export function AnswerCard({
  id,
  answerText,
  sources = [],
  grounded = true,
  isStreaming = false,
  mode = "simple",
  originalQuestion,
  suggestedQuestions = [],
  onSelectSuggestion,
  onReadAloud,
  onReAskMode,
  isSpeakingThis = false,
  className = "",
}: AnswerCardProps) {
  const [areSourcesExpanded, setAreSourcesExpanded] = useState<boolean>(false);

  const modeBadge = {
    simple: { label: "Mode: simple", variant: "amber" as const },
    step_by_step: { label: "Mode: step by step", variant: "teal" as const },
    example: { label: "Mode: example", variant: "purple" as const },
    exam: { label: "Mode: exam style", variant: "cyan" as const },
  }[mode] || { label: `Mode: ${mode}`, variant: "slate" as const };

  const isOutOfScope = !grounded;

  // Format steps if numbered list is present (e.g. "1. ...\n2. ...")
  const renderFormattedAnswer = (text: string) => {
    if (!text && isStreaming) {
      return (
        <div className="flex items-center gap-2 py-6 text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-gentle-pulse" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-gentle-pulse [animation-delay:200ms]" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-gentle-pulse [animation-delay:400ms]" />
          <span className="text-lg font-bold text-amber-300 ml-2">Finding textbook answer...</span>
        </div>
      );
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    return (
      <div className="space-y-4 max-w-[65ch]">
        {lines.map((line, idx) => {
          const stepMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
          if (stepMatch) {
            const stepNum = stepMatch[1];
            const stepContent = stepMatch[2];
            return (
              <div key={idx} className="flex items-start gap-3.5 my-2">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-400/20 border-2 border-amber-400 text-amber-300 font-black text-sm flex items-center justify-center">
                  {stepNum}
                </span>
                <p className="text-[22px] sm:text-[24px] font-semibold text-slate-100 leading-[1.6] flex-1">
                  {stepContent}
                </p>
              </div>
            );
          }

          // Bullet points
          if (line.startsWith("- ") || line.startsWith("• ")) {
            return (
              <div key={idx} className="flex items-start gap-3 pl-2">
                <span className="text-amber-400 text-2xl leading-none mt-1">•</span>
                <p className="text-[22px] sm:text-[24px] font-semibold text-slate-100 leading-[1.6] flex-1">
                  {line.substring(2)}
                </p>
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-[22px] sm:text-[24px] font-semibold text-slate-100 leading-[1.6]"
            >
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <article
      id="tutor-answer-card"
      data-message-id={id}
      aria-label="Tutor Answer"
      className={`rounded-3xl border-2 p-6 sm:p-8 min-h-[220px] calm-fade shadow-xl ${
        isOutOfScope
          ? "bg-[#180d12] border-rose-600/70 text-rose-100"
          : "bg-[#0d1527] border-slate-700/80 text-white"
      } ${className}`}
    >
      {/* Top Header: AI Tutor Label, Mode Chip, and Grounded Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm">
            AI
          </div>
          <span className="font-extrabold text-base text-white">AI Tutor</span>
          <Chip variant={modeBadge.variant}>{modeBadge.label}</Chip>
        </div>

        {isOutOfScope && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-600 text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Outside Class 10 Syllabus</span>
          </span>
        )}
      </div>

      {/* Answer Content */}
      <div className="py-2">
        {isOutOfScope ? (
          <div className="space-y-3">
            <p className="text-[22px] sm:text-[24px] font-bold text-rose-200 leading-[1.6]">
              I couldn&apos;t find that in your Class 10 textbook.
            </p>
            <p className="text-base text-slate-300">
              AI Tutor is strictly grounded in the official syllabus for Class 10 Science and Social Science. Try asking a question from your chapters!
            </p>
          </div>
        ) : (
          renderFormattedAnswer(answerText)
        )}
      </div>

      {/* Action Row: Read Aloud and Re-Ask in Mode */}
      {!isStreaming && answerText && (
        <div className="mt-6 pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {onReadAloud && (
              <GazeButton
                id={`read-aloud-${id}`}
                onClick={onReadAloud}
                label={isSpeakingThis ? "Speaking..." : "Read Aloud"}
                icon={<Volume2 className="w-4 h-4 text-amber-300" />}
                variant={isSpeakingThis ? "active" : "secondary"}
                size="compact"
                className="!h-10 !min-h-[40px] !min-w-[130px] !px-3 !py-1 text-xs font-bold"
              />
            )}

            {sources && sources.length > 0 && !isOutOfScope && (
              <button
                id="expand-sources-btn"
                type="button"
                onClick={(e) => {
                  e.currentTarget.focus({ preventScroll: true });
                  setAreSourcesExpanded((prev) => !prev);
                }}
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#070b14] border-2 border-slate-700 hover:border-amber-400 text-amber-300 text-xs font-bold select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Textbook Citations ({sources.length})</span>
                {areSourcesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Mode Switchers */}
          {onReAskMode && originalQuestion && (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-400 hidden sm:inline mr-1">Re-explain:</span>
              <button
                id={`re-ask-simple-${id}`}
                type="button"
                onClick={() => onReAskMode("simple")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer calm-fade ${
                  mode === "simple"
                    ? "bg-amber-400 text-slate-950 border-amber-300 font-black"
                    : "bg-[#070b14] text-slate-300 border-slate-700 hover:border-amber-400"
                }`}
              >
                Simple
              </button>
              <button
                id={`re-ask-step-${id}`}
                type="button"
                onClick={() => onReAskMode("step_by_step")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer calm-fade ${
                  mode === "step_by_step"
                    ? "bg-teal-400 text-slate-950 border-teal-300 font-black"
                    : "bg-[#070b14] text-slate-300 border-slate-700 hover:border-teal-400"
                }`}
              >
                Step by step
              </button>
              <button
                id={`re-ask-example-${id}`}
                type="button"
                onClick={() => onReAskMode("example")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer calm-fade ${
                  mode === "example"
                    ? "bg-purple-400 text-slate-950 border-purple-300 font-black"
                    : "bg-[#070b14] text-slate-300 border-slate-700 hover:border-purple-400"
                }`}
              >
                Example
              </button>
              <button
                id={`re-ask-exam-${id}`}
                type="button"
                onClick={() => onReAskMode("exam")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer calm-fade ${
                  mode === "exam"
                    ? "bg-cyan-400 text-slate-950 border-cyan-300 font-black"
                    : "bg-[#070b14] text-slate-300 border-slate-700 hover:border-cyan-400"
                }`}
              >
                Exam
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sources Expansion Details */}
      {areSourcesExpanded && sources && sources.length > 0 && !isOutOfScope && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#070b14] border border-slate-800">
          {sources.map((src, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#0b1120] border border-slate-700/80 space-y-1 text-xs"
            >
              <div className="font-extrabold text-amber-300 truncate">
                [{idx + 1}] {src.chapter_title || `Chapter ${src.chapter_no || ""}`}
              </div>
              {src.book_title && <div className="text-slate-300 truncate">{src.book_title}</div>}
              <div className="text-slate-400 text-[11px]">
                Pages {src.page_start} - {src.page_end}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up Questions Suggestions */}
      {suggestedQuestions && suggestedQuestions.length > 0 && onSelectSuggestion && !isStreaming && (
        <div className="mt-8 pt-5 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>Follow-up questions you can ask:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {suggestedQuestions.slice(0, 3).map((q, idx) => (
              <GazeButton
                key={idx}
                id={`suggested-q-${idx}`}
                onClick={() => onSelectSuggestion(q)}
                label={q}
                variant="card"
                size="large"
                className="w-full !min-h-[76px] text-xs leading-snug justify-center text-center font-bold"
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
