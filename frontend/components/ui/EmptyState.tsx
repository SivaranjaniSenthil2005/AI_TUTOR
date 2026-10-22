"use client";

import React from "react";
import { Sparkles, BookOpen } from "lucide-react";
import { GazeButton } from "./GazeButton";
import { getStarterQuestions } from "@/lib/config/starterQuestions";

export interface EmptyStateProps {
  board: string;
  subject: string;
  boardName?: string;
  subjectName?: string;
  onSelectQuestion: (question: string) => void;
}

export function EmptyState({
  board,
  subject,
  boardName,
  subjectName,
  onSelectQuestion,
}: EmptyStateProps) {
  const starters = getStarterQuestions(board, subject);

  return (
    <div
      id="chat-empty-state"
      className="max-w-3xl mx-auto my-auto flex flex-col items-center text-center p-6 sm:p-10 rounded-3xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] shadow-md space-y-6"
    >
      {/* Friendly Icon */}
      <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-400/15 border-2 border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-xs">
        <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-300" />
      </div>

      {/* Greeting and Context */}
      <div className="space-y-1.5">
        <h3 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
          Hello! What would you like to explore today?
        </h3>
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            {boardName || board.toUpperCase()} • Class 10 • {subjectName || subject}
          </span>
        </p>
      </div>

      <p className="text-sm text-[var(--text-secondary)] max-w-lg leading-relaxed">
        Look at a question below to ask, or choose <strong className="text-amber-700 dark:text-amber-300">Ask with Voice</strong> in the dock to speak your question naturally.
      </p>

      {/* 3 Starter Questions */}
      <div className="w-full space-y-3 pt-2">
        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block text-left sm:text-center">
          Try asking one of these:
        </span>
        <div className="grid grid-cols-1 gap-3 text-left">
          {starters.map((starter, idx) => (
            <GazeButton
              key={starter.id}
              id={`starter-q-${idx}`}
              onClick={() => onSelectQuestion(starter.question)}
              label={starter.question}
              subtitle={starter.topic}
              icon={<BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-300" />}
              variant="card"
              size="default"
              className="w-full !min-h-[80px]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
