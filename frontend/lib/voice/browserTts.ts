/**
 * Browser Web Speech API Text-to-Speech Implementation.
 * Includes sentence chunking, Chrome keep-alive, and character/word/sentence boundary tracking.
 */

import type {
  TextToSpeechProvider,
  TextToSpeechEvents,
  TextToSpeechOptions,
  VoiceOption,
} from "./types";

export interface SentenceChunk {
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Splits text into sentence chunks while preserving global character indices.
 */
export function splitIntoSentences(text: string): SentenceChunk[] {
  if (!text || !text.trim()) return [];

  const chunks: SentenceChunk[] = [];
  // Regex to split on sentence terminators (. ! ?) followed by whitespace or end-of-string
  const regex = /[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const chunkText = match[0];
    if (chunkText.trim().length > 0) {
      chunks.push({
        text: chunkText.trim(),
        startIndex: match.index,
        endIndex: match.index + chunkText.length,
      });
    }
  }

  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      text: text.trim(),
      startIndex: 0,
      endIndex: text.length,
    });
  }

  return chunks;
}

/**
 * Maps a global character index back to sentence index and word index.
 */
export function mapCharIndexToSentenceAndWord(
  text: string,
  charIndex: number,
  sentences: SentenceChunk[]
): { sentenceIndex: number; wordIndex: number } {
  if (sentences.length === 0 || charIndex < 0) {
    return { sentenceIndex: 0, wordIndex: 0 };
  }

  let sentenceIndex = 0;
  for (let i = 0; i < sentences.length; i++) {
    if (charIndex >= sentences[i].startIndex && charIndex <= sentences[i].endIndex) {
      sentenceIndex = i;
      break;
    }
    if (charIndex > sentences[i].endIndex) {
      sentenceIndex = i;
    }
  }

  const currentSentence = sentences[sentenceIndex];
  const relativeChar = Math.max(0, charIndex - currentSentence.startIndex);
  const words = currentSentence.text.split(/\s+/);

  let accumulated = 0;
  let wordIndex = 0;
  for (let w = 0; w < words.length; w++) {
    accumulated += words[w].length + 1;
    if (relativeChar < accumulated) {
      wordIndex = w;
      break;
    }
  }

  return { sentenceIndex, wordIndex };
}

export class BrowserTtsProvider implements TextToSpeechProvider {
  private events: TextToSpeechEvents = {};
  private voicesCache: VoiceOption[] = [];
  private isVoicesLoaded = false;
  private activeUtteranceQueue: SpeechSynthesisUtterance[] = [];
  private currentSentenceIndex = 0;
  private sentences: SentenceChunk[] = [];
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private _isSpeaking = false;
  private _isPaused = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.initVoices();
    }
  }

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  public setEvents(events: TextToSpeechEvents): void {
    this.events = events;
  }

  public isSpeaking(): boolean {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    return this._isSpeaking || window.speechSynthesis.speaking;
  }

  public isPaused(): boolean {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    return this._isPaused || window.speechSynthesis.paused;
  }

  private initVoices(): void {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const rawVoices = synth.getVoices();
      if (rawVoices && rawVoices.length > 0) {
        this.voicesCache = rawVoices.map((v) => ({
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
        }));
        this.isVoicesLoaded = true;
      }
    };

    loadVoices();
    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = loadVoices;
    }
  }

  public async listVoices(): Promise<VoiceOption[]> {
    if (!this.isSupported()) return [];
    if (this.isVoicesLoaded && this.voicesCache.length > 0) {
      return this.voicesCache;
    }

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      if (voices.length > 0) {
        this.voicesCache = voices.map((v) => ({
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
        }));
        this.isVoicesLoaded = true;
        resolve(this.voicesCache);
        return;
      }

      const handler = () => {
        const loaded = synth.getVoices();
        this.voicesCache = loaded.map((v) => ({
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang,
          default: v.default,
          localService: v.localService,
        }));
        this.isVoicesLoaded = true;
        synth.removeEventListener("voiceschanged", handler);
        resolve(this.voicesCache);
      };

      synth.addEventListener("voiceschanged", handler);

      // Fallback timeout in case voiceschanged does not fire
      setTimeout(() => {
        synth.removeEventListener("voiceschanged", handler);
        resolve(this.voicesCache);
      }, 500);
    });
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    // Chrome workaround: pause & resume every 10s to prevent 15s freeze bug
    this.keepAliveTimer = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  public speak(text: string, options: TextToSpeechOptions = {}): void {
    if (!this.isSupported() || !text || !text.trim()) {
      return;
    }

    this.cancel();

    const synth = window.speechSynthesis;
    this.sentences = splitIntoSentences(text);
    if (this.sentences.length === 0) return;

    this.currentSentenceIndex = 0;
    this._isSpeaking = true;
    this._isPaused = false;
    this.startKeepAlive();
    this.events.onStart?.();

    const voices = synth.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (options.voiceURI) {
      selectedVoice = voices.find((v) => v.voiceURI === options.voiceURI) || null;
    }

    if (!selectedVoice) {
      // Prioritize English voices: en-IN -> en-GB -> en-US -> default
      selectedVoice =
        voices.find((v) => v.lang === "en-IN") ||
        voices.find((v) => v.lang.startsWith("en-GB")) ||
        voices.find((v) => v.lang.startsWith("en-US")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices.find((v) => v.default) ||
        voices[0] ||
        null;
    }

    this.activeUtteranceQueue = this.sentences.map((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = options.rate ?? 0.9;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      utterance.onstart = () => {
        this.currentSentenceIndex = index;
        this.events.onSentenceStart?.(index, chunk.text);
        this.events.onBoundary?.(chunk.startIndex, chunk.text.length, "sentence");
      };

      utterance.onboundary = (e: SpeechSynthesisEvent) => {
        const globalCharIndex = chunk.startIndex + e.charIndex;
        this.events.onBoundary?.(globalCharIndex, e.charLength, e.name);
      };

      utterance.onerror = (e) => {
        this.stopKeepAlive();
        this._isSpeaking = false;
        this._isPaused = false;
        this.events.onError?.(e);
      };

      utterance.onend = () => {
        if (index === this.sentences.length - 1) {
          this.stopKeepAlive();
          this._isSpeaking = false;
          this._isPaused = false;
          this.events.onEnd?.();
        }
      };

      return utterance;
    });

    // Enqueue all sentence utterances
    for (const utt of this.activeUtteranceQueue) {
      synth.speak(utt);
    }
  }

  public pause(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
    this._isPaused = true;
    this.events.onPause?.();
  }

  public resume(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
    this._isPaused = false;
    this.events.onResume?.();
  }

  public cancel(): void {
    if (!this.isSupported()) return;
    this.stopKeepAlive();
    window.speechSynthesis.cancel();
    this.activeUtteranceQueue = [];
    this._isSpeaking = false;
    this._isPaused = false;
    this.events.onEnd?.();
  }
}
