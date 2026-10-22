"use client";

import React, { useState } from "react";
import type { SourceCitation } from "@/lib/api/types";
import { GazeButton } from "@/components/gaze/GazeButton";
import { alignSentences } from "@/lib/voice/sentenceAligner";

export interface AnswerDisplayProps {
  answerText: string;
  speechText?: string;
  sources?: SourceCitation[];
  grounded?: boolean;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  currentSpeechSentenceIdx?: number;
  mode?: string;
}

export function AnswerDisplay({
  answerText,
  speechText = "",
  sources = [],
  grounded = true,
  isStreaming = false,
  isSpeaking = false,
  currentSpeechSentenceIdx = 0,
  mode,
}: AnswerDisplayProps) {
  const [showSourcesList, setShowSourcesList] = useState<boolean>(false);
  const [selectedCitationIndex, setSelectedCitationIndex] = useState<number | null>(null);

  // Parse [n] tokens in a single sentence safely into text and citation chips
  const renderSentenceWithChips = (sentenceText: string) => {
    const parts = sentenceText.split(/(\[\d+\])/g);
    return parts.map((part, pIdx) => {
      const match = /^\[(\d+)\]$/.exec(part);
      if (match) {
        const citationNum = parseInt(match[1], 10);
        const source = sources.find((s) => s.citation_index === citationNum);
        return (
          <button
            key={`cite-${pIdx}`}
            type="button"
            onClick={() => {
              setSelectedCitationIndex(citationNum);
              setShowSourcesList(true);
            }}
            className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 text-xs font-black rounded-md bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer align-baseline"
            title={source ? `${source.book_title} (p. ${source.page_start})` : `Citation ${citationNum}`}
            aria-label={`View citation ${citationNum}`}
          >
            [{citationNum}]
          </button>
        );
      }
      return <span key={`txt-${pIdx}`}>{part}</span>;
    });
  };

  // Determine read-along sentence highlighting
  const alignment = isSpeaking ? alignSentences(answerText, speechText || answerText) : null;
  const activeDisplaySentenceIdx = alignment
    ? alignment.getDisplayHighlightIndex(currentSpeechSentenceIdx)
    : -1;
  const isWholeBlockHighlighted = isSpeaking && activeDisplaySentenceIdx === -1;

  return (
    <div className="space-y-4">
      {/* Mode Tag if specified */}
      {mode && (
        <div className="inline-block">
          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--bg-surface-raised)] text-cyan-700 dark:text-cyan-300 border border-[var(--border-strong)]">
            Mode: {mode.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {/* Low Grounding / Out-of-curriculum Notice */}
      {!grounded && !isStreaming && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500/80 rounded-2xl p-4 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <span className="text-xl" role="img" aria-label="Book Notice">
            📖
          </span>
          <div>
            <p className="font-bold">
              I couldn&apos;t find this directly in your Class 10 textbook.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
              The answer below is a general explanation. You may want to rephrase or verify with your syllabus.
            </p>
          </div>
        </div>
      )}

      {/* Answer Body Text with Plain Text + Citation Chips + Read-along */}
      <div
        className={`text-base sm:text-lg leading-relaxed transition-colors ${
          isWholeBlockHighlighted
            ? "bg-amber-400/20 text-[var(--text-primary)] rounded-xl p-3 border-2 border-amber-400/60"
            : "text-[var(--text-primary)]"
        }`}
        aria-live="polite"
      >
        {alignment && alignment.matches ? (
          // Sentence-by-sentence rendering with individual highlight
          alignment.displayedSentences.map((sChunk, idx) => {
            const isThisSentenceActive = idx === activeDisplaySentenceIdx;
            return (
              <span
                key={`sent-${idx}`}
                className={`transition-colors duration-150 rounded px-1 ${
                  isThisSentenceActive
                    ? "bg-amber-400 text-slate-950 font-medium shadow-sm"
                    : ""
                }`}
              >
                {renderSentenceWithChips(sChunk.text)}{" "}
              </span>
            );
          })
        ) : (
          // Fallback plain rendering with chips
          renderSentenceWithChips(answerText)
        )}

        {/* Streaming Cursor */}
        {isStreaming && (
          <span className="inline-block w-2.5 h-5 bg-amber-400 ml-1.5 animate-pulse align-middle" />
        )}
      </div>

      {/* Sources Toggle Button & Expandable List */}
      {sources.length > 0 && !isStreaming && (
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center gap-3">
            <GazeButton
              id="expand-sources-btn"
              onClick={() => setShowSourcesList((prev) => !prev)}
              label={showSourcesList ? "Hide Textbook Sources" : `View Sources (${sources.length})`}
              icon="📚"
              variant="card"
              size="compact"
              className="!min-h-[46px] text-xs font-bold"
            />
          </div>

          {showSourcesList && (
            <div className="bg-[var(--bg-surface-raised)] border-2 border-[var(--border-strong)] rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                Textbook Citations
              </h4>
              <div className="space-y-2">
                {sources.map((src) => {
                  const isSelected = selectedCitationIndex === src.citation_index;
                  return (
                    <div
                      key={src.citation_index}
                      className={`p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                        isSelected
                          ? "bg-[var(--bg-surface)] border-amber-500 text-[var(--text-primary)] shadow-md"
                          : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-amber-700 dark:text-amber-300 mb-1">
                        <span>
                          [{src.citation_index}] {src.book_title}
                        </span>
                        <span className="text-[11px] bg-[var(--bg-surface-raised)] px-2 py-0.5 rounded text-[var(--text-muted)] border border-[var(--border-strong)]">
                          pp. {src.page_start}–{src.page_end}
                        </span>
                      </div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {src.chapter_title}
                        {src.section_title ? ` • ${src.section_title}` : ""}
                      </p>
                      {src.text_snippet && (
                        <p className="mt-1 text-[var(--text-muted)] text-xs italic line-clamp-2">
                          &ldquo;{src.text_snippet}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
