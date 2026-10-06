"use client";

import React, { useState } from "react";
import { GazeButton } from "./gaze/GazeButton";

export type BoardType = "Tamil Nadu SCERT" | "CBSE / NCERT";
export type ClassType = "Std 6" | "Std 7" | "Std 8" | "Std 9" | "Std 10" | "Std 11" | "Std 12";
export type SubjectType = "Maths" | "Science" | "Social Science" | "English";

export function LearnChooser() {
  const [board, setBoard] = useState<BoardType | null>("Tamil Nadu SCERT");
  const [selectedClass, setSelectedClass] = useState<ClassType | null>("Std 10");
  const [subject, setSubject] = useState<SubjectType | null>("Science");
  const [step, setStep] = useState<"board" | "class" | "subject" | "summary">("summary");

  const boards: { id: BoardType; label: string; icon: string; desc: string }[] = [
    {
      id: "Tamil Nadu SCERT",
      label: "Tamil Nadu State Board",
      icon: "🏛️",
      desc: "Samacheer Kalvi syllabus for TN schools (English Medium)",
    },
    {
      id: "CBSE / NCERT",
      label: "CBSE / NCERT",
      icon: "🇮🇳",
      desc: "National curriculum textbooks from NCERT (Std 6–12)",
    },
  ];

  const middleClasses: ClassType[] = ["Std 6", "Std 7", "Std 8"];
  const highClasses: ClassType[] = ["Std 9", "Std 10", "Std 11", "Std 12"];

  const subjects: { id: SubjectType; label: string; icon: string; desc: string }[] = [
    { id: "Maths", label: "Mathematics", icon: "📐", desc: "Algebra, Geometry & Arithmetic" },
    { id: "Science", label: "Science", icon: "🔬", desc: "Physics, Chemistry & Biology" },
    { id: "Social Science", label: "Social Science", icon: "🌍", desc: "History, Civics & Geography" },
    { id: "English", label: "English", icon: "📚", desc: "Prose, Grammar & Comprehension" },
  ];

  return (
    <div className="space-y-6">
      {/* Interactive Breadcrumb Bar */}
      <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2 text-sm font-black">
          <span className="text-slate-400">Curriculum Path:</span>
          <button
            onClick={() => setStep("board")}
            className="px-3 py-1.5 rounded-xl bg-[#0d1527] border border-amber-400/60 text-amber-300 hover:bg-amber-400 hover:text-slate-950 transition-colors cursor-pointer"
          >
            {board || "Select Board"}
          </button>
          <span className="text-slate-500">▶</span>
          <button
            onClick={() => setStep("class")}
            className="px-3 py-1.5 rounded-xl bg-[#0d1527] border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-colors cursor-pointer"
          >
            {selectedClass || "Select Class"}
          </button>
          <span className="text-slate-500">▶</span>
          <button
            onClick={() => setStep("subject")}
            className="px-3 py-1.5 rounded-xl bg-[#0d1527] border border-emerald-400/60 text-emerald-300 hover:bg-emerald-400 hover:text-slate-950 transition-colors cursor-pointer"
          >
            {subject || "Select Subject"}
          </button>
        </div>

        {step !== "summary" && (
          <button
            onClick={() => setStep("summary")}
            className="px-3 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            Back to Overview
          </button>
        )}
      </div>

      {/* Step 1: Board Chooser (Max 2 items) */}
      {step === "board" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">Step 1: Choose Educational Board</h3>
            <span className="text-sm font-bold text-amber-300">Look at a card to select</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {boards.map((b) => (
              <GazeButton
                key={b.id}
                id={`board-btn-${b.id.replace(/\s+/g, "-")}`}
                onClick={() => {
                  setBoard(b.id);
                  setStep("class");
                }}
                label={b.label}
                icon={b.icon}
                subtitle={b.desc}
                variant={board === b.id ? "active" : "card"}
                size="large"
                className="!min-h-[110px]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Class Chooser (Organized in 2 rows, max 4 items per row, generous spacing) */}
      {step === "class" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">Step 2: Choose Class / Standard</h3>
            <span className="text-sm font-bold text-cyan-300">Selected Board: {board}</span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Middle School (Std 6 – 8)
              </p>
              <div className="grid grid-cols-3 gap-6">
                {middleClasses.map((cls) => (
                  <GazeButton
                    key={cls}
                    id={`class-btn-${cls.replace(/\s+/g, "-")}`}
                    onClick={() => {
                      setSelectedClass(cls);
                      setStep("subject");
                    }}
                    label={cls}
                    icon="🎓"
                    variant={selectedClass === cls ? "active" : "card"}
                    size="default"
                    className="!min-h-[80px] justify-center text-center"
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                High & Higher Secondary School (Std 9 – 12)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {highClasses.map((cls) => (
                  <GazeButton
                    key={cls}
                    id={`class-btn-${cls.replace(/\s+/g, "-")}`}
                    onClick={() => {
                      setSelectedClass(cls);
                      setStep("subject");
                    }}
                    label={cls}
                    icon="🎓"
                    variant={selectedClass === cls ? "active" : "card"}
                    size="default"
                    className="!min-h-[80px] justify-center text-center"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Subject Chooser (Max 4 items in 2x2 grid) */}
      {step === "subject" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">Step 3: Choose Subject</h3>
            <span className="text-sm font-bold text-emerald-300">
              {board} • {selectedClass}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {subjects.map((sub) => (
              <GazeButton
                key={sub.id}
                id={`subject-btn-${sub.id.replace(/\s+/g, "-")}`}
                onClick={() => {
                  setSubject(sub.id);
                  setStep("summary");
                }}
                label={sub.label}
                icon={sub.icon}
                subtitle={sub.desc}
                variant={subject === sub.id ? "active" : "card"}
                size="large"
                className="!min-h-[100px]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Summary Card & Quick Action Buttons */}
      {step === "summary" && (
        <div className="space-y-6">
          <div className="bg-[#131f38] border-4 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <span className="text-5xl" role="img" aria-label="Book Stack">
                  📚
                </span>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                    Active Textbook Selection
                  </span>
                  <h3 className="text-3xl font-black text-white mt-1">
                    {board}
                  </h3>
                  <p className="text-xl font-bold text-amber-300">
                    {selectedClass} • {subject}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-base text-slate-300 leading-relaxed mb-6">
              Your textbook curriculum is configured. When the RAG assistant is connected in later phases,
              questions and voice queries will automatically cite chapters and pages from this syllabus.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <GazeButton
                id="change-board-btn"
                onClick={() => setStep("board")}
                label="Change Board"
                icon="🏛️"
                variant="card"
                size="default"
              />
              <GazeButton
                id="change-class-btn"
                onClick={() => setStep("class")}
                label="Change Class"
                icon="🎓"
                variant="card"
                size="default"
              />
              <GazeButton
                id="change-subject-btn"
                onClick={() => setStep("subject")}
                label="Change Subject"
                icon="📖"
                variant="card"
                size="default"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
