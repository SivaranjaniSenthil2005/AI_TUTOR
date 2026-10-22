"use client";

import React, { useState, useEffect, useRef } from "react";
import { Keyboard, Send, X } from "lucide-react";

export interface TypeQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: string) => void;
}

export function TypeQuestionModal({
  isOpen,
  onClose,
  onSubmit,
}: TypeQuestionModalProps) {
  const [typedQuestion, setTypedQuestion] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedQuestion.trim()) return;
    const q = typedQuestion.trim();
    setTypedQuestion("");
    onSubmit(q);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="type-question-modal-title"
      className="fixed inset-0 z-[9985] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border-4 border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 calm-fade"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-bold">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="type-question-modal-title" className="text-xl font-semibold text-[var(--text-primary)]">
                Type Your Question
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Ask anything from your Class 10 textbook
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] hover:border-[var(--primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer calm-fade"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              id="typed-question-input"
              type="text"
              value={typedQuestion}
              onChange={(e) => setTypedQuestion(e.target.value)}
              placeholder="e.g. What is Ohm's Law and its formula?"
              className="w-full h-16 px-5 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] focus:border-[var(--primary)] text-[var(--text-primary)] font-semibold text-lg sm:text-xl placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-3 focus:ring-[var(--focus-ring)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-14 px-6 rounded-2xl bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-base cursor-pointer calm-fade"
            >
              Cancel
            </button>
            <button
              id="typed-question-submit-btn"
              type="submit"
              disabled={!typedQuestion.trim()}
              className="h-14 px-8 rounded-2xl bg-brand-gradient hover:brightness-105 active:brightness-95 text-white font-semibold text-lg border-0 shadow-sm flex items-center gap-2 cursor-pointer calm-fade disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
              <span>Ask Tutor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
