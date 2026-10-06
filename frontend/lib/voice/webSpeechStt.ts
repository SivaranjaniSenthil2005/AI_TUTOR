/**
 * Web Speech API Speech-to-Text Implementation.
 * Uses browser native SpeechRecognition / webkitSpeechRecognition.
 */

import type {
  SpeechToTextProvider,
  SpeechToTextEvents,
  SpeechToTextOptions,
  SpeechToTextState,
  SpeechToTextError,
  SpeechToTextErrorCode,
} from "./types";

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export class WebSpeechSttProvider implements SpeechToTextProvider {
  private recognition: SpeechRecognitionInstance | null = null;
  private state: SpeechToTextState = "idle";
  private events: SpeechToTextEvents = {};
  private currentFinalTranscript: string = "";
  private currentInterimTranscript: string = "";

  constructor() {
    if (typeof window !== "undefined") {
      this.state = this.isSupported() ? "idle" : "unsupported";
    }
  }

  public isSupported(): boolean {
    return getSpeechRecognitionClass() !== null;
  }

  public setEvents(events: SpeechToTextEvents): void {
    this.events = events;
  }

  public getState(): SpeechToTextState {
    return this.state;
  }

  private setState(newState: SpeechToTextState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.events.onStateChange?.(newState);
    }
  }

  public start(options: SpeechToTextOptions = {}): void {
    const SpeechClass = getSpeechRecognitionClass();
    if (!SpeechClass) {
      const err: SpeechToTextError = {
        code: "unsupported",
        message: "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.",
      };
      this.setState("error");
      this.events.onError?.(err);
      return;
    }

    // Stop any existing instance
    this.abort();

    try {
      this.recognition = new SpeechClass();
      this.recognition.lang = options.lang || "en-IN";
      this.recognition.continuous = options.continuous ?? false;
      this.recognition.interimResults = options.interimResults ?? true;
      this.recognition.maxAlternatives = 1;

      this.currentFinalTranscript = "";
      this.currentInterimTranscript = "";
      this.setState("requesting-permission");

      this.recognition.onstart = () => {
        this.setState("listening");
        this.events.onStart?.();
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = this.currentFinalTranscript;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptPiece = result[0]?.transcript || "";
          if (result.isFinal) {
            final += (final ? " " : "") + transcriptPiece.trim();
          } else {
            interim += transcriptPiece;
          }
        }

        this.currentFinalTranscript = final;
        this.currentInterimTranscript = interim;

        if (interim) {
          this.events.onInterim?.(interim);
        }

        if (final) {
          this.events.onFinal?.(final);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const rawError = event.error;
        let code: SpeechToTextErrorCode = "unknown";
        let message = "An error occurred with speech recognition.";

        switch (rawError) {
          case "not-allowed":
          case "permission-denied":
            code = "not-allowed";
            message = "Microphone access was denied. Please allow microphone permissions in your browser.";
            break;
          case "no-speech":
            code = "no-speech";
            message = "No speech was detected. Please try speaking again closer to the microphone.";
            break;
          case "audio-capture":
            code = "audio-capture";
            message = "No microphone hardware was found. Please check your audio input device.";
            break;
          case "network":
            code = "network";
            message = "Network error connecting to speech recognition service. Please check your internet connection.";
            break;
          case "service-not-allowed":
            code = "service-not-allowed";
            message = "Speech recognition service is not available on this device.";
            break;
          case "aborted":
            code = "aborted";
            message = "Speech recognition was stopped.";
            break;
          default:
            code = "unknown";
            message = `Speech recognition notice: ${rawError}`;
            break;
        }

        if (code !== "aborted" && code !== "no-speech") {
          this.setState("error");
          this.events.onError?.({ code, message });
        } else if (code === "no-speech") {
          // Soft notice on no-speech
          this.events.onError?.({ code, message });
        }
      };

      this.recognition.onend = () => {
        if (this.state === "listening" || this.state === "processing" || this.state === "requesting-permission") {
          this.setState("idle");
        }
        this.events.onEnd?.();
        this.recognition = null;
      };

      this.recognition.start();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start speech recognition";
      const errorObj: SpeechToTextError = { code: "unknown", message };
      this.setState("error");
      this.events.onError?.(errorObj);
    }
  }

  public stop(): void {
    if (this.recognition) {
      this.setState("processing");
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error if already stopped
      }
    }
  }

  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore abort error
      }
      this.recognition = null;
    }
    this.setState("idle");
  }
}
