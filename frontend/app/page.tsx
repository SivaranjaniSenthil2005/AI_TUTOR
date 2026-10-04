"use client";

import { useState, useEffect, useCallback } from "react";
import { WebcamView } from "@/components/WebcamView";

type BackendStatus = "checking" | "connected" | "disconnected";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [activeTab, setActiveTab] = useState<string>("home");
  const [lastChecked, setLastChecked] = useState<string>("");

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

  const navItems = [
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
      tag: "Textbook Explorer",
    },
    {
      id: "ask",
      label: "Ask",
      icon: "💬",
      desc: "Curriculum Q&A with hybrid RAG & citations",
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
              className="ml-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-amber-300 border border-slate-600 rounded-lg active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 cursor-pointer"
              title="Refresh health status"
            >
              Check Now
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Panel Content Workspace */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
          {/* Left Panel: Live Mirrored Webcam */}
          <div className="lg:col-span-5 flex flex-col">
            <WebcamView />
          </div>

          {/* Right Panel: AI Tutor Interactive / Chat Workspace Placeholder */}
          <div className="lg:col-span-7 flex flex-col bg-[#0b1120] rounded-3xl border-4 border-slate-800 p-6 shadow-2xl justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800 mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" role="img" aria-label="AI Tutor Chat">
                    💬
                  </span>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      AI Tutor Workspace
                    </h2>
                    <p className="text-sm font-semibold text-amber-300">
                      Standard 6–12 Curriculum & Questions
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                  {activeTab.toUpperCase()} VIEW
                </span>
              </div>

              {/* Dynamic View Content based on selection */}
              {activeTab === "home" && (
                <div className="space-y-4">
                  <div className="bg-[#131f38] border-2 border-slate-700 rounded-2xl p-6">
                    <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                      <span>👋</span> Hello! Ready to learn?
                    </h3>
                    <p className="text-lg text-slate-300 leading-relaxed">
                      AI Tutor is your accessible study assistant. Start the camera on the left to prepare for eye gaze navigation, or choose a mode below.
                    </p>
                  </div>

                  {/* Empty chat placeholder for later phases */}
                  <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center bg-[#070b14]/60">
                    <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-3xl mx-auto mb-3">
                      💡
                    </div>
                    <h4 className="text-xl font-black text-white mb-1">
                      Chat & Tutor Area (Ready for Phase 3)
                    </h4>
                    <p className="text-base text-slate-400 max-w-md mx-auto">
                      In upcoming phases, your questions and textbook explanations will appear here with voice narration and gaze dwell-selection.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "learn" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">Textbook Library</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-amber-400/40">
                      <h4 className="text-xl font-bold text-amber-300 mb-1">TN State Board</h4>
                      <p className="text-slate-300 text-sm mb-3">Standards 6 – 12</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["Std 6", "Std 7", "Std 8", "Std 9", "Std 10", "Std 11", "Std 12"].map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-slate-800 text-amber-300 text-xs font-bold rounded-lg border border-slate-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-cyan-400/40">
                      <h4 className="text-xl font-bold text-cyan-300 mb-1">CBSE / NCERT</h4>
                      <p className="text-slate-300 text-sm mb-3">Standards 6 – 12</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["Std 6", "Std 7", "Std 8", "Std 9", "Std 10", "Std 11", "Std 12"].map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-slate-800 text-cyan-300 text-xs font-bold rounded-lg border border-slate-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "ask" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">Ask AI Tutor</h3>
                  <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700">
                    <p className="text-sm font-semibold text-slate-300 mb-2">Example Query</p>
                    <input
                      type="text"
                      readOnly
                      value="Explain photosynthesis from Tamil Nadu Class 10 Science Chapter 12"
                      className="w-full bg-[#070b14] border-2 border-slate-600 rounded-xl p-3 text-lg text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {activeTab === "listen" && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white">Audio & Speech Center</h3>
                  <div className="bg-[#131f38] p-5 rounded-2xl border-2 border-slate-700">
                    <p className="text-base text-slate-300 mb-2">Speech Pacing Options</p>
                    <div className="flex gap-2">
                      {["0.8x (Gentle)", "1.0x (Normal)", "1.2x (Brisk)"].map((speed) => (
                        <button key={speed} className="px-3 py-2 bg-slate-800 text-white font-bold text-sm rounded-lg border border-slate-600">
                          {speed}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Status Bar at bottom of right panel */}
            <div className="mt-6 pt-4 border-t-2 border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-400 font-semibold">
              <span>Ready for multimodal interaction</span>
              <span>{lastChecked ? `Status checked: ${lastChecked}` : ""}</span>
            </div>
          </div>
        </div>

        {/* Bottom Big Navigation Bar (High-Contrast Buttons min-h-[64px]) */}
        <section aria-label="Main Navigation Controls" className="mt-2">
          <h2 className="text-lg font-bold text-slate-300 mb-3 uppercase tracking-wider">
            Accessible Navigation Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}-btn`}
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[64px] flex items-center justify-between p-5 rounded-2xl border-4 text-left transition-all duration-200 focus:outline-none focus:ring-8 focus:ring-amber-400 cursor-pointer ${
                    isActive
                      ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.35)] scale-[1.02]"
                      : "bg-[#0d1527] text-white border-slate-700 hover:border-amber-400 hover:bg-[#131f38] shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" role="img" aria-label={item.label}>
                      {item.icon}
                    </span>
                    <div>
                      <div className="text-2xl font-black">{item.label}</div>
                      <p
                        className={`text-xs font-medium leading-snug ${
                          isActive ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      isActive
                        ? "bg-slate-950 text-amber-300 border-slate-900"
                        : "bg-slate-800 text-slate-300 border-slate-600"
                    }`}
                  >
                    {item.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Accessible Footer */}
      <footer className="border-t-2 border-slate-800 bg-[#0d1527] px-6 py-5 text-center text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="font-bold text-slate-300">
            AI Tutor © 2026 Sivaranjani. Open Source under MIT License.
          </p>
          <p className="text-xs sm:text-sm text-slate-400">
            Designed for Neurodiverse Learners • Privacy First (100% Client-Side Gaze Tracking)
          </p>
        </div>
      </footer>
    </div>
  );
}
