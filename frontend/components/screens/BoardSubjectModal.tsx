"use client";

import React, { useState } from "react";
import { BookOpen, X, Check } from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";

export interface BoardSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoard: string;
  currentSubject: string;
  onSave: (board: string, subject: string) => void;
}

export function BoardSubjectModal({
  isOpen,
  onClose,
  currentBoard,
  currentSubject,
  onSave,
}: BoardSubjectModalProps) {
  const [selectedBoard, setSelectedBoard] = useState<string>(currentBoard);
  const [selectedSubject, setSelectedSubject] = useState<string>(currentSubject);

  if (!isOpen) return null;

  const handleApply = () => {
    onSave(selectedBoard, selectedSubject);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-subject-modal-title"
      className="fixed inset-0 z-[9985] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 calm-fade">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="board-subject-modal-title" className="text-xl font-semibold text-[var(--text-primary)]">
                Choose Board & Subject
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Class 10 Syllabus Grounding
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

        {/* 1. Board Selection */}
        <div className="space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] block">
            1. Select Your School Board
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GazeButton
              id="modal-board-tn"
              onClick={() => setSelectedBoard("tn")}
              label="Tamil Nadu State Board"
              subtitle="Samacheer Kalvi · Std 10"
              variant={selectedBoard === "tn" ? "active" : "card"}
              size="default"
              className="w-full !min-h-[84px]"
            />
            <GazeButton
              id="modal-board-cbse"
              onClick={() => setSelectedBoard("cbse")}
              label="CBSE / NCERT"
              subtitle="National Curriculum · Class 10"
              variant={selectedBoard === "cbse" ? "active" : "card"}
              size="default"
              className="w-full !min-h-[84px]"
            />
          </div>
        </div>

        {/* 2. Subject Selection */}
        <div className="space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] block">
            2. Select Your Subject
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GazeButton
              id="modal-subj-science"
              onClick={() => setSelectedSubject("science")}
              label="Science"
              subtitle="Physics, Chemistry, Biology"
              variant={selectedSubject === "science" ? "active" : "card"}
              size="default"
              className="w-full !min-h-[84px]"
            />
            <GazeButton
              id="modal-subj-social"
              onClick={() => setSelectedSubject("social_science")}
              label="Social Science"
              subtitle="History, Civics, Geography, Economics"
              variant={selectedSubject === "social_science" ? "active" : "card"}
              size="default"
              className="w-full !min-h-[84px]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-6 rounded-xl bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-strong)] font-bold text-sm cursor-pointer calm-fade"
          >
            Cancel
          </button>
          <button
            id="modal-save-board-subject-btn"
            type="button"
            onClick={handleApply}
            className="h-12 px-8 rounded-xl bg-brand-gradient hover:brightness-105 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer calm-fade shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>Apply Selection</span>
          </button>
        </div>
      </div>
    </div>
  );
}
