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
} from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusPill } from "@/components/ui/StatusPill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Stepper } from "@/components/ui/Stepper";
import { Skeleton } from "@/components/ui/Skeleton";
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
  const [theme, setTheme] = useState<"calm" | "light" | "high-contrast">("calm");
  const [stepperVal, setStepperVal] = useState<number>(1200);
  const [segmentVal, setSegmentVal] = useState<string>("simple");

  const handleThemeChange = (newTheme: "calm" | "light" | "high-contrast") => {
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
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-[#0d1527] border-2 border-slate-700 hover:border-amber-400 flex items-center justify-center text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              AI Tutor Design System
            </h1>
            <p className="text-sm font-semibold text-amber-300">
              Calm, Accessible, Zero-Layout-Shift Component Library for Young Learners
            </p>
          </div>
        </div>

        {/* Theme Switcher */}
        <div className="w-72">
          <SegmentedControl
            options={[
              { value: "calm", label: "Calm" },
              { value: "light", label: "Light" },
              { value: "high-contrast", label: "High Contrast" },
            ]}
            value={theme}
            onChange={(val) => handleThemeChange(val as "calm" | "light" | "high-contrast")}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* SECTION 1: COLOR TOKENS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            1. Core Color Tokens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-[#070b14] border-2 border-slate-700 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-[#070b14] border border-slate-600" />
              <div className="text-xs font-bold text-white">Deep Navy</div>
              <div className="text-[10px] text-slate-400">#070b14</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0b1120] border-2 border-slate-700 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-[#0b1120]" />
              <div className="text-xs font-bold text-white">Surface Card</div>
              <div className="text-[10px] text-slate-400">#0b1120</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0d1527] border-2 border-slate-700 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-[#0d1527]" />
              <div className="text-xs font-bold text-white">Header / Dock</div>
              <div className="text-[10px] text-slate-400">#0d1527</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-400 text-slate-950 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-amber-400" />
              <div className="text-xs font-black">Amber Accent</div>
              <div className="text-[10px] font-semibold text-slate-900">#fbbf24</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-950 text-emerald-200 border-2 border-emerald-500/50 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-emerald-400" />
              <div className="text-xs font-black text-emerald-300">Teal Success</div>
              <div className="text-[10px] text-emerald-400">#10b981</div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-950 text-rose-200 border-2 border-rose-500/50 text-center space-y-1">
              <div className="w-full h-8 rounded-lg bg-rose-500" />
              <div className="text-xs font-black text-rose-300">Coral Warning</div>
              <div className="text-[10px] text-rose-400">#f43f5e</div>
            </div>
          </div>
        </section>

        {/* SECTION 2: GAZE BUTTONS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            2. Gaze Button Component Spec
          </h2>
          <p className="text-sm text-slate-400">
            Height: 88px (104px for XL primary), min-width 176px, 20px radius, static reserved borders, zero layout shift, inner progress ring.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GazeButton
              id="spec-primary-btn"
              onClick={() => {}}
              label="Primary Action (XL)"
              subtitle="Largest, accent color"
              icon={<Mic className="w-6 h-6" />}
              variant="primary"
              size="xl"
            />
            <GazeButton
              id="spec-card-btn"
              onClick={() => {}}
              label="Standard Gaze Button"
              subtitle="Card variant with icon"
              icon={<Volume2 className="w-5 h-5 text-amber-300" />}
              variant="card"
              size="default"
            />
            <GazeButton
              id="spec-active-btn"
              onClick={() => {}}
              label="Active State"
              subtitle="Highlighted mode"
              icon={<Sparkles className="w-5 h-5 text-slate-950" />}
              variant="active"
              size="default"
            />
            <GazeButton
              id="spec-danger-btn"
              onClick={() => {}}
              label="Danger Action"
              subtitle="Cancel or Stop audio"
              variant="danger"
              size="default"
            />
            <GazeButton
              id="spec-outline-btn"
              onClick={() => {}}
              label="Outline Variant"
              subtitle="Secondary option"
              variant="outline"
              size="default"
            />
            <GazeButton
              id="spec-disabled-btn"
              onClick={() => {}}
              label="Disabled State"
              subtitle="Non-interactive"
              disabled
              variant="card"
              size="default"
            />
          </div>
        </section>

        {/* SECTION 3: STATUS PILLS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            3. Fixed-Slot Status Pills
          </h2>
          <p className="text-sm text-slate-400">
            Fixed 148px width slots to ensure zero layout shift when server or hardware status changes.
          </p>
          <div className="flex flex-wrap gap-3">
            <StatusPill
              icon={<Server className="w-3.5 h-3.5" />}
              label="Server"
              value="Server connected"
              variant="success"
            />
            <StatusPill
              icon={<Server className="w-3.5 h-3.5" />}
              label="Server"
              value="Connecting..."
              variant="warning"
            />
            <StatusPill
              icon={<Server className="w-3.5 h-3.5" />}
              label="Server"
              value="Server offline"
              variant="danger"
            />
            <StatusPill
              icon={<Camera className="w-3.5 h-3.5" />}
              label="Camera"
              value="Camera on"
              variant="success"
            />
            <StatusPill
              icon={<Camera className="w-3.5 h-3.5" />}
              label="Camera"
              value="Camera off"
              variant="neutral"
            />
            <StatusPill
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Eyes"
              value="Eyes ready"
              variant="success"
            />
            <StatusPill
              icon={<Mic className="w-3.5 h-3.5" />}
              label="Mic"
              value="Mic listening"
              variant="warning"
            />
          </div>
        </section>

        {/* SECTION 4: STEPPERS & SEGMENTED CONTROLS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            4. Steppers & Segmented Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Stepper
              label="Eye Hold Duration (Dwell Time)"
              value={stepperVal}
              min={600}
              max={2400}
              step={200}
              formatValue={(ms) => `${(ms / 1000).toFixed(1)}s`}
              onChange={(val) => setStepperVal(val)}
            />

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200">Segmented Control</label>
              <SegmentedControl
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "step", label: "Step by step" },
                  { value: "example", label: "Example" },
                  { value: "exam", label: "Exam Style" },
                ]}
                value={segmentVal}
                onChange={(val) => setSegmentVal(val)}
              />
            </div>
          </div>
        </section>

        {/* SECTION 5: CHIPS & CARDS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            5. Chips & Cards
          </h2>
          <div className="flex flex-wrap gap-2">
            <Chip variant="amber">Simple Mode</Chip>
            <Chip variant="teal">Step by Step</Chip>
            <Chip variant="purple">Example Mode</Chip>
            <Chip variant="cyan">Exam Style</Chip>
            <Chip variant="slate">Standard Mode</Chip>
            <Chip variant="rose">Out of Scope</Chip>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card variant="surface">
              <h3 className="font-bold text-white mb-1">Surface Card</h3>
              <p className="text-xs text-slate-400">Default dark card container.</p>
            </Card>
            <Card variant="raised">
              <h3 className="font-bold text-white mb-1">Raised Card</h3>
              <p className="text-xs text-slate-400">Higher elevation for active dialogs.</p>
            </Card>
            <Card variant="highlight">
              <h3 className="font-bold text-amber-300 mb-1">Highlight Card</h3>
              <p className="text-xs text-slate-300">Border accent for active items.</p>
            </Card>
          </div>
        </section>

        {/* SECTION 6: SKELETON LOADERS */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-amber-300 uppercase tracking-wider">
            6. Reserved-Space Skeletons
          </h2>
          <div className="p-6 rounded-3xl bg-[#0b1120] border-2 border-slate-800 space-y-3">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-5/6" />
            <Skeleton variant="rectangular" className="w-full h-16" />
          </div>
        </section>
      </div>
    </div>
  );
}
