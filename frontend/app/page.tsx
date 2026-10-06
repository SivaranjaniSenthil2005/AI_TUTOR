"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebcamView, type WebcamViewHandle } from "@/components/WebcamView";
import { GazeProvider } from "@/lib/gazeui/GazeContext";
import { GazeButton } from "@/components/gaze/GazeButton";
import { GazeScrollArea } from "@/components/gaze/GazeScrollArea";
import { GazePauseBar } from "@/components/gaze/GazePauseBar";
import { GazeSettingsModal } from "@/components/gaze/GazeSettingsModal";
import { LearnChooser } from "@/components/LearnChooser";
import { AskView, type ChatMessage } from "@/components/voice/AskView";
import { ListenView } from "@/components/voice/ListenView";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { getTutorReply } from "@/lib/tutor/mock";
import type { GazePoint } from "@/hooks/useGazePoint";
import type { GazeMapper } from "@/lib/calibration/mapper";

type BackendStatus = "checking" | "connected" | "disconnected";
type TabType = "home" | "learn" | "ask" | "listen";

const DEFAULT_GAZE_POINT: GazePoint = {
  x: 0.5,
  y: 0.5,
  xPx: 0,
  yPx: 0,
  confidence: 0,
  timestamp: 0,
  valid: false,
};

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [lastChecked, setLastChecked] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [mapper, setMapper] = useState<GazeMapper | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Chat and Voice State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const sharedGazePointRef = useRef<GazePoint>(DEFAULT_GAZE_POINT);
  const webcamHandleRef = useRef<WebcamViewHandle | null>(null);

  // Voice output hook (TTS)
  const tts = useSpeechSynthesis({
    onStart: () => {},
    onEnd: () => {
      setActiveSpeakingId(null);
    },
  });

  // Voice input hook (STT) with mutual exclusion (stops TTS before listening)
  const stt = useSpeechRecognition({
    onStopTts: () => {
      tts.stop();
      setActiveSpeakingId(null);
    },
  });

  // Check backend health
  const checkBackendHealth = useCallback(async () => {
    setBackendStatus("checking");
    try {
      const res = await fetch("http://127.0.0.1:8000/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        setBackendStatus(data.status === "ok" ? "connected" : "disconnected");
      } else {
        setBackendStatus("disconnected");
      }
    } catch {
      setBackendStatus("disconnected");
    } finally {
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/health", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          setBackendStatus(data.status === "ok" ? "connected" : "disconnected");
        } else {
          setBackendStatus("disconnected");
        }
      } catch {
        if (isMounted) setBackendStatus("disconnected");
      } finally {
        if (isMounted) setLastChecked(new Date().toLocaleTimeString());
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle Asking a Question (Voice or Typed)
  const handleAskQuestion = useCallback(
    async (questionText: string, wasVoice: boolean) => {
      if (!questionText.trim()) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: questionText.trim(),
        timestamp: Date.now(),
        wasVoice,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      try {
        // Fetch simulated / mock tutor reply
        const replyText = await getTutorReply(questionText, {
          board: "Tamil Nadu SCERT",
          className: "Std 10",
          subject: "Science",
        });

        const tutorMsg: ChatMessage = {
          id: `tutor-${Date.now()}`,
          role: "tutor",
          text: replyText,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, tutorMsg]);
        setIsThinking(false);

        // Auto-read aloud if enabled or asked via voice
        if (tts.settings.autoRead || wasVoice) {
          setActiveSpeakingId(tutorMsg.id);
          tts.speak(replyText);
        }
      } catch {
        setIsThinking(false);
      }
    },
    [tts]
  );

  const handleSpeakMessage = useCallback(
    (id: string, text: string) => {
      stt.stop(); // Mutual exclusion
      setActiveSpeakingId(id);
      tts.speak(text);
    },
    [stt, tts]
  );

  const handleStopSpeaking = useCallback(() => {
    tts.stop();
    setActiveSpeakingId(null);
  }, [tts]);

  // Latest tutor message for the Listen screen
  const latestTutorMessage = messages
    .filter((m) => m.role === "tutor")
    .slice(-1)[0] || null;

  const navItems: { id: TabType; label: string; icon: string; desc: string; tag: string }[] = [
    {
      id: "home",
      label: "Home",
      icon: "🏠",
      desc: "Welcome dashboard & gaze center",
      tag: "Main Hub",
    },
    {
      id: "learn",
      label: "Learn",
      icon: "📖",
      desc: "TN SCERT & CBSE textbooks (Std 6–12)",
      tag: "Curriculum",
    },
    {
      id: "ask",
      label: "Ask",
      icon: "💬",
      desc: "Voice STT curriculum Q&A",
      tag: "Voice Ask",
    },
    {
      id: "listen",
      label: "Listen",
      icon: "🔊",
      desc: "Voice TTS & read-along highlighting",
      tag: "TTS Audio",
    },
  ];

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
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  AI Tutor
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-amber-300">
                  Accessible Eye-Gaze & Voice Learning for Neurodiverse Students
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

              {/* Backend Status Badge */}
              <div className="hidden md:flex items-center gap-2.5 bg-[#131f38] px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold">
                <span
                  className={`w-3 h-3 rounded-full ${
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
                    {backendStatus === "connected" ? "OK" : backendStatus === "checking" ? "..." : "Offline"}
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

        {/* Calibration Prompt Banner if not calibrated */}
        {!mapper && isCameraActive && (
          <div className="max-w-7xl mx-auto w-full px-6 pt-4">
            <div className="bg-gradient-to-r from-amber-500/20 via-[#131f38] to-amber-500/20 border-3 border-amber-400 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <span className="text-4xl" role="img" aria-label="Eyes Icon">
                  👀
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Set Up Your Eyes First!
                  </h2>
                  <p className="text-sm font-semibold text-slate-300">
                    A quick 9-point calibration maps your screen coordinates for effortless dwell navigation.
                  </p>
                </div>
              </div>
              <GazeButton
                id="banner-calibrate-btn"
                onClick={() => setIsCalibrationOpen(true)}
                label="Start Calibration"
                icon="🎯"
                variant="accent"
                size="compact"
                className="!min-h-[56px] text-base"
              />
            </div>
          </div>
        )}

        {/* Main Two-Panel Layout */}
        <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch min-h-[580px]">
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
                      AI Tutor Workspace
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-amber-300">
                      Standard 6–12 Curriculum & Questions
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                  {activeTab.toUpperCase()} VIEW
                </span>
              </div>

              {/* Scrollable Workspace Content with Smooth Edge Gaze Scrolling */}
              <GazeScrollArea className="flex-1 min-h-[420px]">
                {/* Home View */}
                {activeTab === "home" && (
                  <div className="space-y-6">
                    <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-6 shadow-md">
                      <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                        <span>👋</span> Hello! Ready to learn?
                      </h3>
                      <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                        AI Tutor is your accessible study assistant. Start the camera on the left, then speak your questions or look at any button to navigate hands-free!
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-base font-black text-amber-300 uppercase tracking-wider">
                        Quick Actions (Look to Choose)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <GazeButton
                          id="quick-goto-ask-btn"
                          onClick={() => setActiveTab("ask")}
                          label="Ask with Voice"
                          subtitle="Speak your question with confirmation verification"
                          icon="🎙️"
                          variant="accent"
                          size="large"
                        />
                        <GazeButton
                          id="quick-goto-learn-btn"
                          onClick={() => setActiveTab("learn")}
                          label="Textbook Explorer"
                          subtitle="TN SCERT & CBSE Standards 6 to 12"
                          icon="📖"
                          variant="card"
                          size="large"
                        />
                      </div>
                    </div>

                    <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 bg-[#070b14]/60 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-3xl mx-auto mb-2">
                        🎙️
                      </div>
                      <h4 className="text-lg font-black text-white mb-1">
                        Multimodal Gaze + Voice Navigation
                      </h4>
                      <p className="text-sm text-slate-400 max-w-md mx-auto">
                        • Dwell on the microphone button to ask a question by voice.<br />
                        • Verify your speech in the confirmation card.<br />
                        • Listen to answers with read-along text highlighting.
                      </p>
                    </div>
                  </div>
                )}

                {/* Learn View: Interactive Gaze-Operable Chooser */}
                {activeTab === "learn" && <LearnChooser />}

                {/* Ask View: Voice Input & Chat Thread */}
                {activeTab === "ask" && (
                  <AskView
                    messages={messages}
                    onAskQuestion={handleAskQuestion}
                    isThinking={isThinking}
                    stt={stt}
                    tts={tts}
                    activeSpeakingId={activeSpeakingId}
                    onSpeakMessage={handleSpeakMessage}
                    onStopSpeaking={handleStopSpeaking}
                    tutorContext={{
                      board: "Tamil Nadu SCERT",
                      className: "Std 10",
                      subject: "Science",
                    }}
                  />
                )}

                {/* Listen View: Audio Narration & Read-Along */}
                {activeTab === "listen" && (
                  <ListenView
                    latestTutorMessage={latestTutorMessage}
                    tts={tts}
                    onGoToAsk={() => setActiveTab("ask")}
                  />
                )}
              </GazeScrollArea>

              {/* Status Bar */}
              <div className="p-3 border-t-2 border-slate-800 bg-[#0d1527] flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>
                  {tts.speaking ? "🔊 Reading answer aloud..." : stt.state === "listening" ? "🎤 Listening to your voice..." : "Multimodal Gaze + Voice Active"}
                </span>
                <span>{lastChecked ? `Backend checked: ${lastChecked}` : ""}</span>
              </div>
            </div>
          </div>

          {/* Bottom Gaze Navigation Bar (min 72px height, generous spacing >= 24px) */}
          <section aria-label="Main Navigation Controls" className="mt-2">
            <h2 className="text-base font-black text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span>🧭</span> Primary Navigation Controls
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <GazeButton
                    key={item.id}
                    id={`nav-${item.id}-btn`}
                    onClick={() => setActiveTab(item.id)}
                    label={item.label}
                    subtitle={item.desc}
                    icon={item.icon}
                    tag={item.tag}
                    variant={isActive ? "active" : "card"}
                    size="large"
                    priority={isActive ? 10 : 0}
                    className="!min-h-[80px]"
                  />
                );
              })}
            </div>
          </section>
        </main>

        {/* Settings Modal */}
        <GazeSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenCalibration={() => {
            setIsSettingsOpen(false);
            setIsCalibrationOpen(true);
          }}
          onSetCenter={() => webcamHandleRef.current?.startSetCenter()}
          isCameraActive={isCameraActive}
          voiceSettings={tts.settings}
          onUpdateVoiceSettings={tts.updateSettings}
          voices={tts.voices}
          onTestVoice={() =>
            tts.speak("Hello! I am AI Tutor, your accessible voice learning assistant.")
          }
        />

        {/* Accessible Footer */}
        <footer className="border-t-2 border-slate-800 bg-[#0d1527] px-6 py-5 text-center text-slate-400 text-sm">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <p className="font-bold text-slate-300">
              AI Tutor © 2026. Accessible Learning for Neurodiverse Students.
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Hands-Free Eye Gaze Dwell Navigation • Voice Input & Output • 100% Client-Side Privacy
            </p>
          </div>
        </footer>
      </div>
    </GazeProvider>
  );
}
