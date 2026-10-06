/**
 * Voice Provider Abstraction Types for AI Tutor.
 * Supports Speech-to-Text (STT) and Text-to-Speech (TTS).
 */

export type SpeechToTextState =
  | "unsupported"
  | "idle"
  | "requesting-permission"
  | "listening"
  | "processing"
  | "error";

export type SpeechToTextErrorCode =
  | "not-allowed"        // Mic permission denied
  | "no-speech"          // No speech detected
  | "audio-capture"      // No microphone hardware
  | "network"            // Network error talking to speech service
  | "service-not-allowed"
  | "aborted"
  | "unsupported"
  | "unknown";

export interface SpeechToTextError {
  code: SpeechToTextErrorCode;
  message: string;
}

export interface SpeechToTextEvents {
  onStateChange?: (state: SpeechToTextState) => void;
  onInterim?: (transcript: string) => void;
  onFinal?: (transcript: string) => void;
  onError?: (error: SpeechToTextError) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export interface SpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechToTextProvider {
  isSupported(): boolean;
  start(options?: SpeechToTextOptions): void;
  stop(): void;
  abort(): void;
  setEvents(events: SpeechToTextEvents): void;
  getState(): SpeechToTextState;
}

export interface TextToSpeechOptions {
  voiceURI?: string;
  lang?: string;
  rate?: number;   // 0.5 to 1.5 (default: 0.9 for comfortable neurodiverse comprehension)
  pitch?: number;  // 0.8 to 1.2 (default: 1.0)
  volume?: number; // 0.0 to 1.0 (default: 1.0)
}

export interface TextToSpeechEvents {
  onStart?: () => void;
  onBoundary?: (charIndex: number, length?: number, name?: string) => void;
  onSentenceStart?: (sentenceIndex: number, sentenceText: string) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onPause?: () => void;
  onResume?: () => void;
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
}

export interface TextToSpeechProvider {
  isSupported(): boolean;
  speak(text: string, options?: TextToSpeechOptions): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  isSpeaking(): boolean;
  isPaused(): boolean;
  listVoices(): Promise<VoiceOption[]>;
  setEvents(events: TextToSpeechEvents): void;
}

export interface VoiceSettings {
  sttLang: string;               // "en-IN" | "en-US"
  ttsVoiceURI: string;           // empty string for default
  ttsRate: number;               // 0.6 to 1.4 (default 0.9)
  ttsPitch: number;              // 0.8 to 1.2 (default 1.0)
  autoRead: boolean;             // auto-read tutor answers
  hasSeenPrivacyNotice: boolean; // browser vendor speech service disclaimer
}

export interface HighlightSegment {
  text: string;
  isCurrentSentence: boolean;
  isCurrentWord: boolean;
}

export interface ReadAlongState {
  currentSentenceIndex: number;
  currentWordIndex: number;
  currentCharIndex: number;
  sentences: string[];
}
