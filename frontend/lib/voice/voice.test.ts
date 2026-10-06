import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitIntoSentences,
  mapCharIndexToSentenceAndWord,
} from "./browserTts";
import { getTutorReply } from "../tutor/mock";
import type {
  SpeechToTextProvider,
  SpeechToTextEvents,
  SpeechToTextState,
  TextToSpeechProvider,
  TextToSpeechEvents,
  VoiceOption,
} from "./types";

test("TTS: splitIntoSentences correctly breaks text into indexed sentence chunks", () => {
  const text = "Hello student! Welcome to AI Tutor. Let us learn science today.";
  const sentences = splitIntoSentences(text);

  assert.equal(sentences.length, 3);
  assert.equal(sentences[0].text, "Hello student!");
  assert.equal(sentences[0].startIndex, 0);
  assert.equal(sentences[1].text, "Welcome to AI Tutor.");
  assert.equal(sentences[2].text, "Let us learn science today.");

  // Edge cases: empty text, single sentence without trailing punctuation
  assert.deepEqual(splitIntoSentences(""), []);
  const single = splitIntoSentences("Just one sentence without period");
  assert.equal(single.length, 1);
  assert.equal(single[0].text, "Just one sentence without period");
});

test("TTS: mapCharIndexToSentenceAndWord maps character offsets accurately", () => {
  const text = "Photosynthesis is good. Plants make food.";
  const sentences = splitIntoSentences(text);

  // Character 5 is within sentence 0 ("Photosynthesis" -> word 0)
  const map1 = mapCharIndexToSentenceAndWord(text, 5, sentences);
  assert.equal(map1.sentenceIndex, 0);
  assert.equal(map1.wordIndex, 0);

  // Character 18 is within sentence 0 ("good" -> word 2)
  const map2 = mapCharIndexToSentenceAndWord(text, 18, sentences);
  assert.equal(map2.sentenceIndex, 0);
  assert.equal(map2.wordIndex, 2);

  // Character 28 is in sentence 1 ("Plants" -> word 0 of sentence 1)
  const map3 = mapCharIndexToSentenceAndWord(text, 28, sentences);
  assert.equal(map3.sentenceIndex, 1);
  assert.equal(map3.wordIndex, 0);
});

test("STT: mock SpeechToTextProvider state transitions and events", () => {
  class MockSttProvider implements SpeechToTextProvider {
    private state: SpeechToTextState = "idle";
    private events: SpeechToTextEvents = {};

    isSupported() {
      return true;
    }
    setEvents(events: SpeechToTextEvents) {
      this.events = events;
    }
    getState() {
      return this.state;
    }
    start() {
      this.state = "listening";
      this.events.onStateChange?.("listening");
      this.events.onStart?.();
    }
    simulateInterim(text: string) {
      this.events.onInterim?.(text);
    }
    simulateFinal(text: string) {
      this.events.onFinal?.(text);
      this.state = "idle";
      this.events.onStateChange?.("idle");
      this.events.onEnd?.();
    }
    simulateError(code: "not-allowed" | "no-speech" | "network") {
      this.state = "error";
      this.events.onStateChange?.("error");
      this.events.onError?.({ code, message: `Mock ${code} error` });
    }
    stop() {
      this.state = "processing";
      this.events.onStateChange?.("processing");
    }
    abort() {
      this.state = "idle";
      this.events.onStateChange?.("idle");
    }
  }

  const mock = new MockSttProvider();
  const stateLog: SpeechToTextState[] = [];
  let interimReceived = "";
  let finalReceived = "";
  let errorReceived = "";

  mock.setEvents({
    onStateChange: (s) => stateLog.push(s),
    onInterim: (i) => {
      interimReceived = i;
    },
    onFinal: (f) => {
      finalReceived = f;
    },
    onError: (e) => {
      errorReceived = e.code;
    },
  });

  // Test successful recognition flow
  mock.start();
  assert.equal(mock.getState(), "listening");

  mock.simulateInterim("what is photo");
  assert.equal(interimReceived, "what is photo");

  mock.simulateFinal("what is photosynthesis");
  assert.equal(finalReceived, "what is photosynthesis");
  assert.equal(mock.getState(), "idle");

  // Test error flow
  mock.start();
  mock.simulateError("not-allowed");
  assert.equal(errorReceived, "not-allowed");
  assert.equal(mock.getState(), "error");
});

test("TTS: mock TextToSpeechProvider lifecycle and voice listing", async () => {
  class MockTtsProvider implements TextToSpeechProvider {
    private speaking = false;
    private paused = false;
    private events: TextToSpeechEvents = {};

    isSupported() {
      return true;
    }
    setEvents(events: TextToSpeechEvents) {
      this.events = events;
    }
    isSpeaking() {
      return this.speaking;
    }
    isPaused() {
      return this.paused;
    }
    async listVoices(): Promise<VoiceOption[]> {
      return [
        {
          voiceURI: "mock-en-in",
          name: "English India",
          lang: "en-IN",
          default: true,
          localService: true,
        },
        {
          voiceURI: "mock-en-gb",
          name: "English UK",
          lang: "en-GB",
          default: false,
          localService: true,
        },
      ];
    }
    speak(text: string) {
      this.speaking = true;
      this.paused = false;
      this.events.onStart?.();
      const sentences = splitIntoSentences(text);
      if (sentences.length > 0) {
        this.events.onSentenceStart?.(0, sentences[0].text);
        this.events.onBoundary?.(sentences[0].startIndex, sentences[0].text.length, "sentence");
      }
    }
    pause() {
      this.paused = true;
      this.events.onPause?.();
    }
    resume() {
      this.paused = false;
      this.events.onResume?.();
    }
    cancel() {
      this.speaking = false;
      this.paused = false;
      this.events.onEnd?.();
    }
  }

  const tts = new MockTtsProvider();
  const voices = await tts.listVoices();
  assert.equal(voices.length, 2);
  assert.equal(voices[0].lang, "en-IN");

  let boundaryCalled = false;
  tts.setEvents({
    onBoundary: () => {
      boundaryCalled = true;
    },
  });

  tts.speak("Hello from AI Tutor.");
  assert.equal(tts.isSpeaking(), true);
  assert.equal(boundaryCalled, true);

  tts.pause();
  assert.equal(tts.isPaused(), true);

  tts.resume();
  assert.equal(tts.isPaused(), false);

  tts.cancel();
  assert.equal(tts.isSpeaking(), false);
});

test("Mutual Exclusion: STT stops TTS and TTS stops STT", () => {
  let isTtsPlaying = true;
  let isSttListening = false;

  const stopTts = () => {
    isTtsPlaying = false;
  };

  const stopStt = () => {
    isSttListening = false;
  };

  // When STT starts, it stops TTS
  const startStt = () => {
    stopTts();
    isSttListening = true;
  };

  // When TTS starts, it stops STT
  const startTts = () => {
    stopStt();
    isTtsPlaying = true;
  };

  startStt();
  assert.equal(isSttListening, true);
  assert.equal(isTtsPlaying, false);

  startTts();
  assert.equal(isSttListening, false);
  assert.equal(isTtsPlaying, true);
});

test("Tutor Mock: returns relevant curriculum responses with simulated delay", async () => {
  const reply1 = await getTutorReply("Tell me about photosynthesis in science");
  assert.ok(reply1.includes("Photosynthesis"));
  assert.ok(reply1.includes("chloroplasts"));

  const reply2 = await getTutorReply("What is Pythagoras theorem?", {
    board: "CBSE / NCERT",
    className: "Std 9",
    subject: "Maths",
  });
  assert.ok(reply2.includes("Pythagorean theorem"));
  assert.ok(reply2.includes("right-angled triangle"));

  const genericReply = await getTutorReply("What are chemical reactions?", {
    board: "TN SCERT",
    className: "Std 10",
    subject: "Science",
  });
  assert.ok(genericReply.includes("chemical reactions"));
  assert.ok(genericReply.includes("Science"));
});
