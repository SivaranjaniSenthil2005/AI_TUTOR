"use client";

import { useState, useEffect, useCallback } from "react";

type BackendStatus = "checking" | "connected" | "disconnected";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [activeTab, setActiveTab] = useState<string>("home");
  const [lastChecked, setLastChecked] = useState<string>("");

  const checkBackendHealth = useCallback(async () => {
    setBackendStatus("checking");
    try {
      // Backend FastAPI runs at http://127.0.0.1:8000
      const res = await fetch("http://127.0.0.1:8000/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") {
          setBackendStatus("connected");
        } else {
          setBackendStatus("disconnected");
        }
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
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: "🏠",
      desc: "Welcome dashboard & accessibility center",
      tag: "Main Hub",
    },
    {
      id: "learn",
      label: "Learn",
      icon: "📖",
      desc: "TN SCERT & CBSE textbooks for Standards 6-12",
      tag: "Textbook Explorer",
    },
    {
      id: "ask",
      label: "Ask",
      icon: "💬",
      desc: "Curriculum Q&A with hybrid RAG and verified citations",
      tag: "RAG Assistant",
    },
    {
      id: "listen",
      label: "Listen",
      icon: "🔊",
      desc: "Audio narration, voice answers & speech pacing",
      tag: "Voice & TTS",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-[#f8fafc] flex flex-col selection:bg-amber-400 selection:text-black">
      {/* Top Accessible Header */}
      <header className="border-b-4 border-amber-400/80 bg-[#0d1527] px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-inner">
              AI
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                AI Tutor
              </h1>
              <p className="text-base sm:text-lg font-medium text-amber-300">
                Accessible Learning for Neurodiverse Students (Std 6–12)
              </p>
            </div>
          </div>

          {/* Backend Status Badge */}
          <div className="flex items-center gap-3 bg-[#131f38] px-5 py-3 rounded-2xl border-2 border-slate-700 shadow-md">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-4 h-4 rounded-full transition-colors ${
                  backendStatus === "connected"
                    ? "bg-emerald-400 shadow-[0_0_12px_#34d399]"
                    : backendStatus === "checking"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500 shadow-[0_0_12px_#f43f5e]"
                }`}
                aria-hidden="true"
              />
              <span className="text-lg font-bold">
                Backend:{" "}
                <span
                  className={
                    backendStatus === "connected"
                      ? "text-emerald-400 font-extrabold"
                      : backendStatus === "checking"
                      ? "text-amber-300 font-extrabold"
                      : "text-rose-400 font-extrabold"
                  }
                >
                  {backendStatus === "connected"
                    ? "Connected (/health OK)"
                    : backendStatus === "checking"
                    ? "Checking..."
                    : "Disconnected"}
                </span>
              </span>
            </div>
            <button
              id="refresh-health-btn"
              onClick={checkBackendHealth}
              className="ml-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-amber-300 border border-slate-600 rounded-lg active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400"
              title="Refresh health status"
            >
              Check Now
            </button>
          </div>
        </div>
      </header>

      {/* Main Accessible Navigation Bar (Large high-contrast buttons) */}
      <nav
        aria-label="Main Navigation"
        className="max-w-7xl mx-auto w-full px-6 pt-8 pb-4"
      >
        <h2 className="text-xl font-bold text-slate-300 mb-4 uppercase tracking-wider">
          Navigation Controls (Large Touch, Voice & Gaze Ready)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}-btn`}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-start justify-between p-6 rounded-3xl border-4 text-left transition-all duration-200 min-h-[140px] focus:outline-none focus:ring-8 focus:ring-amber-400 ${
                  isActive
                    ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.35)] scale-[1.02]"
                    : "bg-[#0d1527] text-white border-slate-700 hover:border-amber-400 hover:bg-[#131f38] shadow-md"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-4xl" role="img" aria-label={item.label}>
                    {item.icon}
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                      isActive
                        ? "bg-slate-950 text-amber-300 border-slate-900"
                        : "bg-slate-800 text-slate-300 border-slate-600"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black">{item.label}</div>
                  <p
                    className={`text-sm mt-1 font-medium leading-snug ${
                      isActive ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-8">
        {/* Active View Container */}
        <section className="bg-[#0d1527] border-4 border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-800 pb-6 gap-4">
            <div>
              <span className="text-amber-400 font-bold text-lg uppercase tracking-wider">
                Current View
              </span>
              <h3 className="text-4xl font-black text-white capitalize mt-1">
                {activeTab} Mode
              </h3>
            </div>
            <div className="text-sm font-semibold bg-[#131f38] px-4 py-2 rounded-xl text-slate-300 border border-slate-700">
              {lastChecked ? `Status checked: ${lastChecked}` : "Initializing..."}
            </div>
          </div>

          {/* Interactive placeholder content for active section */}
          <div className="mt-8">
            {activeTab === "home" && (
              <div className="space-y-6">
                <p className="text-2xl text-slate-200 leading-relaxed font-medium">
                  Welcome to <strong className="text-amber-400 font-bold">AI Tutor</strong>.
                  This accessible learning workspace is engineered for school students
                  (Standards 6 to 12) following the Tamil Nadu State Board and CBSE/NCERT curriculum.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                    <div className="text-3xl mb-2">👁️</div>
                    <h4 className="text-2xl font-bold text-white mb-2">Gaze Control</h4>
                    <p className="text-slate-300 text-lg leading-relaxed">
                      Hands-free navigation using browser-based gaze tracking. No camera feed leaves your device.
                    </p>
                  </div>
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                    <div className="text-3xl mb-2">🎙️</div>
                    <h4 className="text-2xl font-bold text-white mb-2">Voice & Audio</h4>
                    <p className="text-slate-300 text-lg leading-relaxed">
                      Ask questions aloud and receive spoken responses with adaptive audio pacing and visual text highlights.
                    </p>
                  </div>
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                    <div className="text-3xl mb-2">📚</div>
                    <h4 className="text-2xl font-bold text-white mb-2">Advanced RAG</h4>
                    <p className="text-slate-300 text-lg leading-relaxed">
                      Answers grounded strictly in official TN SCERT & CBSE textbooks with direct page and chapter citations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "learn" && (
              <div className="space-y-6">
                <h4 className="text-3xl font-bold text-white">Curriculum & Textbooks</h4>
                <p className="text-xl text-slate-300">
                  Select your board and standard to explore syllabus chapters and indexed textbook concepts.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-amber-400/40">
                    <h5 className="text-2xl font-bold text-amber-300 mb-2">Tamil Nadu State Board</h5>
                    <p className="text-slate-300 text-lg">Standards 6 – 12 (English Medium)</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Std 6", "Std 7", "Std 8", "Std 9", "Std 10", "Std 11", "Std 12"].map((std) => (
                        <span key={std} className="px-3 py-1.5 bg-slate-800 text-amber-300 font-bold rounded-lg border border-slate-600">
                          {std}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-cyan-400/40">
                    <h5 className="text-2xl font-bold text-cyan-300 mb-2">CBSE / NCERT</h5>
                    <p className="text-slate-300 text-lg">Standards 6 – 12 (English Medium)</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Std 6", "Std 7", "Std 8", "Std 9", "Std 10", "Std 11", "Std 12"].map((std) => (
                        <span key={std} className="px-3 py-1.5 bg-slate-800 text-cyan-300 font-bold rounded-lg border border-slate-600">
                          {std}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ask" && (
              <div className="space-y-6">
                <h4 className="text-3xl font-bold text-white">Ask AI Tutor</h4>
                <p className="text-xl text-slate-300">
                  Ask any concept question from your syllabus using voice or typing.
                </p>
                <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                  <div className="text-lg text-slate-300 font-medium mb-3">
                    Placeholder Query Box (Accessible Input)
                  </div>
                  <input
                    type="text"
                    readOnly
                    value="Example: Explain photosynthesis from Tamil Nadu Class 10 Science Chapter 12"
                    className="w-full bg-[#070b14] border-2 border-slate-600 rounded-xl p-4 text-xl text-slate-300 focus:outline-none"
                  />
                  <div className="mt-4 flex gap-4">
                    <button className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg rounded-xl transition-all">
                      Submit Question
                    </button>
                    <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg rounded-xl border border-slate-600">
                      🎙️ Speak Question
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "listen" && (
              <div className="space-y-6">
                <h4 className="text-3xl font-bold text-white">Audio & Speech Center</h4>
                <p className="text-xl text-slate-300">
                  Configure speech synthesis speed, narration voice, and audio cues designed for neurodiverse comfort.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                    <h5 className="text-xl font-bold text-white mb-2">Speech Pacing</h5>
                    <p className="text-slate-400 mb-4">Adaptive reading rate (0.75x – 1.25x)</p>
                    <div className="flex gap-3">
                      {["0.8x (Gentle)", "1.0x (Normal)", "1.2x (Brisk)"].map((speed) => (
                        <button key={speed} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-600">
                          {speed}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#131f38] p-6 rounded-2xl border-2 border-slate-700">
                    <h5 className="text-xl font-bold text-white mb-2">Audio Contrast</h5>
                    <p className="text-slate-400 mb-4">Background audio muting during answers</p>
                    <button className="px-5 py-2 bg-amber-400 text-slate-950 font-black rounded-lg">
                      Distraction-Free Mode: ON
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Accessible Footer */}
      <footer className="border-t-2 border-slate-800 bg-[#0d1527] px-6 py-6 text-center text-slate-400 text-base">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="font-bold text-slate-300">
            AI Tutor © 2026 Sivaranjani. Open Source under MIT License.
          </p>
          <p className="text-sm text-slate-400">
            Designed for Neurodiverse Learners • Privacy First (100% Client-Side Gaze Tracking)
          </p>
        </div>
      </footer>
    </div>
  );
}
