"use client";

import React from "react";
import { Atom, Globe, BookOpen } from "lucide-react";
import { GazeButton } from "./GazeButton";
import { TutorMascot } from "./TutorMascot";
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
  const isScience = subject === "science";
  const subjectIcon = isScience ? (
    <Atom className="w-5 h-5 text-[var(--accent-teal)]" />
  ) : (
    <Globe className="w-5 h-5 text-[var(--secondary-violet)]" />
  );

  return (
    <div
      id="chat-empty-state"
      className="max-w-3xl mx-auto my-auto flex flex-col items-center text-center space-y-6 select-none"
    >
      {/* Friendly Greeting Banner with Soft Brand Gradient Tint & Mascot */}
      <div className="w-full rounded-[20px] bg-gradient-to-br from-[var(--primary-soft)]/70 to-[var(--violet-soft)]/50 border border-[var(--border-subtle)] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[var(--shadow-card)]">
        <div className="text-left space-y-2 flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-muted)] border border-[var(--border-subtle)]">
            <BookOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>
              {boardName || (board === "tn" ? "Tamil Nadu" : "CBSE")} • Class 10 • {subjectName || (isScience ? "Science" : "Social Science")}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
            Hi! What would you like to learn today?
          </h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Look at any question below to ask, or choose <span className="font-semibold text-[var(--primary)]">Ask with Voice</span> in the dock to speak naturally.
          </p>
        </div>

        {/* Original Mascot: Tutor Buddy (Idle Expression) */}
        <div className="flex-shrink-0">
          <TutorMascot expression="idle" size={96} />
        </div>
      </div>

      {/* 3 Starter Question Cards as Soft Colored Tiles */}
      <div className="w-full space-y-3 pt-1 text-left">
        <span className="text-xs font-semibold tracking-normal text-[var(--text-muted)] block px-1">
          You can start with:
        </span>
        <div className="grid grid-cols-1 gap-3">
          {starters.slice(0, 3).map((starter, idx) => (
            <GazeButton
              key={starter.id}
              id={`starter-q-${idx}`}
              onClick={() => onSelectQuestion(starter.question)}
              label={starter.question}
              subtitle={starter.topic}
              icon={subjectIcon}
              variant="card"
              size="large"
              className={`w-full !h-[84px] !min-h-[84px] font-semibold ${
                isScience
                  ? "!bg-[var(--teal-soft)]/20 hover:!bg-[var(--teal-soft)]/50 !border-[var(--accent-teal)]/20 hover:!border-[var(--accent-teal)]"
                  : "!bg-[var(--violet-soft)]/20 hover:!bg-[var(--violet-soft)]/50 !border-[var(--secondary-violet)]/20 hover:!border-[var(--secondary-violet)]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
