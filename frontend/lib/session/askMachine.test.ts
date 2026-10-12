import test from "node:test";
import assert from "node:assert/strict";
import {
  askMachineTransition,
  initialSessionSnapshot,
  getButtonCapabilities,
  AskMachineSnapshot,
} from "./askMachine";

test("askMachine: complete happy path voice session", () => {
  let s: AskMachineSnapshot = initialSessionSnapshot();
  assert.equal(s.state, "idle");

  // 1. User starts listening
  s = askMachineTransition(s, { type: "START_LISTENING" });
  assert.equal(s.state, "listening");

  // 2. User stops speaking with transcript
  s = askMachineTransition(s, {
    type: "STOP_LISTENING",
    transcript: "What is photosynthesis?",
  });
  assert.equal(s.state, "confirming");
  assert.equal(s.context.pendingVoiceTranscript, "What is photosynthesis?");

  // 3. User confirms "Yes, ask"
  s = askMachineTransition(s, {
    type: "CONFIRM_VOICE_QUESTION",
    question: "What is photosynthesis?",
  });
  assert.equal(s.state, "thinking");

  // 4. Stream tokens start arriving
  s = askMachineTransition(s, { type: "RECEIVE_STREAM_START" });
  assert.equal(s.state, "answering");

  s = askMachineTransition(s, { type: "RECEIVE_TOKEN", token: "Photosynthesis is..." });
  assert.equal(s.state, "answering");

  // 5. Answer finishes with autoSpeak enabled
  s = askMachineTransition(s, { type: "FINISH_ANSWER", autoSpeak: true });
  assert.equal(s.state, "speaking");

  // 6. Speaking completes
  s = askMachineTransition(s, { type: "STOP_SPEAKING" });
  assert.equal(s.state, "idle");
});

test("askMachine: mutual exclusion rules", () => {
  let s: AskMachineSnapshot = { state: "speaking", context: {} };

  // Rule 1: Starting to listen immediately cuts speaking
  s = askMachineTransition(s, { type: "START_LISTENING" });
  assert.equal(s.state, "listening");

  // Rule 2: Submitting a question while speaking immediately cuts speaking to thinking
  let sSpeaking: AskMachineSnapshot = { state: "speaking", context: {} };
  sSpeaking = askMachineTransition(sSpeaking, {
    type: "SUBMIT_QUESTION",
    question: "What is gravity?",
  });
  assert.equal(sSpeaking.state, "thinking");
});

test("askMachine: stop button aborts thinking or answering", () => {
  let sThinking: AskMachineSnapshot = { state: "thinking", context: {} };
  sThinking = askMachineTransition(sThinking, { type: "STOP_REQUEST" });
  assert.equal(sThinking.state, "aborted");

  let sAnswering: AskMachineSnapshot = { state: "answering", context: {} };
  sAnswering = askMachineTransition(sAnswering, { type: "STOP_REQUEST" });
  assert.equal(sAnswering.state, "aborted");

  // Reset from aborted back to idle
  sAnswering = askMachineTransition(sAnswering, { type: "RESET_TO_IDLE" });
  assert.equal(sAnswering.state, "idle");
});

test("askMachine: error transitions and reset", () => {
  let s: AskMachineSnapshot = { state: "thinking", context: {} };
  s = askMachineTransition(s, { type: "ERROR", error: "Backend unreachable" });
  assert.equal(s.state, "error");
  assert.equal(s.context.errorMessage, "Backend unreachable");

  s = askMachineTransition(s, { type: "RESET_TO_IDLE" });
  assert.equal(s.state, "idle");
  assert.equal(s.context.errorMessage, undefined);
});

test("getButtonCapabilities: strictly disables irrelevant controls per state", () => {
  const idleCaps = getButtonCapabilities("idle");
  assert.equal(idleCaps.canListen, true);
  assert.equal(idleCaps.canType, true);
  assert.equal(idleCaps.canStopRequest, false);
  assert.equal(idleCaps.canControlSpeech, false);
  assert.equal(idleCaps.canSwitchMode, true);

  const listeningCaps = getButtonCapabilities("listening");
  assert.equal(listeningCaps.canListen, false);
  assert.equal(listeningCaps.canType, false);
  assert.equal(listeningCaps.canStopRequest, false);

  const answeringCaps = getButtonCapabilities("answering");
  assert.equal(answeringCaps.canListen, false);
  assert.equal(answeringCaps.canStopRequest, true);
  assert.equal(answeringCaps.canSwitchMode, false);
});
