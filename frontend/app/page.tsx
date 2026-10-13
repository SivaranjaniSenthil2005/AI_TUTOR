"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebcamView, type WebcamViewHandle } from "@/components/WebcamView";
import { GazeProvider } from "@/lib/gazeui/GazeContext";
import { GazeButton } from "@/components/gaze/GazeButton";
import { GazeScrollArea } from "@/components/gaze/GazeScrollArea";
import { GazePauseBar } from "@/components/gaze/GazePauseBar";
import { GazeSettingsModal } from "@/components/gaze/GazeSettingsModal";
import { PrivacyPanel } from "@/components/gaze/PrivacyPanel";
import { GazeSimulator } from "@/components/gaze/GazeSimulator";
import { OnboardingFlow, OnboardingResult } from "@/components/onboarding/OnboardingFlow";
import { AskView } from "@/components/voice/AskView";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import {
  loadLearnerSettings,
  saveLearnerSettings,
  clearSavedChatHistory,
  AppLearnerSettings,
} from "@/lib/settings/learnerSettings";
import { getScope, getLLMStatus, isMockMode, getApiBaseUrl } from "@/lib/api/client";
import type { GazePoint } from "@/hooks/useGazePoint";
import type { GazeMapper } from "@/lib/calibration/mapper";
import type { ScopeResponse, LLMStatusResponse } from "@/lib/api/types";

type BackendStatus = "checking" | "connected" | "disconnected";

const DEFAULT_GAZE_POINT: GazePoint = {
  x: 0.5,
  y: 0.5,
  xPx: 0,
  yPx: 0,
  confidence: 0,
  timestamp: 0,
  valid: false,
};

const emptySubscribe = () => () => {};

export default function Home() {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [lastChecked, setLastChecked] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [mapper, setMapper] = useState<GazeMapper | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Curriculum Scope & Selection
  const [scope, setScope] = useState<ScopeResponse | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatusResponse | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string>("tn");
  const [selectedSubject, setSelectedSubject] = useState<string>("science");

  // Onboarding state
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(true);

  // Sync saved selection on client mount
  useEffect(() => {
    try {
      const completed = localStorage.getItem("ai_tutor_onboarding_completed");
      if (completed === "true") {
        setIsOnboardingCompleted(true);
      } else {
        setIsOnboardingCompleted(false);
      }
      const b = localStorage.getItem("ai_tutor_selected_board");
      if (b) setSelectedBoard(b);
      const s = localStorage.getItem("ai_tutor_selected_subject");
      if (s) setSelectedSubject(s);
    } catch {}
  }, []);

  // Learner Profile Settings
  const [learnerSettings, setLearnerSettings] = useState<AppLearnerSettings>(() =>
    loadLearnerSettings()
  );

  const sharedGazePointRef = useRef<GazePoint>(DEFAULT_GAZE_POINT);
  const webcamHandleRef = useRef<WebcamViewHandle | null>(null);

  // Voice output hook (TTS)
  const tts = useSpeechSynthesis();

  // Voice input hook (STT) with mutual exclusion (stops TTS before listening)
  const stt = useSpeechRecognition({
    onStopTts: () => {
      tts.stop();
    },
  });

  // Check backend health and scope
  const checkBackendHealth = useCallback(async () => {
    setBackendStatus("checking");
    try {
      const scopeData = await getScope();
      setScope(scopeData);

      const statusData = await getLLMStatus().catch(() => null);
      if (statusData) setLlmStatus(statusData);

      setBackendStatus("connected");
    } catch {
      setBackendStatus("disconnected");
    } finally {
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (active) {
        await checkBackendHealth();
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [checkBackendHealth]);

  const handleUpdateLearnerSettings = (partial: Partial<AppLearnerSettings>) => {
    setLearnerSettings((prev) => {
      const updated = { ...prev, ...partial };
      saveLearnerSettings(updated);
      return updated;
    });
  };

  const handleOnboardingComplete = (res: OnboardingResult) => {
    setSelectedBoard(res.board);
    setSelectedSubject(res.subject);
    setIsOnboardingCompleted(true);
  };

  const handleChangeBoardSubject = () => {
    setIsOnboardingCompleted(false);
  };

  const handleClearSavedChat = () => {
    clearSavedChatHistory();
  };

  // Calibration grade string
  const calibrationGrade = mapper
    ? mapper.quality?.grade === "good"
      ? "Good (A)"
      : mapper.quality?.grade === "okay"
      ? "Standard (B)"
      : "Standard (B)"
    : "Not calibrated";

  return (
    <GazeProvider gazePointRef={sharedGazePointRef} isCameraActive={isCameraActive}>
      <div className="min-h-screen bg-[#070b14] text-[#f8fafc] flex flex-col selection:bg-amber-400 selection:text-black">
        {/* Top Header with Accessible Controls */}
        <header className="border-b-4 border-amber-400/80 bg-[#0d1527] px-6 py-4 shadow-lg sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Logo and App Title */}
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-inner">
                AI
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    AI Tutor
                  </h1>
                  {isMockMode() && (
                    <span
                      id="demo-mode-badge"
                      className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-600 text-white border border-purple-400"
                    >
                      Demo Mode
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-amber-300">
                  Accessible Eye-Gaze & Voice Learning • Class 10
                </p>
              </div>
            </div>

            {/* Top Bar Quick Controls & Status */}
            <div className="flex flex-wrap items-center gap-3">
              <GazePauseBar
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenCalibration={() => setIsCalibrationOpen(true)}
                onSetCenter={() => webcamHandleRef.current?.startSetCenter()}
                isCalibrated={!!mapper}
              />

              {/* Status Badges */}
              <div className="hidden lg:flex items-center gap-2 bg-[#131f38] px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    backendStatus === "connected"
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : backendStatus === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-slate-300">
                  Backend:{" "}
                  <span
                    className={
                      backendStatus === "connected"
                        ? "text-emerald-400"
                        : backendStatus === "checking"
                        ? "text-amber-300"
                        : "text-rose-400"
                    }
                  >
                    {backendStatus === "connected" ? "Connected" : backendStatus === "checking" ? "Checking" : "Offline"}
                  </span>
                </span>
                <button
                  id="refresh-health-btn"
                  onClick={checkBackendHealth}
                  className="ml-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                  title="Refresh backend status"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Backend Reconnect Notice when offline */}
        {backendStatus === "disconnected" && !isMockMode() && (
          <div className="bg-rose-950/90 border-b-2 border-rose-500 px-6 py-2.5 text-center text-xs sm:text-sm font-bold text-rose-200 flex items-center justify-center gap-3">
            <span>⚠️ Backend server unreachable at {getApiBaseUrl()}. Please make sure the backend is running.</span>
            <button
              onClick={checkBackendHealth}
              className="px-2.5 py-1 bg-rose-900 rounded-lg text-white hover:bg-rose-800 cursor-pointer text-xs"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Main Workspace Layout */}
        <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch min-h-[600px]">
            {/* Left Panel: Camera & Gaze Tracker */}
            <div className="lg:col-span-5 flex flex-col">
              <WebcamView
                ref={webcamHandleRef}
                sharedGazePointRef={sharedGazePointRef}
                onMapperChange={setMapper}
                onCameraActiveChange={setIsCameraActive}
                isCalibrationOpen={isCalibrationOpen}
                onCalibrationOpenChange={setIsCalibrationOpen}
              />
            </div>

            {/* Right Panel: AI Tutor Workspace with Gaze Edge Scrolling */}
            <div className="lg:col-span-7 flex flex-col bg-[#0b1120] rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden">
              {/* Workspace Header */}
              <div className="flex items-center justify-between p-5 border-b-2 border-slate-800 bg-[#0d1527]">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" role="img" aria-label="AI Tutor Chat">
                    💬
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      AI Tutor
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-amber-300">
                      Class 10 Textbook Curriculum • {scope?.supported_boards[selectedBoard] || selectedBoard.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <GazeButton
                    id="header-change-board-btn"
                    onClick={handleChangeBoardSubject}
                    label={`${selectedBoard.toUpperCase()} • ${selectedSubject === "science" ? "Science" : "Social"}`}
                    icon="📚"
                    variant="card"
                    size="compact"
                    className="!min-h-[44px] text-xs font-bold text-amber-300"
                  />
                    <GazeButton
                      id="header-settings-btn"
                      onClick={() => setIsSettingsOpen(true)}
                      label="Settings"
                      icon="⚙️"
                      variant="card"
                      size="compact"
                      className="!min-h-[44px] text-xs font-bold"
                    />
                    <GazeButton
                      id="header-privacy-btn"
                      onClick={() => setIsPrivacyOpen(true)}
                      label="Privacy"
                      icon="🛡️"
                      variant="card"
                      size="compact"
                      className="!min-h-[44px] text-xs font-bold"
                    />
                  </div>
                </div>

              {/* Scrollable Workspace Content with Smooth Edge Gaze Scrolling */}
              <GazeScrollArea className="flex-1 min-h-[460px] p-6">
                <AskView
                  board={selectedBoard}
                  subject={selectedSubject}
                  boardName={scope?.supported_boards[selectedBoard]}
                  subjectName={scope?.supported_subjects[selectedSubject]}
                  learnerSettings={learnerSettings}
                  stt={stt}
                  tts={tts}
                  onChangeBoardSubject={handleChangeBoardSubject}
                  onOpenPrivacy={() => setIsPrivacyOpen(true)}
                />
              </GazeScrollArea>

              {/* Status and Safety UI Bar (Requirement 6) */}
              <div className="p-3 border-t-2 border-slate-800 bg-[#0d1527] flex flex-wrap items-center justify-between text-xs text-slate-400 font-semibold gap-2">
                <div className="flex items-center gap-3">
                  <span>Backend: <strong className={backendStatus === "connected" ? "text-emerald-400" : "text-rose-400"}>{backendStatus}</strong></span>
                  <span>•</span>
                  <span>Camera: <strong className={isCameraActive ? "text-emerald-400" : "text-slate-500"}>{isCameraActive ? "ON" : "OFF"}</strong></span>
                  <span>•</span>
                  <span>Calibration: <strong className={mapper ? "text-emerald-400" : "text-amber-300"}>{calibrationGrade}</strong></span>
                  <span>•</span>
                  <span>Mic: <strong className={stt.state === "listening" ? "text-amber-400" : "text-slate-400"}>{mounted ? stt.state : "idle"}</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Mode: <strong className="text-cyan-300">{isMockMode() ? "Demo" : "Live"}</strong></span>
                  {llmStatus && llmStatus.enabled_providers.length > 0 && (
                    <span>Provider: <strong className="text-amber-300">{llmStatus.enabled_providers[0]}</strong></span>
                  )}
                  {lastChecked && <span>({lastChecked})</span>}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* First-Run Onboarding Modal */}
        {mounted && !isOnboardingCompleted && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            isCameraActive={isCameraActive}
            onStartCamera={() => webcamHandleRef.current?.start()}
            onOpenCalibration={() => setIsCalibrationOpen(true)}
            isCalibrated={!!mapper}
          />
        )}

        {/* Settings Modal */}
        <GazeSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
          onSetCenter={() => webcamHandleRef.current?.startSetCenter()}
          isCameraActive={isCameraActive}
          voiceSettings={tts.settings}
          onUpdateVoiceSettings={tts.updateSettings}
          voices={tts.voices}
          onTestVoice={() => tts.speak("Hello! I am your AI Tutor for Standard 10.")}
          learnerSettings={learnerSettings}
          onUpdateLearnerSettings={handleUpdateLearnerSettings}
          onClearSavedChat={handleClearSavedChat}
        />

        {/* Privacy Panel Modal */}
        <PrivacyPanel
          isOpen={isPrivacyOpen}
          onClose={() => setIsPrivacyOpen(false)}
        />

        {/* Developer Gaze Simulator */}
        <GazeSimulator gazePointRef={sharedGazePointRef} />
      </div>
    </GazeProvider>
  );
}
