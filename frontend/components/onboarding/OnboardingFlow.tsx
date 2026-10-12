"use client";

import React, { useState, useEffect } from "react";
import { GazeButton } from "@/components/gaze/GazeButton";
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
        const boards = Object.keys(data.supported_boards);
        if (boards.length > 0) {
          setSelectedBoard((prev) => (boards.includes(prev) ? prev : boards[0]));
        }
        const subjects = Object.keys(data.supported_subjects);
        if (subjects.length > 0) {
          setSelectedSubject((prev) => (subjects.includes(prev) ? prev : subjects[0]));
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleStartCameraAndCalibrate = () => {
    setUseEyeControl(true);
    if (!isCameraActive) {
      onStartCamera();
    }
    onOpenCalibration();
    setStep("calibrate");
  };

  const handleSkipEyeControl = () => {
    setUseEyeControl(false);
    setStep("board");
  };

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
    <div className="fixed inset-0 z-50 bg-[#070b14]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#0b1120] border-4 border-amber-400 rounded-3xl p-6 sm:p-10 max-w-3xl w-full shadow-2xl flex flex-col items-center text-center space-y-6 my-auto">
        {/* Header Indicator */}
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
          <span>AI Tutor Onboarding</span>
          <span>•</span>
          <span>Class 10 English Medium</span>
        </div>

        {/* 1. Welcome Step */}
        {step === "welcome" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(251,191,36,0.4)]">
              👋
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Welcome to AI Tutor!
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Your accessible, textbook-grounded learning partner for Standard 10 Science and Social Science. You can ask questions with your voice, type them, and control everything using your eyes or mouse!
            </p>
            <div className="w-full max-w-md pt-4">
              <GazeButton
                id="onboarding-welcome-next"
                onClick={() => setStep("camera")}
                label="Let's Get Started"
                icon="🚀"
                variant="accent"
                size="large"
                className="w-full !min-h-[72px] text-lg font-black"
              />
            </div>
          </div>
        )}

        {/* 2. Camera & Eye Control Step */}
        {step === "camera" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-cyan-400/20 border-2 border-cyan-400 flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(34,211,238,0.4)]">
              👀
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Eye-Tracking & Camera Setup
            </h2>
            <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-5 text-left max-w-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span>🔒</span> Privacy First
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your webcam video stays <strong>100% inside this browser</strong>. No video or camera images are ever recorded or transmitted to any server. MediaPipe processes your gaze entirely on your device.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl pt-2">
              <GazeButton
                id="onboarding-enable-camera-btn"
                onClick={handleStartCameraAndCalibrate}
                label="Enable Eye Control"
                subtitle="Starts camera & 9-point calibration"
                icon="👁️"
                variant="accent"
                size="large"
                className="!min-h-[80px]"
              />
              <GazeButton
                id="onboarding-skip-camera-btn"
                onClick={handleSkipEyeControl}
                label="Skip Eye Control"
                subtitle="Use Mouse & Keyboard only"
                icon="🖱️"
                variant="card"
                size="large"
                className="!min-h-[80px]"
              />
            </div>
          </div>
        )}

        {/* 3. Calibration In-Progress Screen */}
        {step === "calibrate" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(251,191,36,0.4)] animate-pulse">
              🎯
            </div>
            <h2 className="text-3xl font-black text-white">
              {isCalibrated ? "Calibration Complete!" : "Eye Calibration"}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-md">
              {isCalibrated
                ? "Your eye gaze coordinates have been successfully mapped to your screen."
                : "Follow the 9 target dots on your screen with your eyes, or proceed when ready."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md pt-2">
              {!isCalibrated && (
                <GazeButton
                  id="onboarding-reopen-calib-btn"
                  onClick={onOpenCalibration}
                  label="Show Calibration Screen"
                  icon="🎯"
                  variant="secondary"
                  size="compact"
                  className="!min-h-[56px] text-xs font-bold"
                />
              )}
              <GazeButton
                id="onboarding-calib-proceed-btn"
                onClick={() => setStep("board")}
                label="Proceed to Board Selection"
                icon="➔"
                variant="accent"
                size="compact"
                className="!min-h-[56px] text-xs font-bold"
              />
            </div>
          </div>
        )}

        {/* 4. Choose Board Step */}
        {step === "board" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-3xl">
              🏫
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Choose Your School Board
              </h2>
              <p className="text-sm text-amber-300 font-bold mt-1">
                Standard: Class 10 (English Medium)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              {Object.entries(scope.supported_boards).map(([code, name]) => (
                <GazeButton
                  key={code}
                  id={`onboarding-board-${code}`}
                  onClick={() => {
                    setSelectedBoard(code);
                    setStep("subject");
                  }}
                  label={name}
                  subtitle={code.toUpperCase()}
                  icon="📚"
                  variant={selectedBoard === code ? "active" : "card"}
                  size="large"
                  className="!min-h-[88px] text-base"
                />
              ))}
            </div>
          </div>
        )}

        {/* 5. Choose Subject Step */}
        {step === "subject" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-400/20 border-2 border-purple-400 flex items-center justify-center text-3xl">
              📖
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Select Your Subject
              </h2>
              <p className="text-sm text-purple-300 font-bold mt-1">
                Board: {scope.supported_boards[selectedBoard] || selectedBoard.toUpperCase()} • Class 10
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              {Object.entries(scope.supported_subjects).map(([code, name]) => (
                <GazeButton
                  key={code}
                  id={`onboarding-subj-${code}`}
                  onClick={() => {
                    setSelectedSubject(code);
                    setStep("ready");
                  }}
                  label={name}
                  subtitle="Class 10 Textbook"
                  icon={code.includes("sci") && !code.includes("social") ? "🔬" : "🌍"}
                  variant={selectedSubject === code ? "active" : "card"}
                  size="large"
                  className="!min-h-[88px] text-base"
                />
              ))}
            </div>
            <GazeButton
              id="onboarding-back-to-board"
              onClick={() => setStep("board")}
              label="Back to Board Selection"
              icon="←"
              variant="outline"
              size="compact"
              className="mt-2"
            />
          </div>
        )}

        {/* 6. Ready Step */}
        {step === "ready" && (
          <div className="space-y-6 w-full flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-400/20 border-2 border-emerald-400 flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(52,211,153,0.4)]">
              ✨
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              You are Ready to Learn!
            </h2>
            <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-6 text-left max-w-md w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Board:</span>
                <span className="text-white font-bold">{scope.supported_boards[selectedBoard] || selectedBoard}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Class:</span>
                <span className="text-white font-bold">Standard 10</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Subject:</span>
                <span className="text-amber-300 font-bold">{scope.supported_subjects[selectedSubject] || selectedSubject}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Eye Control:</span>
                <span className="text-emerald-400 font-bold">{useEyeControl ? "Enabled 👀" : "Mouse / Keyboard 🖱️"}</span>
              </div>
            </div>
            <div className="w-full max-w-md pt-2">
              <GazeButton
                id="onboarding-finish-btn"
                onClick={handleFinishOnboarding}
                label="Start Learning with AI Tutor"
                icon="🚀"
                variant="accent"
                size="large"
                className="w-full !min-h-[72px] text-lg font-black"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
