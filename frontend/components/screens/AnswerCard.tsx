"use client";

import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Sparkles, AlertCircle, Volume2, HelpCircle } from "lucide-react";
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
  subject?: string;
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
  subject = "science",
  originalQuestion,
  suggestedQuestions = [],
  onSelectSuggestion,
  onReadAloud,
  onReAskMode,
  isSpeakingThis = false,
  className = "",
}: AnswerCardProps) {
  const [areSourcesExpanded, setAreSourcesExpanded] = useState<boolean>(false);

  // Subject color accent bar (Science = teal, Social Science = violet)
  const isScience = subject === "science";
  const subjectAccentBorder = isScience
    ? "border-l-4 border-l-[#0D9488]"
    : "border-l-4 border-l-[#7C3AED]";

  // Learning-mode colors with icons: Simple (sky), Step by step (violet), Example (teal), Exam style (indigo)
  const modeConfigs: Record<string, { label: string; badgeClass: string; activeClass: string }> = {
    simple: {
      label: "Simple",
      badgeClass: "bg-[var(--sky-soft)] text-[var(--sky)] border-[var(--sky)]/30",
      activeClass: "bg-[var(--sky)] text-white border-[var(--sky)]",
    },
    step_by_step: {
      label: "Step by step",
      badgeClass: "bg-[var(--violet-soft)] text-[var(--secondary-violet)] border-[var(--secondary-violet)]/30",
      activeClass: "bg-[var(--secondary-violet)] text-white border-[var(--secondary-violet)]",
    },
    example: {
      label: "Example",
      badgeClass: "bg-[var(--teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30",
      activeClass: "bg-[var(--accent-teal)] text-white border-[var(--accent-teal)]",
    },
    exam: {
      label: "Exam style",
      badgeClass: "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30",
      activeClass: "bg-[var(--primary)] text-white border-[var(--primary)]",
    },
  };

  const currentModeConfig = modeConfigs[mode] || modeConfigs.simple;
  const isOutOfScope = !grounded;

  // Format steps and key terms
  const renderFormattedAnswer = (text: string) => {
    if (!text && isStreaming) {
      return (
        <div className="flex items-center gap-2 py-4 text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-gentle-pulse" />
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-gentle-pulse [animation-delay:200ms]" />
          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-gentle-pulse [animation-delay:400ms]" />
          <span className="text-base font-semibold text-[var(--primary)] ml-2">
            Searching your textbook...
          </span>
        </div>
      );
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    return (
      <div className="space-y-4 max-w-[68ch]">
        {lines.map((line, idx) => {
          // Numbered step: "1. ..."
          const stepMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
          if (stepMatch) {
            const stepNum = stepMatch[1];
            const stepContent = stepMatch[2];
            return (
              <div key={idx} className="flex items-start gap-3 my-2.5">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-semibold text-sm flex items-center justify-center">
                  {stepNum}
                </span>
                <p className="text-[22px] font-normal text-[var(--text-primary)] leading-[1.65] flex-1">
                  {stepContent}
                </p>
              </div>
            );
          }

          // Bullet points
          if (line.startsWith("- ") || line.startsWith("• ")) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2">
                <span className="text-[var(--primary)] text-xl leading-none mt-1">•</span>
                <p className="text-[22px] font-normal text-[var(--text-primary)] leading-[1.65] flex-1">
                  {line.substring(2)}
                </p>
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-[22px] font-normal text-[var(--text-primary)] leading-[1.65]"
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
      className={`rounded-[20px] border p-6 sm:p-7 min-h-[180px] calm-fade shadow-[var(--shadow-card)] ${
        isOutOfScope
          ? "bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--text-primary)]"
          : `bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] ${subjectAccentBorder}`
      } ${className}`}
    >
      {/* Top Header: AI Tutor Label, Mode Chip, and Grounded Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-gradient text-white font-semibold flex items-center justify-center text-xs shadow-xs">
            AI
          </div>
          <span className="font-semibold text-sm text-[var(--text-primary)]">AI Tutor</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentModeConfig.badgeClass}`}
          >
            {currentModeConfig.label}
          </span>
        </div>

        {isOutOfScope && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/30 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Outside textbook</span>
          </span>
        )}
      </div>

      {/* Answer Content */}
      <div className="py-2">
        {isOutOfScope ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--warning)]">
              <HelpCircle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-xl font-semibold">
                Not found in your textbook
              </h3>
            </div>
            <p className="text-base text-[var(--text-muted)] leading-relaxed">
              I couldn&apos;t find this topic in your official Class 10 textbook chapters. Try asking about topics from your current units, or choose one of the suggestions below!
            </p>
          </div>
        ) : (
          renderFormattedAnswer(answerText)
        )}
      </div>

      {/* Action Row: Read Aloud (teal), Sources (neutral), Mode Switcher Segmented Control */}
      {!isStreaming && answerText && (
        <div className="mt-5 pt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            {onReadAloud && (
              <GazeButton
                id={`read-aloud-${id}`}
                onClick={onReadAloud}
                label={isSpeakingThis ? "Speaking..." : "Read Aloud"}
                icon={<Volume2 className="w-4 h-4 text-[var(--accent-teal)]" />}
                variant="card"
                size="compact"
                className="!h-9 !min-h-[36px] !px-3 !py-1 text-xs font-semibold !bg-[var(--teal-soft)]/40 hover:!bg-[var(--teal-soft)]/70 !border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
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
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] hover:border-[var(--primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold select-none cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sources ({sources.length})</span>
                {areSourcesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Mode Switcher Segmented Control */}
          {onReAskMode && originalQuestion && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-xs">
              {(["simple", "step_by_step", "example", "exam"] as const).map((m) => {
                const conf = modeConfigs[m];
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    id={`re-ask-${m}-${id}`}
                    type="button"
                    onClick={() => onReAskMode(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer calm-fade ${
                      isActive
                        ? conf.activeClass
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {conf.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sources Expansion Details */}
      {areSourcesExpanded && sources && sources.length > 0 && !isOutOfScope && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
          {sources.map((src, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5 text-xs shadow-xs"
            >
              <div className="font-semibold text-[var(--primary)] truncate">
                [{idx + 1}] {src.chapter_title || `Chapter ${src.chapter_no || ""}`}
              </div>
              {src.book_title && <div className="text-[var(--text-muted)] truncate">{src.book_title}</div>}
              <div className="text-[var(--text-muted)] text-[11px]">
                Pages {src.page_start} - {src.page_end}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up Questions Suggestions */}
      {suggestedQuestions && suggestedQuestions.length > 0 && onSelectSuggestion && !isStreaming && (
        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>You can also ask</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {suggestedQuestions.slice(0, 3).map((q, idx) => (
              <GazeButton
                key={idx}
                id={`suggested-q-${idx}`}
                onClick={() => onSelectSuggestion(q)}
                label={q}
                variant="card"
                size="large"
                className="w-full !h-[80px] !min-h-[80px] text-xs leading-snug justify-start text-left font-semibold"
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
