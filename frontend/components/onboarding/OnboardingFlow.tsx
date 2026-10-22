"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Camera,
  Target,
  BookOpen,
  CheckCircle2,
  MousePointer,
  ArrowRight,
  Shield,
} from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { getScope, FALLBACK_SCOPE } from "@/lib/api/client";
import type { ScopeResponse } from "@/lib/api/types";

export interface OnboardingResult {
  board: string;
  subject: string;
  classLevel: number;
  useEyeControl: boolean;
}

export interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
  isCameraActive: boolean;
  onStartCamera: () => void;
  onOpenCalibration: () => void;
  isCalibrated: boolean;
}

type OnboardingStep = "welcome" | "camera" | "calibrate" | "board" | "subject" | "ready";

const STEP_ORDER: OnboardingStep[] = ["welcome", "camera", "calibrate", "board", "subject", "ready"];

export function OnboardingFlow({
  onComplete,
  isCameraActive,
  onStartCamera,
  onOpenCalibration,
  isCalibrated,
}: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [useEyeControl, setUseEyeControl] = useState<boolean>(true);
  const [scope, setScope] = useState<ScopeResponse>(FALLBACK_SCOPE);
  const [selectedBoard, setSelectedBoard] = useState<string>("tn");
  const [selectedSubject, setSelectedSubject] = useState<string>("science");

  useEffect(() => {
    let active = true;
    getScope().then((data) => {
      if (active && data) {
        setScope(data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const currentStepIdx = STEP_ORDER.indexOf(step);

  const handleFinishOnboarding = () => {
    try {
      localStorage.setItem("ai_tutor_onboarding_completed", "true");
      localStorage.setItem("ai_tutor_selected_board", selectedBoard);
      localStorage.setItem("ai_tutor_selected_subject", selectedSubject);
      localStorage.setItem("ai_tutor_eye_control_enabled", useEyeControl ? "true" : "false");
    } catch {}

    onComplete({
      board: selectedBoard,
      subject: selectedSubject,
      classLevel: 10,
      useEyeControl,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none"
    >
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border-4 border-[var(--border-subtle)] rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center text-center space-y-6 my-auto calm-fade">
        {/* Progress Stepper Bar */}
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <span>Welcome to AI Tutor</span>
            <span>Step {currentStepIdx + 1} of {STEP_ORDER.length}</span>
          </div>
          <div className="w-full h-2 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 calm-fade"
              style={{ width: `${((currentStepIdx + 1) / STEP_ORDER.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 1. Welcome Step */}
        {step === "welcome" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-400/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 flex items-center justify-center text-4xl shadow-sm">
              👋
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                Welcome to AI Tutor!
              </h2>
              <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed">
                Your accessible textbook companion for Class 10. You can control everything with your <strong className="text-amber-700 dark:text-amber-300">eyes</strong> or <strong className="text-amber-700 dark:text-amber-300">voice</strong>.
              </p>
            </div>

            <div className="pt-2 w-full max-w-sm">
              <GazeButton
                id="onboarding-welcome-next"
                onClick={() => setStep("camera")}
                label="Get Started"
                icon={<ArrowRight className="w-6 h-6 text-slate-950" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[84px] text-lg font-black"
              />
            </div>
          </div>
        )}

        {/* 2. Camera Setup Step */}
        {step === "camera" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-400/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Camera className="w-10 h-10 text-amber-600 dark:text-amber-300" />
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                Eye-Tracking & Camera Setup
              </h2>
              <p className="text-base text-[var(--text-secondary)] max-w-lg leading-relaxed">
                We use your webcam to track where you look on screen.
              </p>
              {/* Privacy Guarantee Sentence */}
              <div className="p-3.5 bg-emerald-50 dark:bg-[#0a1e17] border-2 border-emerald-500/50 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-emerald-950 dark:text-emerald-200 text-left">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>
                  Privacy guarantee: Your video stays strictly in your browser. No video, images, or facial data are ever saved or sent anywhere.
                </span>
              </div>
            </div>

            <div className="w-full max-w-md space-y-3 pt-2">
              <GazeButton
                id="onboarding-start-camera-btn"
                onClick={() => {
                  setUseEyeControl(true);
                  if (!isCameraActive) onStartCamera();
                  setStep("calibrate");
                }}
                label={isCameraActive ? "Camera is Ready" : "Start Camera"}
                subtitle="Enables hands-free eye control"
                icon={<Camera className="w-6 h-6 text-slate-950" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />

              {/* Explicit Mouse / Keyboard option */}
              <GazeButton
                id="onboarding-skip-camera-btn"
                onClick={() => {
                  setUseEyeControl(false);
                  setStep("board");
                }}
                label="Use Mouse or Keyboard Instead"
                subtitle="Skip camera and eye tracking"
                icon={<MousePointer className="w-5 h-5 text-slate-400" />}
                variant="outline"
                size="compact"
                className="w-full justify-center !min-h-[64px]"
              />
            </div>
          </div>
        )}

        {/* 3. Eye Setup / Calibrate Step */}
        {step === "calibrate" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-400/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Target className="w-10 h-10 text-amber-600 dark:text-amber-300" />
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                Let&apos;s Set Up Your Eyes
              </h2>
              <p className="text-base text-[var(--text-secondary)] max-w-lg leading-relaxed">
                Look at 9 glowing dots to tune the eye tracker to your screen for best accuracy.
              </p>
            </div>

            <div className="w-full max-w-md space-y-3 pt-2">
              <GazeButton
                id="onboarding-open-calibration-btn"
                onClick={() => {
                  onOpenCalibration();
                }}
                label={isCalibrated ? "Eyes Already Calibrated" : "Tune Eye Tracking Now"}
                subtitle={isCalibrated ? "Ready! Click to retune" : "Takes about 20 seconds"}
                icon={<Target className="w-6 h-6 text-slate-950" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />

              <GazeButton
                id="onboarding-calibrate-next"
                onClick={() => setStep("board")}
                label="Continue to Board Selection"
                icon={<ArrowRight className="w-5 h-5 text-[var(--text-muted)]" />}
                variant="secondary"
                size="compact"
                className="w-full justify-center !min-h-[64px]"
              />
            </div>
          </div>
        )}

        {/* 4. Choose Board Step */}
        {step === "board" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-400/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-amber-600 dark:text-amber-300" />
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                Choose Your School Board
              </h2>
              <p className="text-base text-[var(--text-secondary)] max-w-lg leading-relaxed">
                All explanations and citations will be grounded in this curriculum.
              </p>
            </div>

            <div className="w-full max-w-md grid grid-cols-1 gap-3 pt-2">
              <GazeButton
                id="onboarding-board-tn"
                onClick={() => {
                  setSelectedBoard("tn");
                  setStep("subject");
                }}
                label="Tamil Nadu State Board"
                subtitle="Samacheer Kalvi · Class 10"
                variant={selectedBoard === "tn" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />

              <GazeButton
                id="onboarding-board-cbse"
                onClick={() => {
                  setSelectedBoard("cbse");
                  setStep("subject");
                }}
                label="CBSE / NCERT"
                subtitle="National Curriculum · Class 10"
                variant={selectedBoard === "cbse" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />
            </div>
          </div>
        )}

        {/* 5. Choose Subject Step */}
        {step === "subject" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-400/20 border-2 border-amber-400 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-amber-600 dark:text-amber-300" />
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                Select Your Subject
              </h2>
              <p className="text-base text-[var(--text-secondary)] max-w-lg leading-relaxed">
                Choose the subject you want to study today.
              </p>
            </div>

            <div className="w-full max-w-md grid grid-cols-1 gap-3 pt-2">
              <GazeButton
                id="onboarding-subj-science"
                onClick={() => {
                  setSelectedSubject("science");
                  setStep("ready");
                }}
                label="Science"
                subtitle="Physics, Chemistry, Biology"
                variant={selectedSubject === "science" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />

              <GazeButton
                id="onboarding-subj-social"
                onClick={() => {
                  setSelectedSubject("social_science");
                  setStep("ready");
                }}
                label="Social Science"
                subtitle="History, Civics, Geography, Economics"
                variant={selectedSubject === "social_science" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[84px]"
              />
            </div>
          </div>
        )}

        {/* 6. Ready Step */}
        {step === "ready" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-400/20 border-2 border-emerald-400 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 id="onboarding-step-title" className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                You are Ready to Learn!
              </h2>
              <p className="text-base text-[var(--text-secondary)] max-w-lg leading-relaxed">
                Selected: <strong className="text-amber-700 dark:text-amber-300">{selectedBoard.toUpperCase()} • Class 10 • {selectedSubject === "science" ? "Science" : "Social Science"}</strong>
              </p>
            </div>

            <div className="w-full max-w-sm pt-2">
              <GazeButton
                id="onboarding-finish-btn"
                onClick={handleFinishOnboarding}
                label="Start Learning!"
                icon={<Sparkles className="w-6 h-6 text-slate-950" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[84px] text-lg font-black"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
