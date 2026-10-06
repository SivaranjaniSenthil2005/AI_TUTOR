import { WebSpeechSttProvider } from "./webSpeechStt";
import { BrowserTtsProvider } from "./browserTts";
import type { SpeechToTextProvider, TextToSpeechProvider } from "./types";

export * from "./types";
export * from "./webSpeechStt";
export * from "./browserTts";

let defaultSttProvider: SpeechToTextProvider | null = null;
let defaultTtsProvider: TextToSpeechProvider | null = null;

export function createSpeechToTextProvider(): SpeechToTextProvider {
  if (!defaultSttProvider) {
    defaultSttProvider = new WebSpeechSttProvider();
  }
  return defaultSttProvider;
}

export function createTextToSpeechProvider(): TextToSpeechProvider {
  if (!defaultTtsProvider) {
    defaultTtsProvider = new BrowserTtsProvider();
  }
  return defaultTtsProvider;
}
