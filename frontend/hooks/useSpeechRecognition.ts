"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  createSpeechToTextProvider,
  type SpeechToTextProvider,
  type SpeechToTextState,
  type SpeechToTextError,
  type SpeechToTextOptions,
} from "@/lib/voice";

export interface UseSpeechRecognitionOptions {
  provider?: SpeechToTextProvider;
  lang?: string;
  onFinalResult?: (transcript: string) => void;
  onStopTts?: () => void; // Mutual exclusion: stops TTS before starting mic
}

export interface UseSpeechRecognitionReturn {
  state: SpeechToTextState;
  transcript: string;
  interimTranscript: string;
  error: SpeechToTextError | null;
  isSupported: boolean;
  start: (options?: SpeechToTextOptions) => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { provider: customProvider, lang = "en-IN", onFinalResult, onStopTts } = options;

  const provider = useMemo(
    () => customProvider || createSpeechToTextProvider(),
    [customProvider]
  );

  const isSupported = useMemo(() => provider.isSupported(), [provider]);

  const [state, setState] = useState<SpeechToTextState>(() =>
    provider.isSupported() ? "idle" : "unsupported"
  );
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<SpeechToTextError | null>(null);

  const onFinalResultRef = useRef(onFinalResult);
  const onStopTtsRef = useRef(onStopTts);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
    onStopTtsRef.current = onStopTts;
  }, [onFinalResult, onStopTts]);

  // Set event listeners on provider
  useEffect(() => {
    provider.setEvents({
      onStateChange: (newState) => {
        setState(newState);
      },
      onInterim: (interim) => {
        setInterimTranscript(interim);
      },
      onFinal: (final) => {
        setTranscript(final);
        setInterimTranscript("");
        onFinalResultRef.current?.(final);
      },
      onError: (err) => {
        setError(err);
      },
      onEnd: () => {
        // Recognition completed
      },
      onStart: () => {
        setError(null);
      },
    });

    return () => {
      provider.abort();
    };
  }, [provider]);

  const start = useCallback(
    (startOptions: SpeechToTextOptions = {}) => {
      // Mutual exclusion: Stop any playing audio before listening
      onStopTtsRef.current?.();

      setError(null);
      setTranscript("");
      setInterimTranscript("");

      provider.start({
        lang: startOptions.lang || lang,
        interimResults: true,
        continuous: false,
        ...startOptions,
      });
    },
    [lang, provider]
  );

  const stop = useCallback(() => {
    provider.stop();
  }, [provider]);

  const reset = useCallback(() => {
    provider.abort();
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setState(provider.isSupported() ? "idle" : "unsupported");
  }, [provider]);

  return {
    state,
    transcript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    reset,
  };
}
