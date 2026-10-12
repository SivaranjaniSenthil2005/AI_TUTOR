/**
 * Session state machine for the Ask experience.
 * Pure, deterministic, and fully unit-testable.
 *
 * States:
 *   idle -> listening -> confirming -> thinking -> answering -> speaking -> idle
 *   plus error and aborted.
 *
 * Mutual Exclusion Rules:
 *   1. No listening while speaking (TTS must be terminated before STT starts).
 *   2. No speaking while listening or thinking.
 *   3. Irrelevant buttons are strictly disabled per state.
 */

export type AskState =
  | "idle"
  | "listening"
  | "confirming"
  | "thinking"
  | "answering"
  | "speaking"
  | "error"
  | "aborted";

export type AskEvent =
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING"; transcript?: string }
  | { type: "CONFIRM_VOICE_QUESTION"; question: string }
  | { type: "RETRY_VOICE" }
  | { type: "CANCEL_VOICE" }
  | { type: "SUBMIT_QUESTION"; question: string }
  | { type: "RECEIVE_STREAM_START" }
  | { type: "RECEIVE_TOKEN"; token: string }
  | { type: "FINISH_ANSWER"; autoSpeak?: boolean }
  | { type: "START_SPEAKING" }
  | { type: "STOP_SPEAKING" }
  | { type: "PAUSE_SPEAKING" }
  | { type: "RESUME_SPEAKING" }
  | { type: "STOP_REQUEST" } // User clicks Stop button during thinking / answering
  | { type: "ERROR"; error: string }
  | { type: "RESET_TO_IDLE" };

export interface SessionContext {
  pendingVoiceTranscript?: string;
  errorMessage?: string;
  isPausedSpeaking?: boolean;
}

export interface AskMachineSnapshot {
  state: AskState;
  context: SessionContext;
}

export function initialSessionSnapshot(): AskMachineSnapshot {
  return {
    state: "idle",
    context: {},
  };
}

/**
 * Pure state transition function.
 */
export function askMachineTransition(
  current: AskMachineSnapshot,
  event: AskEvent
): AskMachineSnapshot {
  const { state, context } = current;

  switch (state) {
    case "idle": {
      if (event.type === "START_LISTENING") {
        return {
          state: "listening",
          context: { ...context, pendingVoiceTranscript: undefined, errorMessage: undefined },
        };
      }
      if (event.type === "SUBMIT_QUESTION") {
        return {
          state: "thinking",
          context: { ...context, errorMessage: undefined },
        };
      }
      if (event.type === "START_SPEAKING") {
        return {
          state: "speaking",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      break;
    }

    case "listening": {
      if (event.type === "STOP_LISTENING") {
        if (event.transcript && event.transcript.trim()) {
          return {
            state: "confirming",
            context: { ...context, pendingVoiceTranscript: event.transcript.trim() },
          };
        }
        return { state: "idle", context: { ...context, pendingVoiceTranscript: undefined } };
      }
      if (event.type === "CANCEL_VOICE") {
        return { state: "idle", context: { ...context, pendingVoiceTranscript: undefined } };
      }
      if (event.type === "ERROR") {
        return { state: "error", context: { ...context, errorMessage: event.error } };
      }
      break;
    }

    case "confirming": {
      if (event.type === "CONFIRM_VOICE_QUESTION") {
        return {
          state: "thinking",
          context: { ...context, pendingVoiceTranscript: undefined },
        };
      }
      if (event.type === "RETRY_VOICE") {
        return {
          state: "listening",
          context: { ...context, pendingVoiceTranscript: undefined },
        };
      }
      if (event.type === "CANCEL_VOICE") {
        return {
          state: "idle",
          context: { ...context, pendingVoiceTranscript: undefined },
        };
      }
      break;
    }

    case "thinking": {
      if (event.type === "RECEIVE_STREAM_START" || event.type === "RECEIVE_TOKEN") {
        return {
          state: "answering",
          context,
        };
      }
      if (event.type === "FINISH_ANSWER") {
        return {
          state: event.autoSpeak ? "speaking" : "idle",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      if (event.type === "STOP_REQUEST") {
        return {
          state: "aborted",
          context,
        };
      }
      if (event.type === "ERROR") {
        return {
          state: "error",
          context: { ...context, errorMessage: event.error },
        };
      }
      break;
    }

    case "answering": {
      if (event.type === "RECEIVE_TOKEN") {
        return current;
      }
      if (event.type === "FINISH_ANSWER") {
        return {
          state: event.autoSpeak ? "speaking" : "idle",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      if (event.type === "STOP_REQUEST") {
        return {
          state: "aborted",
          context,
        };
      }
      if (event.type === "ERROR") {
        return {
          state: "error",
          context: { ...context, errorMessage: event.error },
        };
      }
      break;
    }

    case "speaking": {
      if (event.type === "STOP_SPEAKING") {
        return {
          state: "idle",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      if (event.type === "PAUSE_SPEAKING") {
        return {
          state: "speaking",
          context: { ...context, isPausedSpeaking: true },
        };
      }
      if (event.type === "RESUME_SPEAKING") {
        return {
          state: "speaking",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      if (event.type === "START_LISTENING") {
        // Enforce rule 1: Starting to listen immediately cuts speaking
        return {
          state: "listening",
          context: { ...context, isPausedSpeaking: false, pendingVoiceTranscript: undefined },
        };
      }
      if (event.type === "SUBMIT_QUESTION") {
        // Enforce rule 2: Submitting a new question immediately cuts speaking
        return {
          state: "thinking",
          context: { ...context, isPausedSpeaking: false },
        };
      }
      break;
    }

    case "error":
    case "aborted": {
      if (event.type === "RESET_TO_IDLE") {
        return {
          state: "idle",
          context: { pendingVoiceTranscript: undefined, errorMessage: undefined, isPausedSpeaking: false },
        };
      }
      if (event.type === "SUBMIT_QUESTION") {
        return {
          state: "thinking",
          context: { pendingVoiceTranscript: undefined, errorMessage: undefined, isPausedSpeaking: false },
        };
      }
      if (event.type === "START_LISTENING") {
        return {
          state: "listening",
          context: { pendingVoiceTranscript: undefined, errorMessage: undefined, isPausedSpeaking: false },
        };
      }
      break;
    }
  }

  // If transition not allowed, return unchanged state
  return current;
}

/**
 * Pure button entitlement / capability checker for UI.
 */
export function getButtonCapabilities(state: AskState) {
  return {
    canListen: state === "idle" || state === "speaking" || state === "error" || state === "aborted",
    canType: state === "idle" || state === "speaking" || state === "error" || state === "aborted",
    canStopRequest: state === "thinking" || state === "answering",
    canControlSpeech: state === "speaking",
    canSwitchMode: state === "idle" || state === "speaking",
    canClickSuggestions: state === "idle" || state === "speaking",
    canClearHistory: state === "idle" || state === "speaking" || state === "error" || state === "aborted",
  };
}
