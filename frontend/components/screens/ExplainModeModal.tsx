"use client";

import React from "react";
import { Sparkles, X, ListOrdered, Lightbulb, GraduationCap, BookOpen } from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";

export interface ExplainModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: string;
  onSelectMode: (mode: "simple" | "step_by_step" | "example" | "exam") => void;
}

export function ExplainModeModal({
  isOpen,
  onClose,
  activeMode,
  onSelectMode,
}: ExplainModeModalProps) {
  if (!isOpen) return null;

  const modes: {
    id: "simple" | "step_by_step" | "example" | "exam";
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "simple",
      label: "Simple Mode",
      subtitle: "Short sentences and easy vocabulary",
      icon: <Sparkles className="w-6 h-6 text-amber-300" />,
    },
    {
      id: "step_by_step",
      label: "Step by Step",
      subtitle: "Clear numbered steps for easy following",
      icon: <ListOrdered className="w-6 h-6 text-teal-300" />,
    },
    {
      id: "example",
      label: "Real-Life Example",
      subtitle: "Relatable everyday scenarios & analogies",
      icon: <Lightbulb className="w-6 h-6 text-purple-300" />,
    },
    {
      id: "exam",
      label: "Exam Style",
      subtitle: "Textbook definitions, formulas, and bullet points",
      icon: <GraduationCap className="w-6 h-6 text-cyan-300" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-modal-title"
      className="fixed inset-0 z-[9985] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-2xl bg-[#0b1120] border-4 border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 calm-fade">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 id="mode-modal-title" className="text-xl sm:text-2xl font-black text-white">
                How should I explain this?
              </h2>
              <p className="text-xs font-semibold text-amber-300">
                Choose the learning style that feels best for you
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl bg-[#070b14] border-2 border-slate-700 hover:border-amber-400 text-slate-200 flex items-center justify-center cursor-pointer calm-fade"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Large Gaze Targets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modes.map((m) => {
            const isSelected = m.id === activeMode;
            return (
              <GazeButton
                key={m.id}
                id={`mode-select-${m.id}`}
                onClick={() => {
                  onSelectMode(m.id);
                  onClose();
                }}
                label={m.label}
                subtitle={m.subtitle}
                icon={m.icon}
                variant={isSelected ? "active" : "card"}
                size="large"
                className="w-full !min-h-[88px]"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
