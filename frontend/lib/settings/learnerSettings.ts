import { LearnerProfile } from "../api/types";

export interface AppLearnerSettings {
  mode: "simple" | "step_by_step" | "example" | "exam";
  reading_level: "easy" | "standard";
  max_sentences: number;
  avoid_figurative_language: boolean;
  repeat_key_term: boolean;
  rememberChat: boolean;
}

export const DEFAULT_LEARNER_SETTINGS: AppLearnerSettings = {
  mode: "simple",
  reading_level: "easy",
  max_sentences: 4,
  avoid_figurative_language: true,
  repeat_key_term: true,
  rememberChat: false,
};

const STORAGE_KEY = "ai_tutor_learner_settings";
const CHAT_STORAGE_KEY = "ai_tutor_saved_chat_history";

export function loadLearnerSettings(): AppLearnerSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LEARNER_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LEARNER_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      mode: ["simple", "step_by_step", "example", "exam"].includes(parsed.mode)
        ? parsed.mode
        : DEFAULT_LEARNER_SETTINGS.mode,
      reading_level: ["easy", "standard"].includes(parsed.reading_level)
        ? parsed.reading_level
        : DEFAULT_LEARNER_SETTINGS.reading_level,
      max_sentences:
        typeof parsed.max_sentences === "number" &&
        parsed.max_sentences >= 2 &&
        parsed.max_sentences <= 10
          ? parsed.max_sentences
          : DEFAULT_LEARNER_SETTINGS.max_sentences,
      avoid_figurative_language:
        typeof parsed.avoid_figurative_language === "boolean"
          ? parsed.avoid_figurative_language
          : DEFAULT_LEARNER_SETTINGS.avoid_figurative_language,
      repeat_key_term:
        typeof parsed.repeat_key_term === "boolean"
          ? parsed.repeat_key_term
          : DEFAULT_LEARNER_SETTINGS.repeat_key_term,
      rememberChat:
        typeof parsed.rememberChat === "boolean"
          ? parsed.rememberChat
          : DEFAULT_LEARNER_SETTINGS.rememberChat,
    };
  } catch {
    return { ...DEFAULT_LEARNER_SETTINGS };
  }
}

export function saveLearnerSettings(settings: AppLearnerSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function toLearnerProfilePayload(settings: AppLearnerSettings): LearnerProfile {
  return {
    reading_level: settings.reading_level,
    max_sentences: settings.max_sentences,
    avoid_figurative_language: settings.avoid_figurative_language,
    repeat_key_term: settings.repeat_key_term,
  };
}

export function loadSavedChatHistory(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(history: unknown[], rememberChat: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (rememberChat) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
    } else {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  } catch {}
}

export function clearSavedChatHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {}
}
