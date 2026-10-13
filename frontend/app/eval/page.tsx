"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { GazeProvider } from "@/lib/gazeui/GazeContext";
import { GazeButton } from "@/components/gaze/GazeButton";
import { GazeDot } from "@/components/GazeDot";
import { GazeSimulator } from "@/components/gaze/GazeSimulator";
import type { GazePoint } from "@/hooks/useGazePoint";

// Types
export interface ParticipantProfile {
  id: string;
  timestamp: string;
  lighting: "bright" | "normal" | "dim";
  glasses: "none" | "glasses" | "contacts";
  distanceCm: number;
  screenSize: string;
  calibrationGrade: "good" | "moderate" | "poor" | "simulated";
  consentGiven: boolean;
}

export interface TaskATrial {
  trialIndex: number;
  targetCount: number;
  goalTargetId: string;
  activatedTargetId: string | null;
  status: "success" | "wrong_target" | "timeout";
  timeToSelectMs: number;
  reEntries: number;
  targetSize: "small" | "medium" | "large";
  dwellMs: number;
}

export interface TaskBResult {
  durationSeconds: number;
  accidentalActivations: number;
  activationTimestamps: number[];
  falseActivationsPerMinute: number;
}

export interface TaskCResult {
  completed: boolean;
  totalTimeMs: number;
  retryCount: number;
  chosenBoard: string;
  chosenSubject: string;
  questionAsked: string;
}

export interface SUSResponses {
  q1: number; // frequently use
  q2: number; // unnecessarily complex
  q3: number; // easy to use
  q4: number; // need tech support
  q5: number; // well integrated
  q6: number; // inconsistency
  q7: number; // learn quickly
  q8: number; // cumbersome
  q9: number; // felt confident
  q10: number; // need learn lot
  commentsChallenging: string;
  commentsIntuitive: string;
  commentsSuggestions: string;
  susScore: number;
}

export interface GazeEvalSession {
  participant: ParticipantProfile;
  settings: {
    targetSize: "small" | "medium" | "large";
    dwellMs: number;
    trialCount: number;
  };
  taskA: {
    trials: TaskATrial[];
    successRate: number;
    avgTimeMs: number;
    avgReEntries: number;
  };
  taskB: TaskBResult;
  taskC: TaskCResult;
  sus: SUSResponses;
}

const DEFAULT_GAZE_POINT: GazePoint = {
  x: 0.5,
  y: 0.5,
  xPx: 0,
  yPx: 0,
  confidence: 0,
  timestamp: 0,
  valid: false,
};

const SUS_QUESTIONS = [
  "1. I think that I would like to use AI Tutor frequently.",
  "2. I found the system unnecessarily complex.",
  "3. I thought the system was easy to use.",
  "4. I think that I would need technical support to use this system.",
  "5. I found the various functions in AI Tutor were well integrated.",
  "6. I thought there was too much inconsistency in this system.",
  "7. I would imagine that most students would learn to use this system very quickly.",
  "8. I found the system cumbersome or tiring to use.",
  "9. I felt confident using eye gaze and voice control.",
  "10. I needed to learn a lot of things before I could get going with this system.",
];

export default function EvalPage() {
  const isDevTools =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DEV_TOOLS === "1" ||
      process.env.NODE_ENV !== "production");

  const sharedGazePointRef = useRef<GazePoint>({ ...DEFAULT_GAZE_POINT });

  // Evaluation wizard step: "setup" | "taskA" | "taskB" | "taskC" | "sus" | "results"
  const [step, setStep] = useState<"setup" | "taskA" | "taskB" | "taskC" | "sus" | "results">("setup");

  // Profile setup
  const [participantId, setParticipantId] = useState<string>(() => {
    const randomHex = Math.random().toString(16).substring(2, 8);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `p_${dateStr}_${randomHex}`;
  });
  const [lighting, setLighting] = useState<"bright" | "normal" | "dim">("normal");
  const [glasses, setGlasses] = useState<"none" | "glasses" | "contacts">("none");
  const [distanceCm, setDistanceCm] = useState<number>(60);
  const [screenSize, setScreenSize] = useState<string>("15-inch laptop");
  const [calibrationGrade, setCalibrationGrade] = useState<"good" | "moderate" | "poor" | "simulated">("good");
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  // Settings
  const [targetSize, setTargetSize] = useState<"small" | "medium" | "large">("medium");
  const [dwellMs, setDwellMs] = useState<number>(1200);
  const [trialCount, setTrialCount] = useState<number>(20);

  // Task A state
  const [currentTrialIdx, setCurrentTrialIdx] = useState<number>(0);
  const [taskATrials, setTaskATrials] = useState<TaskATrial[]>([]);
  const [goalTargetId, setGoalTargetId] = useState<string>("target-1");
  const trialStartTimeRef = useRef<number>(0);
  const reEntryCountRef = useRef<number>(0);
  const currentHoveredTargetRef = useRef<string | null>(null);

  // Task B state
  const [taskBSecondsLeft, setTaskBSecondsLeft] = useState<number>(60);
  const [taskBIsRunning, setTaskBIsRunning] = useState<boolean>(false);
  const [taskBActivations, setTaskBActivations] = useState<number>(0);
  const taskBActivationTimestampsRef = useRef<number[]>([]);

  // Task C state
  const [taskCStep, setTaskCStep] = useState<number>(1);
  const [taskCBoard, setTaskCBoard] = useState<string>("");
  const [taskCSubject, setTaskCSubject] = useState<string>("");
  const [taskCQuestion, setTaskCQuestion] = useState<string>("");
  const [taskCRetries, setTaskCRetries] = useState<number>(0);
  const taskCStartTimeRef = useRef<number>(0);
  const [taskCTotalTimeMs, setTaskCTotalTimeMs] = useState<number>(0);

  // SUS State
  const [susRatings, setSusRatings] = useState<number[]>([4, 2, 4, 2, 4, 2, 4, 2, 4, 2]);
  const [commentsChallenging, setCommentsChallenging] = useState<string>("");
  const [commentsIntuitive, setCommentsIntuitive] = useState<string>("");
  const [commentsSuggestions, setCommentsSuggestions] = useState<string>("");

  // Target dimensions based on size
  const targetDimensionClass = useMemo(() => {
    switch (targetSize) {
      case "small":
        return "w-32 h-24 text-sm";
      case "large":
        return "w-56 h-36 text-xl";
      case "medium":
      default:
        return "w-44 h-28 text-base";
    }
  }, [targetSize]);

  // SUS score calculation
  const computedSusScore = useMemo(() => {
    let score = 0;
    susRatings.forEach((val, idx) => {
      if (idx % 2 === 0) {
        // Odd questions (1-indexed 1, 3, 5, 7, 9 -> 0, 2, 4, 6, 8): val - 1
        score += val - 1;
      } else {
        // Even questions (1-indexed 2, 4, 6, 8, 10 -> 1, 3, 5, 7, 9): 5 - val
        score += 5 - val;
      }
    });
    return Math.round(score * 2.5 * 10) / 10;
  }, [susRatings]);

  // Start Task A
  const handleStartTaskA = () => {
    setTaskATrials([]);
    setCurrentTrialIdx(0);
    pickNewGoalTarget();
    trialStartTimeRef.current = performance.now();
    reEntryCountRef.current = 0;
    setStep("taskA");
  };

  const pickNewGoalTarget = () => {
    const targets = ["target-1", "target-2", "target-3", "target-4", "target-5", "target-6"];
    const randomTarget = targets[Math.floor(Math.random() * targets.length)];
    setGoalTargetId(randomTarget);
  };

  // Target activation in Task A
  const handleTaskATargetActivated = (clickedId: string) => {
    if (step !== "taskA") return;

    const selectTime = performance.now() - trialStartTimeRef.current;
    const isGoal = clickedId === goalTargetId;

    const trialRecord: TaskATrial = {
      trialIndex: currentTrialIdx + 1,
      targetCount: 6,
      goalTargetId,
      activatedTargetId: clickedId,
      status: isGoal ? "success" : "wrong_target",
      timeToSelectMs: Math.round(selectTime),
      reEntries: reEntryCountRef.current,
      targetSize,
      dwellMs,
    };

    const nextTrials = [...taskATrials, trialRecord];
    setTaskATrials(nextTrials);

    if (currentTrialIdx + 1 >= trialCount) {
      // Completed Task A, proceed to Task B
      setStep("taskB");
    } else {
      setCurrentTrialIdx((prev) => prev + 1);
      pickNewGoalTarget();
      trialStartTimeRef.current = performance.now();
      reEntryCountRef.current = 0;
    }
  };

  // Task B timer
  useEffect(() => {
    if (step !== "taskB" || !taskBIsRunning) return;

    const interval = setInterval(() => {
      setTaskBSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTaskBIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, taskBIsRunning]);

  const handleStartTaskB = () => {
    setTaskBSecondsLeft(60);
    setTaskBActivations(0);
    taskBActivationTimestampsRef.current = [];
    setTaskBIsRunning(true);
  };

  const handleTaskBAccidentalActivation = (id: string) => {
    if (!taskBIsRunning) return;
    setTaskBActivations((prev) => prev + 1);
    taskBActivationTimestampsRef.current.push(performance.now());
  };

  // Start Task C
  const handleStartTaskC = () => {
    setTaskCStep(1);
    setTaskCBoard("");
    setTaskCSubject("");
    setTaskCQuestion("");
    setTaskCRetries(0);
    taskCStartTimeRef.current = performance.now();
    setStep("taskC");
  };

  // Complete session object
  const sessionData: GazeEvalSession = useMemo(() => {
    const successCount = taskATrials.filter((t) => t.status === "success").length;
    const totalSelectTime = taskATrials.reduce((sum, t) => sum + t.timeToSelectMs, 0);
    const totalReEntries = taskATrials.reduce((sum, t) => sum + t.reEntries, 0);

    return {
      participant: {
        id: participantId,
        timestamp: new Date().toISOString(),
        lighting,
        glasses,
        distanceCm,
        screenSize,
        calibrationGrade,
        consentGiven,
      },
      settings: {
        targetSize,
        dwellMs,
        trialCount,
      },
      taskA: {
        trials: taskATrials,
        successRate: taskATrials.length > 0 ? Math.round((successCount / taskATrials.length) * 100) : 0,
        avgTimeMs: taskATrials.length > 0 ? Math.round(totalSelectTime / taskATrials.length) : 0,
        avgReEntries: taskATrials.length > 0 ? Math.round((totalReEntries / taskATrials.length) * 10) / 10 : 0,
      },
      taskB: {
        durationSeconds: 60 - taskBSecondsLeft,
        accidentalActivations: taskBActivations,
        activationTimestamps: taskBActivationTimestampsRef.current,
        falseActivationsPerMinute: Math.round(taskBActivations * 10) / 10,
      },
      taskC: {
        completed: taskCStep === 5,
        totalTimeMs: taskCTotalTimeMs,
        retryCount: taskCRetries,
        chosenBoard: taskCBoard,
        chosenSubject: taskCSubject,
        questionAsked: taskCQuestion,
      },
      sus: {
        q1: susRatings[0],
        q2: susRatings[1],
        q3: susRatings[2],
        q4: susRatings[3],
        q5: susRatings[4],
        q6: susRatings[5],
        q7: susRatings[6],
        q8: susRatings[7],
        q9: susRatings[8],
        q10: susRatings[9],
        commentsChallenging,
        commentsIntuitive,
        commentsSuggestions,
        susScore: computedSusScore,
      },
    };
  }, [
    participantId,
    lighting,
    glasses,
    distanceCm,
    screenSize,
    calibrationGrade,
    consentGiven,
    targetSize,
    dwellMs,
    trialCount,
    taskATrials,
    taskBSecondsLeft,
    taskBActivations,
    taskCStep,
    taskCTotalTimeMs,
    taskCRetries,
    taskCBoard,
    taskCSubject,
    taskCQuestion,
    susRatings,
    commentsChallenging,
    commentsIntuitive,
    commentsSuggestions,
    computedSusScore,
  ]);

  // Export handlers
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `eval_${participantId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["Participant_ID", sessionData.participant.id],
      ["Timestamp", sessionData.participant.timestamp],
      ["Lighting", sessionData.participant.lighting],
      ["Glasses", sessionData.participant.glasses],
      ["Distance_cm", sessionData.participant.distanceCm],
      ["Screen_Size", sessionData.participant.screenSize],
      ["Calibration_Grade", sessionData.participant.calibrationGrade],
      ["Target_Size", sessionData.settings.targetSize],
      ["Dwell_Ms", sessionData.settings.dwellMs],
      ["TaskA_Success_Rate_Pct", sessionData.taskA.successRate],
      ["TaskA_Avg_Time_Ms", sessionData.taskA.avgTimeMs],
      ["TaskA_Avg_ReEntries", sessionData.taskA.avgReEntries],
      ["TaskB_False_Activations_Per_Min", sessionData.taskB.falseActivationsPerMinute],
      ["TaskC_Completed", sessionData.taskC.completed],
      ["TaskC_Total_Time_Ms", sessionData.taskC.totalTimeMs],
      ["TaskC_Retries", sessionData.taskC.retryCount],
      ["SUS_Score", sessionData.sus.susScore],
      ["Comments_Challenging", `"${sessionData.sus.commentsChallenging.replace(/"/g, '""')}"`],
      ["Comments_Intuitive", `"${sessionData.sus.commentsIntuitive.replace(/"/g, '""')}"`],
      ["Comments_Suggestions", `"${sessionData.sus.commentsSuggestions.replace(/"/g, '""')}"`],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `eval_${participantId}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <GazeProvider gazePointRef={sharedGazePointRef}>
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col select-none">
        {/* Top Header */}
        <header className="px-6 py-4 bg-[#0d1527] border-b-2 border-slate-800 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-bold text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5"
            >
              ← Back to AI Tutor
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <span>🔬</span> Gaze & Usability Evaluation Lab
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Phase 13 Dev Mode
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              PID: <strong className="text-emerald-400">{participantId}</strong>
            </span>
          </div>
        </header>

        {/* Wizard Steps Navigation Bar */}
        <div className="bg-[#0b1120] px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-6 min-w-max">
            <span className={step === "setup" ? "text-amber-300 font-black flex items-center gap-1.5" : ""}>
              1. Setup & Consent
            </span>
            <span>→</span>
            <span className={step === "taskA" ? "text-amber-300 font-black flex items-center gap-1.5" : ""}>
              2. Task A (Target Selection)
            </span>
            <span>→</span>
            <span className={step === "taskB" ? "text-amber-300 font-black flex items-center gap-1.5" : ""}>
              3. Task B (Midas Touch)
            </span>
            <span>→</span>
            <span className={step === "taskC" ? "text-amber-300 font-black flex items-center gap-1.5" : ""}>
              4. Task C (Full Journey)
            </span>
            <span>→</span>
            <span className={step === "sus" ? "text-amber-300 font-black flex items-center gap-1.5" : ""}>
              5. Usability Scale (SUS)
            </span>
            <span>→</span>
            <span className={step === "results" ? "text-emerald-400 font-black flex items-center gap-1.5" : ""}>
              6. Results & Export
            </span>
          </div>

          <div className="text-xs text-slate-400">
            Dwell: <span className="text-white font-mono">{dwellMs}ms</span> • Size:{" "}
            <span className="text-white font-mono">{targetSize}</span>
          </div>
        </div>

        {/* Step 1: Participant Setup & Consent */}
        {step === "setup" && (
          <div className="max-w-4xl mx-auto w-full p-8 flex-1 flex flex-col justify-center">
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">Participant Profile & Study Consent</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Configure trial variables and record condition metadata before starting tasks.
                </p>
              </div>

              {/* Ethics Notice */}
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 space-y-1">
                <strong className="block text-amber-300 text-sm">📋 Ethics & Data Protection Notice:</strong>
                <p>
                  This evaluation measures gaze screen coordinates, dwell durations, and interface latency only.
                  No video, images, audio recordings, or personal identifiers are stored or uploaded.
                  All data is kept strictly on this device until exported.
                </p>
                <p className="text-amber-400/80 italic">
                  Note: Participant testing must be conducted with consenting adult volunteers first. Testing with
                  minors requires appropriate institutional consent and parental approval.
                </p>
              </div>

              {/* Grid: Conditions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div>
                  <label htmlFor="participant-id-input" className="block font-bold text-slate-300 mb-1">Participant ID</label>
                  <input
                    id="participant-id-input"
                    aria-label="Participant ID"
                    type="text"
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="lighting-select" className="block font-bold text-slate-300 mb-1">Ambient Lighting</label>
                  <select
                    id="lighting-select"
                    aria-label="Ambient Lighting"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value as any)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="bright">Bright (Daylight / Overhead lights)</option>
                    <option value="normal">Normal (Standard indoor room)</option>
                    <option value="dim">Dim (Low light / Evening)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="glasses-select" className="block font-bold text-slate-300 mb-1">Corrective Eyewear</label>
                  <select
                    id="glasses-select"
                    aria-label="Corrective Eyewear"
                    value={glasses}
                    onChange={(e) => setGlasses(e.target.value as any)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="none">None (Naked eye)</option>
                    <option value="glasses">Glasses (Spectacles / Anti-glare)</option>
                    <option value="contacts">Contact Lenses</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="distance-input" className="block font-bold text-slate-300 mb-1">Distance from Screen (cm)</label>
                  <input
                    id="distance-input"
                    aria-label="Distance from Screen in centimeters"
                    type="number"
                    value={distanceCm}
                    onChange={(e) => setDistanceCm(Number(e.target.value))}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="screen-size-input" className="block font-bold text-slate-300 mb-1">Screen / Monitor Size</label>
                  <input
                    id="screen-size-input"
                    aria-label="Screen / Monitor Size"
                    type="text"
                    value={screenSize}
                    onChange={(e) => setScreenSize(e.target.value)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="calibration-grade-select" className="block font-bold text-slate-300 mb-1">Calibration Quality Grade</label>
                  <select
                    id="calibration-grade-select"
                    aria-label="Calibration Quality Grade"
                    value={calibrationGrade}
                    onChange={(e) => setCalibrationGrade(e.target.value as any)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="good">Good (5/5 points verified)</option>
                    <option value="moderate">Moderate (Acceptable tracking)</option>
                    <option value="poor">Poor (High gaze drift / jitter)</option>
                    <option value="simulated">Simulated Mouse Gaze</option>
                  </select>
                </div>
              </div>

              {/* Study Configurations */}
              <div className="p-4 bg-[#111c33] rounded-2xl border border-slate-800 space-y-4">
                <h3 className="font-black text-amber-300 text-sm">Experimental Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label htmlFor="dwell-time-select" className="block text-slate-400 font-bold mb-1">Target Dwell Time</label>
                    <select
                      id="dwell-time-select"
                      aria-label="Target Dwell Time"
                      value={dwellMs}
                      onChange={(e) => setDwellMs(Number(e.target.value))}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-2 text-white font-bold"
                    >
                      <option value={800}>0.8 s (Fast Dwell)</option>
                      <option value={1200}>1.2 s (Recommended Default)</option>
                      <option value={1600}>1.6 s (Extended Dwell)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="target-size-select" className="block text-slate-400 font-bold mb-1">Target Size</label>
                    <select
                      id="target-size-select"
                      aria-label="Target Size"
                      value={targetSize}
                      onChange={(e) => setTargetSize(e.target.value as any)}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-2 text-white font-bold"
                    >
                      <option value="small">Small (128 x 96 px)</option>
                      <option value="medium">Medium (176 x 112 px)</option>
                      <option value="large">Large (224 x 144 px)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="trial-count-select" className="block text-slate-400 font-bold mb-1">Number of Task A Trials</label>
                    <select
                      id="trial-count-select"
                      aria-label="Number of Task A Trials"
                      value={trialCount}
                      onChange={(e) => setTrialCount(Number(e.target.value))}
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-2 text-white font-bold"
                    >
                      <option value={10}>10 Trials (Quick Evaluation)</option>
                      <option value={20}>20 Trials (Full Standard)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-700">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-amber-400 rounded cursor-pointer"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  I confirm that the participant has been informed of the evaluation objectives and agrees to participate.
                  Only anonymized timings and accuracy coordinates will be logged.
                </label>
              </div>

              {/* Action */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  disabled={!consentGiven}
                  onClick={handleStartTaskA}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-black rounded-2xl shadow-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  Proceed to Task A (Target Selection) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Task A - Target Selection Trials */}
        {step === "taskA" && (
          <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
            {/* Task Banner */}
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-2xl p-4 mb-6 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Task A: Target Selection (Trial {currentTrialIdx + 1} of {trialCount})
                </span>
                <h2 className="text-lg font-black text-white">
                  Look at and dwell on the highlighted target: <span className="text-amber-300 font-mono">{goalTargetId.toUpperCase()}</span>
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-bold">Progress</div>
                  <div className="text-sm font-mono text-emerald-400 font-black">
                    {taskATrials.filter((t) => t.status === "success").length} / {currentTrialIdx} success
                  </div>
                </div>
                <button
                  onClick={() => setStep("taskB")}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Skip to Task B
                </button>
              </div>
            </div>

            {/* Target Arena (6 Targets Grid) */}
            <div className="flex-1 min-h-[460px] bg-[#090f1d] border-4 border-dashed border-slate-800 rounded-3xl p-8 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-8 justify-items-center">
                {["target-1", "target-2", "target-3", "target-4", "target-5", "target-6"].map((tId) => {
                  const isGoal = tId === goalTargetId;
                  return (
                    <div
                      key={tId}
                      className={`relative flex flex-col items-center justify-center rounded-2xl transition-all ${
                        isGoal ? "ring-4 ring-amber-400 scale-105 shadow-[0_0_30px_#fbbf2440]" : "opacity-80"
                      }`}
                    >
                      <GazeButton
                        id={tId}
                        dwellMs={dwellMs}
                        onClick={() => handleTaskATargetActivated(tId)}
                        variant={isGoal ? "primary" : "secondary"}
                        className={`${targetDimensionClass} font-black flex flex-col items-center justify-center`}
                      >
                        <span className="text-2xl mb-1">{isGoal ? "🎯" : "🔘"}</span>
                        <span>{tId.toUpperCase()}</span>
                        {isGoal && <span className="text-[10px] text-amber-200 mt-1 uppercase">Dwell Here</span>}
                      </GazeButton>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Task B - Midas Touch Test */}
        {step === "taskB" && (
          <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-2xl p-4 mb-6 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Task B: Midas Touch Sensitivity Test
                </span>
                <h2 className="text-lg font-black text-white">
                  Freely view the screen for 60 seconds without selecting anything.
                </h2>
                <p className="text-xs text-slate-400">
                  Measures accidental activations caused by natural visual exploration.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-slate-400 font-bold">Timer</div>
                  <div className="text-2xl font-mono text-amber-300 font-black">
                    {taskBSecondsLeft}s
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-xs text-slate-400 font-bold">Accidental Activations</div>
                  <div className="text-2xl font-mono text-rose-400 font-black">
                    {taskBActivations}
                  </div>
                </div>

                {!taskBIsRunning && taskBSecondsLeft === 60 ? (
                  <button
                    onClick={handleStartTaskB}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm"
                  >
                    Start 60s Test ▶
                  </button>
                ) : !taskBIsRunning && taskBSecondsLeft === 0 ? (
                  <button
                    onClick={handleStartTaskC}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm"
                  >
                    Proceed to Task C →
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setTaskBIsRunning(false);
                      setStep("taskC");
                    }}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Skip to Task C
                  </button>
                )}
              </div>
            </div>

            {/* Free viewing canvas with cards */}
            <div className="flex-1 min-h-[460px] bg-[#090f1d] border-4 border-slate-800 rounded-3xl p-8 grid grid-cols-3 gap-6 items-center">
              {[
                { id: "midas-1", title: "Human Respiratory System", icon: "🫁" },
                { id: "midas-2", title: "Ohm's Law & Circuits", icon: "⚡" },
                { id: "midas-3", title: "The Indian Constitution", icon: "📜" },
                { id: "midas-4", title: "Chemical Reactions", icon: "🧪" },
                { id: "midas-5", title: "Forests & Wildlife", icon: "🌳" },
                { id: "midas-6", title: "Light & Refraction", icon: "🔍" },
              ].map((card) => (
                <div key={card.id} className="h-full flex flex-col justify-center">
                  <GazeButton
                    id={card.id}
                    dwellMs={dwellMs}
                    onClick={() => handleTaskBAccidentalActivation(card.id)}
                    variant="card"
                    className="w-full h-40 flex flex-col items-center justify-center p-4 border border-slate-700 bg-slate-900/60"
                  >
                    <span className="text-4xl mb-2">{card.icon}</span>
                    <span className="font-bold text-center text-sm">{card.title}</span>
                    <span className="text-[10px] text-slate-500 mt-2 font-mono">Do Not Dwell</span>
                  </GazeButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Task C - Full Scripted Journey */}
        {step === "taskC" && (
          <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-2xl p-4 mb-6 flex items-center justify-between shadow-xl">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Task C: Full Scripted Journey (Step {taskCStep} of 4)
                </span>
                <h2 className="text-lg font-black text-white">
                  Complete an end-to-end learning interaction using only Gaze or Voice.
                </h2>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Retries: <strong className="text-amber-300">{taskCRetries}</strong>
              </div>
            </div>

            <div className="flex-1 bg-[#090f1d] border-2 border-slate-800 rounded-3xl p-8 flex flex-col justify-center items-center text-center space-y-6">
              {taskCStep === 1 && (
                <>
                  <h3 className="text-2xl font-black text-white">Step 1: Choose Your Examination Board</h3>
                  <p className="text-sm text-slate-400">Select Tamil Nadu State Board or CBSE by dwelling on a card.</p>
                  <div className="flex gap-8 mt-4">
                    <GazeButton
                      id="step1-board-tn"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCBoard("tn");
                        setTaskCStep(2);
                      }}
                      className="w-56 h-36 flex flex-col items-center justify-center text-lg font-black"
                    >
                      <span className="text-3xl mb-2">🏛️</span>
                      Tamil Nadu Board
                    </GazeButton>
                    <GazeButton
                      id="step1-board-cbse"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCBoard("cbse");
                        setTaskCStep(2);
                      }}
                      className="w-56 h-36 flex flex-col items-center justify-center text-lg font-black"
                    >
                      <span className="text-3xl mb-2">🏫</span>
                      CBSE / NCERT
                    </GazeButton>
                  </div>
                </>
              )}

              {taskCStep === 2 && (
                <>
                  <h3 className="text-2xl font-black text-white">Step 2: Choose Class 10 Subject</h3>
                  <p className="text-sm text-slate-400">Board selected: <strong className="text-amber-300 uppercase">{taskCBoard}</strong></p>
                  <div className="flex gap-8 mt-4">
                    <GazeButton
                      id="step2-subj-science"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCSubject("science");
                        setTaskCStep(3);
                      }}
                      className="w-56 h-36 flex flex-col items-center justify-center text-lg font-black"
                    >
                      <span className="text-3xl mb-2">🔬</span>
                      Science
                    </GazeButton>
                    <GazeButton
                      id="step2-subj-social"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCSubject("social");
                        setTaskCStep(3);
                      }}
                      className="w-56 h-36 flex flex-col items-center justify-center text-lg font-black"
                    >
                      <span className="text-3xl mb-2">🌍</span>
                      Social Science
                    </GazeButton>
                  </div>
                </>
              )}

              {taskCStep === 3 && (
                <>
                  <h3 className="text-2xl font-black text-white">Step 3: Select a Question to Ask</h3>
                  <p className="text-sm text-slate-400">Dwell to ask your question to AI Tutor.</p>
                  <div className="flex flex-col gap-4 mt-4 w-full max-w-lg">
                    <GazeButton
                      id="step3-q-1"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCQuestion("What is Ohm's Law and its formula?");
                        setTaskCStep(4);
                      }}
                      className="w-full py-4 text-sm font-bold flex items-center justify-center"
                    >
                      ⚡ "What is Ohm's Law and its formula?"
                    </GazeButton>
                    <GazeButton
                      id="step3-q-2"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCQuestion("Explain the process of Photosynthesis.");
                        setTaskCStep(4);
                      }}
                      className="w-full py-4 text-sm font-bold flex items-center justify-center"
                    >
                      🌱 "Explain the process of Photosynthesis."
                    </GazeButton>
                  </div>
                </>
              )}

              {taskCStep === 4 && (
                <div className="w-full max-w-2xl text-left bg-[#101b33] p-6 rounded-2xl border border-slate-700 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                    <span className="text-xs font-mono text-emerald-400 font-black">AI Tutor Response</span>
                    <span className="text-xs font-mono text-slate-400">Class 10 • {taskCBoard.toUpperCase()}</span>
                  </div>
                  <h4 className="text-base font-bold text-amber-300">Q: {taskCQuestion}</h4>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Ohm's law states that at a constant temperature, the electric current (I) flowing through a conductor
                    is directly proportional to the potential difference (V) across its ends [1]. The formula is:
                    <strong className="block my-2 text-center text-amber-300 font-mono text-base bg-slate-900 p-2 rounded-lg">
                      V = I × R
                    </strong>
                    Where V is Voltage (Volts), I is Current (Amperes), and R is Resistance (Ohms) [1].
                  </p>
                  <div className="pt-4 flex justify-between items-center">
                    <button
                      onClick={() => setTaskCRetries((prev) => prev + 1)}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Record Misclick / Retry (+1)
                    </button>
                    <GazeButton
                      id="step4-finish-journey"
                      dwellMs={dwellMs}
                      onClick={() => {
                        setTaskCTotalTimeMs(Math.round(performance.now() - taskCStartTimeRef.current));
                        setTaskCStep(5);
                        setStep("sus");
                      }}
                      className="px-6 py-3 text-sm font-black bg-emerald-500 text-slate-950 rounded-xl"
                    >
                      Complete Journey & Proceed to SUS →
                    </GazeButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: System Usability Scale (SUS) */}
        {step === "sus" && (
          <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-white">System Usability Scale (SUS)</h2>
                  <p className="text-sm text-slate-400">Standardized 10-item usability questionnaire (1 = Strongly Disagree, 5 = Strongly Agree).</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-bold">Computed SUS Score</div>
                  <div className="text-3xl font-black font-mono text-amber-300">{computedSusScore} / 100</div>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                {SUS_QUESTIONS.map((qText, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-200">{qText}</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            const newRatings = [...susRatings];
                            newRatings[idx] = val;
                            setSusRatings(newRatings);
                          }}
                          className={`w-9 h-9 rounded-lg font-bold text-xs transition-all ${
                            susRatings[idx] === val
                              ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Open Feedback */}
              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <h3 className="font-black text-white text-base">Qualitative Feedback</h3>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    1. What was the most challenging part of using gaze/voice control?
                  </label>
                  <textarea
                    value={commentsChallenging}
                    onChange={(e) => setCommentsChallenging(e.target.value)}
                    rows={2}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g., Target edge jitter, neck fatigue, dwell duration felt too long..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    2. What worked well or felt most intuitive?
                  </label>
                  <textarea
                    value={commentsIntuitive}
                    onChange={(e) => setCommentsIntuitive(e.target.value)}
                    rows={2}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g., Audio cue on completion, large target borders, high contrast..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    3. Suggestions for improving comfort, clarity, or accessibility:
                  </label>
                  <textarea
                    value={commentsSuggestions}
                    onChange={(e) => setCommentsSuggestions(e.target.value)}
                    rows={2}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g., Adjustable target padding, quick pause toggle, voice confirmation..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep("results")}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm"
                >
                  View Final Results & Export Data →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Results & Export */}
        {step === "results" && (
          <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-[#0d1527] border-2 border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-white">Evaluation Session Summary</h2>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    ID: <strong className="text-emerald-400">{sessionData.participant.id}</strong> •{" "}
                    {new Date(sessionData.participant.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportJson}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
                  >
                    Download JSON 💾
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
                  >
                    Download CSV 📊
                  </button>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-[#111c33] p-4 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-bold">Task A Accuracy</div>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    {sessionData.taskA.successRate}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    avg {sessionData.taskA.avgTimeMs}ms
                  </div>
                </div>

                <div className="bg-[#111c33] p-4 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-bold">Midas Touch Rate</div>
                  <div className="text-2xl font-black font-mono text-amber-300 mt-1">
                    {sessionData.taskB.falseActivationsPerMinute} / min
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    60s free viewing
                  </div>
                </div>

                <div className="bg-[#111c33] p-4 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-bold">Journey Duration</div>
                  <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
                    {Math.round(sessionData.taskC.totalTimeMs / 1000)}s
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {sessionData.taskC.retryCount} retries
                  </div>
                </div>

                <div className="bg-[#111c33] p-4 rounded-2xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-bold">SUS Usability Score</div>
                  <div className="text-2xl font-black font-mono text-purple-400 mt-1">
                    {sessionData.sus.susScore} / 100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Grade {sessionData.sus.susScore >= 80 ? "A (Excellent)" : sessionData.sus.susScore >= 68 ? "B (Good)" : "C (Marginal)"}
                  </div>
                </div>
              </div>

              {/* Data JSON Preview */}
              <div className="bg-[#070b14] p-4 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 max-h-60 overflow-y-auto">
                <pre>{JSON.stringify(sessionData, null, 2)}</pre>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => {
                    const randomHex = Math.random().toString(16).substring(2, 8);
                    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                    setParticipantId(`p_${dateStr}_${randomHex}`);
                    setStep("setup");
                  }}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Start Another Participant Evaluation
                </button>

                <Link
                  href="/"
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
                >
                  Return to AI Tutor App
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Live Gaze Dot & Simulator */}
        <GazeDot gazePointRef={sharedGazePointRef} visible={true} />
        <GazeSimulator gazePointRef={sharedGazePointRef} />
      </div>
    </GazeProvider>
  );
}
