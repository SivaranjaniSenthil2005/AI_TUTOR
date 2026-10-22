"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Shield,
  MousePointer,
  Atom,
  Globe,
} from "lucide-react";
import { GazeButton } from "@/components/ui/GazeButton";
import { TutorMascot } from "@/components/ui/TutorMascot";
import { getScope } from "@/lib/api/client";

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
  const [selectedBoard, setSelectedBoard] = useState<string>("tn");
  const [selectedSubject, setSelectedSubject] = useState<string>("science");

  useEffect(() => {
    // Pre-warm scope fetch
    getScope().catch(() => {});
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
      className="fixed inset-0 z-50 bg-[#0F1226]/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none"
    >
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[20px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-5 my-auto calm-fade">
        {/* Progress Stepper Bar */}
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span className="text-[var(--primary)] font-semibold">Welcome to AI Tutor</span>
            <span>Step {currentStepIdx + 1} of {STEP_ORDER.length}</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-gradient calm-fade"
              style={{ width: `${((currentStepIdx + 1) / STEP_ORDER.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 1. Welcome Step */}
        {step === "welcome" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            {/* Friendly Mascot Scene */}
            <div className="py-2">
              <TutorMascot expression="speaking" size={100} />
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
                Welcome to AI Tutor!
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                Your accessible school textbook companion. You can navigate, ask questions, and explore lessons with your <span className="font-semibold text-[var(--primary)]">eyes</span> or <span className="font-semibold text-[var(--secondary-violet)]">voice</span>.
              </p>
            </div>

            <div className="w-full max-w-sm space-y-2.5 pt-2">
              <GazeButton
                id="onboarding-welcome-next"
                onClick={() => setStep("camera")}
                label="Get Started"
                icon={<ArrowRight className="w-5 h-5 text-white" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[56px] text-base font-semibold"
              />
              <GazeButton
                id="onboarding-skip-camera-btn-welcome"
                onClick={() => {
                  setUseEyeControl(false);
                  setStep("board");
                }}
                label="Use mouse or keyboard instead"
                icon={<MousePointer className="w-4 h-4 text-[var(--text-muted)]" />}
                variant="outline"
                size="compact"
                className="w-full justify-center !min-h-[44px] text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* 2. Camera Setup Step */}
        {step === "camera" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            {/* Original SVG Illustration: Camera with an Eye */}
            <div className="w-24 h-24 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <rect x="14" y="24" width="52" height="38" rx="10" fill="#4F46E5" />
                <path d="M30 24 L34 16 L46 16 L50 24 Z" fill="#6366F1" />
                <circle cx="40" cy="43" r="14" fill="#FFFFFF" />
                <path d="M31 43 C34 38 46 38 49 43 C46 48 34 48 31 43 Z" fill="#4F46E5" />
                <circle cx="40" cy="43" r="4.5" fill="#1E1B4B" />
                <circle cx="41.5" cy="41.5" r="1.5" fill="#FFFFFF" />
                <circle cx="56" cy="30" r="2.5" fill="#0D9488" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                Camera & Eye Setup
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                AI Tutor uses your front camera to track where you are looking on the screen.
              </p>
              <div className="p-3 bg-[var(--teal-soft)]/50 border border-[var(--accent-teal)]/30 rounded-xl flex items-center gap-2.5 text-xs text-left text-[var(--text-primary)]">
                <Shield className="w-4 h-4 text-[var(--accent-teal)] flex-shrink-0" />
                <span>
                  Privacy guarantee: Video stays strictly in your browser. No video, images, or facial landmarks are ever saved or sent anywhere.
                </span>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-2.5 pt-1">
              <GazeButton
                id="onboarding-start-camera-btn"
                onClick={() => {
                  setUseEyeControl(true);
                  if (!isCameraActive) onStartCamera();
                  setStep("calibrate");
                }}
                label={isCameraActive ? "Camera is Ready" : "Start Camera"}
                subtitle="Enables hands-free eye control"
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[56px] text-base font-semibold"
              />
              <GazeButton
                id="onboarding-skip-camera-btn"
                onClick={() => {
                  setUseEyeControl(false);
                  setStep("board");
                }}
                label="Use mouse or keyboard instead"
                icon={<MousePointer className="w-4 h-4 text-[var(--text-muted)]" />}
                variant="outline"
                size="compact"
                className="w-full justify-center !min-h-[44px] text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* 3. Eye Setup / Calibrate Step */}
        {step === "calibrate" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            {/* Original SVG Illustration: Target Dots */}
            <div className="w-24 h-24 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <circle cx="20" cy="20" r="4" fill="#818CF8" />
                <circle cx="40" cy="20" r="4" fill="#818CF8" />
                <circle cx="60" cy="20" r="4" fill="#818CF8" />
                <circle cx="20" cy="40" r="4" fill="#818CF8" />
                {/* Active center dot with shrinking dwell ring */}
                <circle cx="40" cy="40" r="14" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="4 2" />
                <circle cx="40" cy="40" r="6" fill="#4F46E5" />
                <circle cx="40" cy="40" r="2" fill="#FFFFFF" />
                <circle cx="60" cy="40" r="4" fill="#818CF8" />
                <circle cx="20" cy="60" r="4" fill="#818CF8" />
                <circle cx="40" cy="60" r="4" fill="#818CF8" />
                <circle cx="60" cy="60" r="4" fill="#818CF8" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                Tune Eye Tracking
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                Look at 9 dots on your screen for about 20 seconds to calibrate the eye tracker for maximum accuracy.
              </p>
            </div>

            <div className="w-full max-w-sm space-y-2.5 pt-1">
              <GazeButton
                id="onboarding-open-calibration-btn"
                onClick={() => {
                  onOpenCalibration();
                }}
                label={isCalibrated ? "Eyes Already Calibrated" : "Tune Eye Tracking Now"}
                subtitle={isCalibrated ? "Ready! Tap to retune" : "Takes about 20 seconds"}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[56px] text-base font-semibold"
              />
              <GazeButton
                id="onboarding-calibrate-next"
                onClick={() => setStep("board")}
                label="Continue to Board Selection"
                variant="card"
                size="compact"
                className="w-full justify-center !min-h-[44px] text-xs font-semibold"
              />
              <GazeButton
                id="onboarding-skip-calibration-btn"
                onClick={() => {
                  setUseEyeControl(false);
                  setStep("board");
                }}
                label="Use mouse or keyboard instead"
                icon={<MousePointer className="w-4 h-4 text-[var(--text-muted)]" />}
                variant="outline"
                size="compact"
                className="w-full justify-center !min-h-[44px] text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* 4. Choose Board Step */}
        {step === "board" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            {/* Original SVG Illustration: Stack of Books */}
            <div className="w-24 h-24 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
                <rect x="18" y="52" width="44" height="10" rx="3" fill="#4F46E5" />
                <rect x="22" y="38" width="40" height="10" rx="3" fill="#7C3AED" />
                <rect x="20" y="24" width="42" height="10" rx="3" fill="#0D9488" />
                <line x1="28" y1="24" x2="28" y2="34" stroke="#CCFBF1" strokeWidth="2" />
                <line x1="30" y1="38" x2="30" y2="48" stroke="#EDE9FE" strokeWidth="2" />
                <line x1="26" y1="52" x2="26" y2="62" stroke="#E0E7FF" strokeWidth="2" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                Choose Your School Board
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                All explanations and textbook citations will be grounded in this syllabus.
              </p>
            </div>

            <div className="w-full max-w-sm grid grid-cols-1 gap-2.5 pt-1">
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
                className="w-full justify-center !min-h-[64px]"
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
                className="w-full justify-center !min-h-[64px]"
              />
            </div>
          </div>
        )}

        {/* 5. Choose Subject Step */}
        {step === "subject" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            {/* Subject Icons Header */}
            <div className="w-24 h-24 rounded-2xl bg-[var(--teal-soft)] border border-[var(--accent-teal)]/20 flex items-center justify-center shadow-xs">
              <Atom className="w-12 h-12 text-[var(--accent-teal)]" />
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                Select Your Subject
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                Choose the textbook you want to study today.
              </p>
            </div>

            <div className="w-full max-w-sm grid grid-cols-1 gap-2.5 pt-1">
              <GazeButton
                id="onboarding-subj-science"
                onClick={() => {
                  setSelectedSubject("science");
                  setStep("ready");
                }}
                label="Science"
                subtitle="Physics, Chemistry, Biology"
                icon={<Atom className="w-5 h-5 text-[var(--accent-teal)]" />}
                variant={selectedSubject === "science" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[64px]"
              />

              <GazeButton
                id="onboarding-subj-social"
                onClick={() => {
                  setSelectedSubject("social_science");
                  setStep("ready");
                }}
                label="Social Science"
                subtitle="History, Civics, Geography, Economics"
                icon={<Globe className="w-5 h-5 text-[var(--secondary-violet)]" />}
                variant={selectedSubject === "social_science" ? "active" : "card"}
                size="large"
                className="w-full justify-center !min-h-[64px]"
              />
            </div>
          </div>
        )}

        {/* 6. Ready Step */}
        {step === "ready" && (
          <div className="space-y-5 w-full flex flex-col items-center">
            <div className="py-2">
              <TutorMascot expression="speaking" size={100} />
            </div>

            <div className="space-y-1.5">
              <h2 id="onboarding-step-title" className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
                You are Ready to Learn!
              </h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                Selected: <span className="font-semibold text-[var(--primary)]">{selectedBoard === "tn" ? "Tamil Nadu" : "CBSE"} • Class 10 • {selectedSubject === "science" ? "Science" : "Social Science"}</span>
              </p>
            </div>

            <div className="w-full max-w-sm pt-2">
              <GazeButton
                id="onboarding-finish-btn"
                onClick={handleFinishOnboarding}
                label="Start Learning!"
                icon={<Sparkles className="w-5 h-5 text-white" />}
                variant="primary"
                size="large"
                className="w-full justify-center !min-h-[56px] text-base font-semibold"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
