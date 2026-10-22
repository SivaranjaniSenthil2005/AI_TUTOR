"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Volume2,
  Mic,
  Camera,
  Server,
  Eye,
  Settings,
  Shield,
  BookOpen,
  Atom,
  Globe,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Stepper } from "@/components/ui/Stepper";
import { Skeleton } from "@/components/ui/Skeleton";
import { TutorMascot } from "@/components/ui/TutorMascot";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnswerCard } from "@/components/screens/AnswerCard";
import { GazeProvider } from "@/lib/gazeui/GazeContext";

export default function DesignSystemPage() {
  const [dummyGazePoint] = useState({
    current: { x: 0.5, y: 0.5, xPx: 500, yPx: 500, confidence: 1, timestamp: 0, valid: false },
  });

  return (
    <GazeProvider gazePointRef={dummyGazePoint}>
      <DesignSystemContent />
    </GazeProvider>
  );
}

function DesignSystemContent() {
  const [theme, setTheme] = useState<"bright" | "calm-night" | "high-contrast">("bright");
  const [stepperVal, setStepperVal] = useState<number>(1200);
  const [segmentVal, setSegmentVal] = useState<string>("simple");

  const handleThemeChange = (newTheme: "bright" | "calm-night" | "high-contrast") => {
    setTheme(newTheme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", newTheme);
      if (newTheme === "high-contrast") {
        document.documentElement.classList.add("high-contrast");
      } else {
        document.documentElement.classList.remove("high-contrast");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6 sm:p-12 space-y-12 overflow-y-auto">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--primary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              AI Tutor Design System
            </h1>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Bright, Calm, Accessible, Zero-Layout-Shift Component Library for Young Learners
            </p>
          </div>
        </div>

        {/* Theme Switcher: Bright, Calm Night, High contrast */}
        <div className="w-80">
          <SegmentedControl
            options={[
              { value: "bright", label: "Bright" },
              { value: "calm-night", label: "Calm Night" },
              { value: "high-contrast", label: "High Contrast" },
            ]}
            value={theme}
            onChange={(val) => handleThemeChange(val as "bright" | "calm-night" | "high-contrast")}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* SECTION 1: COLOR TOKENS */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            1. Core Design Tokens (Bright Theme Default)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#4F46E5]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Brand Indigo</div>
              <div className="text-[10px] text-[var(--text-muted)]">#4F46E5</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#7C3AED]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Secondary Violet</div>
              <div className="text-[10px] text-[var(--text-muted)]">#7C3AED</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#0D9488]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Accent Teal</div>
              <div className="text-[10px] text-[var(--text-muted)]">#0D9488</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#0284C7]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Sky Blue</div>
              <div className="text-[10px] text-[var(--text-muted)]">#0284C7</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#15803D]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Success Green</div>
              <div className="text-[10px] text-[var(--text-muted)]">#15803D</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-1 shadow-xs">
              <div className="w-full h-8 rounded-lg bg-[#F59E0B]" />
              <div className="text-xs font-semibold text-[var(--text-primary)]">Amber Dwell Ring</div>
              <div className="text-[10px] text-[var(--text-muted)]">#F59E0B</div>
            </div>
          </div>
        </section>

        {/* SECTION 2: ORIGINAL TUTOR BUDDY MASCOT */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            2. Tutor Buddy Mascot (4 Expressions)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col items-center gap-2 shadow-xs">
              <TutorMascot expression="idle" size={88} />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Idle (Greeting)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col items-center gap-2 shadow-xs">
              <TutorMascot expression="listening" size={88} />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Listening (Voice)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col items-center gap-2 shadow-xs">
              <TutorMascot expression="thinking" size={88} />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Thinking (Searching)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col items-center gap-2 shadow-xs">
              <TutorMascot expression="speaking" size={88} />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Speaking (Read Aloud)</span>
            </div>
          </div>
        </section>

        {/* SECTION 3: GAZE BUTTONS IN ALL STATES */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            3. Gaze Button States & Variants
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Fixed 20px radius, 1px border, left icon in soft colored circle, amber dwell progress, zero layout shift.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GazeButton
              id="spec-primary-btn"
              onClick={() => {}}
              label="Primary Brand Action"
              subtitle="Filled with brand gradient"
              icon={<Mic className="w-5 h-5 text-white" />}
              variant="primary"
              size="large"
            />
            <GazeButton
              id="spec-card-btn"
              onClick={() => {}}
              label="Card Variant (Default)"
              subtitle="White surface with subtle border"
              icon={<Volume2 className="w-5 h-5 text-[var(--accent-teal)]" />}
              variant="card"
              size="large"
            />
            <GazeButton
              id="spec-active-btn"
              onClick={() => {}}
              label="Active State"
              subtitle="Ring + check badge, no fill swap"
              icon={<Sparkles className="w-5 h-5 text-[var(--secondary-violet)]" />}
              variant="active"
              size="large"
            />
            <GazeButton
              id="spec-disabled-btn"
              onClick={() => {}}
              label="Disabled State"
              subtitle="Muted opacity"
              disabled
              icon={<BookOpen className="w-5 h-5 text-[var(--text-muted)]" />}
              variant="card"
              size="large"
            />
            <GazeButton
              id="spec-accent-btn"
              onClick={() => {}}
              label="Teal Accent (Science)"
              subtitle="Soft tinted background"
              icon={<Atom className="w-5 h-5 text-[var(--accent-teal)]" />}
              variant="accent"
              size="large"
            />
            <GazeButton
              id="spec-danger-btn"
              onClick={() => {}}
              label="Stop / Danger"
              subtitle="Soft rose warning"
              icon={<AlertCircle className="w-5 h-5 text-[var(--error)]" />}
              variant="danger"
              size="large"
            />
          </div>
        </section>

        {/* SECTION 4: STATUS PILLS & FEEDBACK */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            4. Compact Status Indicators (&le; 8 Characters)
          </h2>
          <div className="flex flex-wrap gap-3">
            <StatusPill
              id="demo-status-server"
              icon={<Server className="w-3 h-3" />}
              label="Server"
              value="Connected (healthy)"
              variant="success"
            />
            <StatusPill
              id="demo-status-camera"
              icon={<Camera className="w-3 h-3" />}
              label="Camera"
              value="Tracking active"
              variant="success"
            />
            <StatusPill
              id="demo-status-eyes"
              icon={<Eye className="w-3 h-3" />}
              label="Eyes"
              value="Needs calibration"
              variant="warning"
            />
            <StatusPill
              id="demo-status-mic"
              icon={<Mic className="w-3 h-3" />}
              label="Mic"
              value="Ready for voice input"
              variant="neutral"
            />
          </div>
        </section>

        {/* SECTION 5: LEARNING MODE SWITCHER */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            5. Learning Mode Color Coding
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[var(--sky-soft)] border border-[var(--sky)]/30 text-[var(--sky)] text-xs font-semibold text-center">
              Simple (Sky)
            </div>
            <div className="p-3 rounded-xl bg-[var(--violet-soft)] border border-[var(--secondary-violet)]/30 text-[var(--secondary-violet)] text-xs font-semibold text-center">
              Step by step (Violet)
            </div>
            <div className="p-3 rounded-xl bg-[var(--teal-soft)] border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] text-xs font-semibold text-center">
              Example (Teal)
            </div>
            <div className="p-3 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/30 text-[var(--primary)] text-xs font-semibold text-center">
              Exam style (Indigo)
            </div>
          </div>
        </section>

        {/* SECTION 6: EMPTY STATE PREVIEW */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--primary)] uppercase tracking-wide">
            6. Empty State Greeting Banner
          </h2>
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
            <EmptyState
              board="tn"
              subject="science"
              boardName="Tamil Nadu"
              subjectName="Science"
              onSelectQuestion={() => {}}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
