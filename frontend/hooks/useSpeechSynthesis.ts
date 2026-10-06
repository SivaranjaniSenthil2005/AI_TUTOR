"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  createTextToSpeechProvider,
  type TextToSpeechProvider,
  type TextToSpeechOptions,
  type VoiceOption,
  type VoiceSettings,
} from "@/lib/voice";

const VOICE_SETTINGS_STORAGE_KEY = "ai_tutor_voice_settings";

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  sttLang: "en-IN",
  ttsVoiceURI: "",
  ttsRate: 0.9,
  ttsPitch: 1.0,
  autoRead: true,
  hasSeenPrivacyNotice: false,
};

export interface UseSpeechSynthesisOptions {
  provider?: TextToSpeechProvider;
  onStopStt?: () => void; // Mutual exclusion: stops mic before speaking
  onStart?: () => void;
  onEnd?: () => void;
}

export interface UseSpeechSynthesisReturn {
  speaking: boolean;
  paused: boolean;
  currentCharIndex: number;
  currentSentenceIndex: number;
  currentSentenceText: string;
  voices: VoiceOption[];
  settings: VoiceSettings;
  updateSettings: (newSettings: Partial<VoiceSettings>) => void;
  speak: (text: string, options?: TextToSpeechOptions) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isSupported: boolean;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const { provider: customProvider, onStopStt, onStart, onEnd } = options;

  const provider = useMemo(
    () => customProvider || createTextToSpeechProvider(),
    [customProvider]
  );

  const isSupported = useMemo(() => provider.isSupported(), [provider]);

  const [speaking, setSpeaking] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [currentCharIndex, setCurrentCharIndex] = useState<number>(0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [currentSentenceText, setCurrentSentenceText] = useState<string>("");
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  const [settings, setSettings] = useState<VoiceSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_VOICE_SETTINGS, ...parsed };
        }
      } catch {}
    }
    return DEFAULT_VOICE_SETTINGS;
  });

  const onStopSttRef = useRef(onStopStt);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onStopSttRef.current = onStopStt;
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
  }, [onStopStt, onStart, onEnd]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Initialize provider and events
  useEffect(() => {
    provider.listVoices().then((list) => {
      setVoices(list);
    });

    provider.setEvents({
      onStart: () => {
        setSpeaking(true);
        setPaused(false);
        onStartRef.current?.();
      },
      onSentenceStart: (index, text) => {
        setCurrentSentenceIndex(index);
        setCurrentSentenceText(text);
      },
      onBoundary: (charIndex) => {
        setCurrentCharIndex(charIndex);
      },
      onEnd: () => {
        setSpeaking(false);
        setPaused(false);
        setCurrentCharIndex(0);
        setCurrentSentenceIndex(0);
        setCurrentSentenceText("");
        onEndRef.current?.();
      },
      onError: () => {
        setSpeaking(false);
        setPaused(false);
        onEndRef.current?.();
      },
      onPause: () => {
        setPaused(true);
      },
      onResume: () => {
        setPaused(false);
      },
    });

    return () => {
      provider.cancel();
    };
  }, [provider]);

  const speak = useCallback(
    (text: string, speakOptions: TextToSpeechOptions = {}) => {
      // Mutual exclusion: Stop microphone before speaking!
      onStopSttRef.current?.();

      setCurrentCharIndex(0);
      setCurrentSentenceIndex(0);
      setCurrentSentenceText("");

      provider.speak(text, {
        voiceURI: speakOptions.voiceURI || settings.ttsVoiceURI,
        rate: speakOptions.rate ?? settings.ttsRate,
        pitch: speakOptions.pitch ?? settings.ttsPitch,
        lang: speakOptions.lang || settings.sttLang,
        ...speakOptions,
      });
    },
    [settings, provider]
  );

  const pause = useCallback(() => {
    provider.pause();
    setPaused(true);
  }, [provider]);

  const resume = useCallback(() => {
    provider.resume();
    setPaused(false);
  }, [provider]);

  const stop = useCallback(() => {
    provider.cancel();
    setSpeaking(false);
    setPaused(false);
    setCurrentCharIndex(0);
    setCurrentSentenceIndex(0);
    setCurrentSentenceText("");
  }, [provider]);

  return {
    speaking,
    paused,
    currentCharIndex,
    currentSentenceIndex,
    currentSentenceText,
    voices,
    settings,
    updateSettings,
    speak,
    pause,
    resume,
    stop,
    isSupported,
  };
}
