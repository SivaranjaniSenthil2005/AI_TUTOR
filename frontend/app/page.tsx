"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebcamView, type WebcamViewHandle } from "@/components/WebcamView";
import { GazeProvider, useGazeContext } from "@/lib/gazeui/GazeContext";
import { TopBar } from "@/components/screens/TopBar";
import { BottomDock } from "@/components/screens/BottomDock";
import { SettingsDrawer } from "@/components/screens/SettingsDrawer";
import { BoardSubjectModal } from "@/components/screens/BoardSubjectModal";
import { TypeQuestionModal } from "@/components/screens/TypeQuestionModal";
import { ExplainModeModal } from "@/components/screens/ExplainModeModal";
import { PrivacyPanel } from "@/components/gaze/PrivacyPanel";
import { OnboardingFlow, type OnboardingResult } from "@/components/onboarding/OnboardingFlow";
import { CalibrationScreen } from "@/components/CalibrationScreen";
import { LayoutStabilityMonitor } from "@/components/dev/LayoutStabilityMonitor";
import { Toast } from "@/components/ui/Toast";
import { AskView, type AskViewHandle } from "@/components/voice/AskView";
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
import type { GazeFrameState } from "@/hooks/useGaze";
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
  const sharedGazePointRef = useRef<GazePoint>(DEFAULT_GAZE_POINT);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  return (
    <GazeProvider gazePointRef={sharedGazePointRef} isCameraActive={isCameraActive}>
      <HomeContent
        sharedGazePointRef={sharedGazePointRef}
        isCameraActive={isCameraActive}
        setIsCameraActive={setIsCameraActive}
      />
    </GazeProvider>
  );
}

interface HomeContentProps {
  sharedGazePointRef: React.RefObject<GazePoint>;
  isCameraActive: boolean;
  setIsCameraActive: React.Dispatch<React.SetStateAction<boolean>>;
}

function HomeContent({
  sharedGazePointRef,
  isCameraActive,
  setIsCameraActive,
}: HomeContentProps) {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const {
    settings: gazeSettings,
    updateSettings: updateGazeSettings,
    isPaused: isEyePaused,
    togglePause: togglePauseEye,
  } = useGazeContext();

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [scope, setScope] = useState<ScopeResponse | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatusResponse | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string>("tn");
  const [selectedSubject, setSelectedSubject] = useState<string>("science");

  // Dialog & Drawer States
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState<boolean>(false);
  const [isTypeQuestionOpen, setIsTypeQuestionOpen] = useState<boolean>(false);
  const [isExplainModeOpen, setIsExplainModeOpen] = useState<boolean>(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(true);
  const [isStabilityMonitorOpen, setIsStabilityMonitorOpen] = useState<boolean>(false);
  const [isSimGazeActive, setIsSimGazeActive] = useState<boolean>(false);

  // Sync saved preferences after client mount to prevent SSR hydration mismatch
  useEffect(() => {
    try {
      const b = localStorage.getItem("ai_tutor_selected_board");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (b) setSelectedBoard(b);
      const s = localStorage.getItem("ai_tutor_selected_subject");
      if (s) setSelectedSubject(s);
      const o = localStorage.getItem("ai_tutor_onboarding_completed");
      if (o === "false" || o === null) {
        setIsOnboardingCompleted(false);
      }
    } catch {}
  }, []);

  // Ask Session State & Tutor Status
  const [askSessionState, setAskSessionState] = useState<string>("idle");
  const [hasAnswerToRead, setHasAnswerToRead] = useState<boolean>(false);
  const [mapper, setMapper] = useState<GazeMapper | null>(null);

  const webcamHandleRef = useRef<WebcamViewHandle | null>(null);
  const askViewRef = useRef<AskViewHandle | null>(null);
  const latestGazeFrameRef = useRef<GazeFrameState | null>(null);

  // Learner Profile Settings
  const [learnerSettings, setLearnerSettings] = useState<AppLearnerSettings>(() =>
    loadLearnerSettings()
  );

  // Speech Output (TTS) & Input (STT) with mutual exclusion
  const tts = useSpeechSynthesis();
  const stt = useSpeechRecognition({
    onStopTts: () => {
      tts.stop();
    },
  });

  // Backend Health Check
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

  // Simulated Gaze (Mouse-Driven) handler
  useEffect(() => {
    if (!isSimGazeActive) return;
    const ref = sharedGazePointRef;

    const handleMouseMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.x = e.clientX / Math.max(1, window.innerWidth);
        ref.current.y = e.clientY / Math.max(1, window.innerHeight);
        ref.current.xPx = e.clientX;
        ref.current.yPx = e.clientY;
        ref.current.confidence = 1.0;
        ref.current.valid = true;
        ref.current.timestamp = performance.now();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (ref.current) {
        ref.current.valid = false;
      }
    };
  }, [isSimGazeActive, sharedGazePointRef]);

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

  const handleClearSavedChat = () => {
    clearSavedChatHistory();
  };

  const calibrationGrade = mapper
    ? mapper.quality?.grade === "good"
      ? "Good (A)"
      : "Standard (B)"
    : "Not calibrated";

  const isFocusMode = Boolean(gazeSettings.focusMode);

  return (
    <>
      <div id="app-root" className="app-grid-shell select-none">
      {/* 1. TOP BAR (Slim, Exactly 64px, Never Overlays Content) */}
      <TopBar
        board={selectedBoard}
        subject={selectedSubject}
        boardName={scope?.supported_boards[selectedBoard]}
        subjectName={scope?.supported_subjects[selectedSubject]}
        backendStatus={backendStatus}
        isCameraActive={isCameraActive}
        isCalibrated={!!mapper}
        calibrationGrade={calibrationGrade}
        micState={stt.state}
        isEyePaused={isEyePaused}
        focusMode={isFocusMode}
        isSimGazeActive={isSimGazeActive}
        onToggleSimGaze={() => setIsSimGazeActive((prev) => !prev)}
        onTogglePauseEye={togglePauseEye}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onChangeBoardSubject={() => setIsBoardModalOpen(true)}
        onRefreshHealth={checkBackendHealth}
        onToggleStabilityMonitor={() => setIsStabilityMonitorOpen((prev) => !prev)}
        isStabilityMonitorOpen={isStabilityMonitorOpen}
      />

      {/* 2. MAIN WORKSPACE (2 Columns with minmax(0, 1fr) that never overflow) */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden p-3 sm:p-5 relative">
        {/* Ambient decorative blurred shapes behind main area (hidden in focus mode & high contrast) */}
        <div
          className="bg-ambient-blob w-[480px] h-[480px] bg-indigo-500/10 -top-24 -left-24"
          aria-hidden="true"
        />
        <div
          className="bg-ambient-blob w-[420px] h-[420px] bg-purple-500/10 -bottom-24 -right-24"
          aria-hidden="true"
        />

        <div
          className={`h-full min-h-0 min-w-0 grid gap-4 sm:gap-5 relative z-10 ${
            isFocusMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
          }`}
          style={{ boxSizing: "border-box" }}
        >
          {/* Left Column: Fixed 4:3 Camera Card (Hidden in Focus Mode) */}
          {!isFocusMode && (
            <div className="lg:col-span-4 h-full min-h-0 min-w-0 flex flex-col">
              <WebcamView
                ref={webcamHandleRef}
                sharedGazePointRef={sharedGazePointRef}
                onGazeUpdate={(gaze) => {
                  latestGazeFrameRef.current = gaze;
                }}
                onMapperChange={setMapper}
                onCameraActiveChange={setIsCameraActive}
                isCalibrationOpen={isCalibrationOpen}
                onCalibrationOpenChange={setIsCalibrationOpen}
              />
            </div>
          )}

          {/* Right Column: AI Tutor Conversation Area */}
          <div
            className={`${
              isFocusMode ? "col-span-1" : "lg:col-span-8"
            } h-full min-h-0 min-w-0 flex flex-col bg-[var(--bg-surface)] rounded-[20px] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden`}
            style={{ boxSizing: "border-box" }}
          >
            <AskView
              ref={askViewRef}
              board={selectedBoard}
              subject={selectedSubject}
              boardName={scope?.supported_boards[selectedBoard]}
              subjectName={scope?.supported_subjects[selectedSubject]}
              learnerSettings={learnerSettings}
              stt={stt}
              tts={tts}
              onChangeBoardSubject={() => setIsBoardModalOpen(true)}
              onOpenPrivacy={() => setIsPrivacyOpen(true)}
              onSessionStateChange={setAskSessionState}
              onHasAnswerToReadChange={setHasAnswerToRead}
            />
          </div>
        </div>
      </main>

      {/* 3. BOTTOM DOCK (Fixed Height ~112px, Always Visible, Exactly 4 Big Gaze Buttons) */}
      <BottomDock
        onAskWithVoice={() => askViewRef.current?.startVoice()}
        onTypeQuestion={() => {
          setIsTypeQuestionOpen(true);
          askViewRef.current?.focusTypeInput();
        }}
        onReadAloud={() => askViewRef.current?.readAloudLatest()}
        onPauseResumeAudio={tts.paused ? tts.resume : tts.pause}
        onStopAudio={tts.stop}
        onExplainDifferently={() => setIsExplainModeOpen(true)}
        isListening={stt.state === "listening"}
        isSpeaking={tts.speaking}
        isAudioPaused={tts.paused}
        activeMode={learnerSettings.mode}
        hasAnswerToRead={hasAnswerToRead}
        isThinking={askSessionState === "thinking"}
      />
    </div>

      {/* Backend Disconnection Toast (Non-layout-shifting overlay) */}
      {backendStatus === "disconnected" && !isMockMode() && (
        <Toast
          type="error"
          message={`Backend server offline at ${getApiBaseUrl()}.`}
          actionLabel="Retry"
          onAction={checkBackendHealth}
        />
      )}

      {/* Settings Drawer (Right-side slide-over, does not shift layout) */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onSetCenter={() => webcamHandleRef.current?.startSetCenter()}
        isCameraActive={isCameraActive}
        voiceSettings={tts.settings}
        onUpdateVoiceSettings={tts.updateSettings}
        voices={tts.voices}
        onTestVoice={() => tts.speak("Hello! I am your AI Tutor for Class 10.")}
        learnerSettings={learnerSettings}
        onUpdateLearnerSettings={handleUpdateLearnerSettings}
        onClearSavedChat={handleClearSavedChat}
      />

      {/* Board & Subject Chooser Modal */}
      <BoardSubjectModal
        isOpen={isBoardModalOpen}
        onClose={() => setIsBoardModalOpen(false)}
        currentBoard={selectedBoard}
        currentSubject={selectedSubject}
        onSave={(b, s) => {
          setSelectedBoard(b);
          setSelectedSubject(s);
          try {
            localStorage.setItem("ai_tutor_selected_board", b);
            localStorage.setItem("ai_tutor_selected_subject", s);
          } catch {}
        }}
      />

      {/* Type Question Modal */}
      <TypeQuestionModal
        isOpen={isTypeQuestionOpen}
        onClose={() => setIsTypeQuestionOpen(false)}
        onSubmit={(q) => askViewRef.current?.executeQuestion(q)}
      />

      {/* Explain Differently Mode Modal */}
      <ExplainModeModal
        isOpen={isExplainModeOpen}
        onClose={() => setIsExplainModeOpen(false)}
        activeMode={learnerSettings.mode}
        onSelectMode={(m) => {
          handleUpdateLearnerSettings({ mode: m });
          askViewRef.current?.reAskLatestMode(m);
        }}
      />

      {/* Privacy Panel Modal */}
      <PrivacyPanel
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

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

      {/* Rock-Solid Calibration Layer (Full Viewport, Locks scroll, cursor-none) */}
      <CalibrationScreen
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        onComplete={(newMapper) => {
          setMapper(newMapper);
          setIsCalibrationOpen(false);
        }}
        gazeRef={latestGazeFrameRef}
        isCameraActive={isCameraActive}
        onStartCamera={() => webcamHandleRef.current?.start()}
      />

      {/* Dev Layout Stability Monitor (Only active in dev/test) */}
      <LayoutStabilityMonitor
        isOpen={isStabilityMonitorOpen}
        onClose={() => setIsStabilityMonitorOpen(false)}
        gazePointRef={sharedGazePointRef}
      />
    </>
  );
}
