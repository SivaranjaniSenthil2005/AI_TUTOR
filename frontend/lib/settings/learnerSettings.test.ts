import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LEARNER_SETTINGS,
  toLearnerProfilePayload,
  saveLearnerSettings,
  loadLearnerSettings,
  saveChatHistory,
  loadSavedChatHistory,
  clearSavedChatHistory,
  AppLearnerSettings,
} from "./learnerSettings";

// Mock localStorage for Node test runner
const storage = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true });
Object.defineProperty(globalThis, "window", { value: {}, writable: true });

test("learnerSettings: converts to backend learner_profile payload correctly", () => {
  const settings: AppLearnerSettings = {
    mode: "step_by_step",
    reading_level: "easy",
    max_sentences: 5,
    avoid_figurative_language: true,
    repeat_key_term: true,
    rememberChat: false,
  };

  const payload = toLearnerProfilePayload(settings);
  assert.equal(payload.reading_level, "easy");
  assert.equal(payload.max_sentences, 5);
  assert.equal(payload.avoid_figurative_language, true);
  assert.equal(payload.repeat_key_term, true);
});

test("learnerSettings: persistence roundtrip and defaults", () => {
  storage.clear();
  const initial = loadLearnerSettings();
  assert.equal(initial.mode, DEFAULT_LEARNER_SETTINGS.mode);
  assert.equal(initial.rememberChat, false);

  const updated: AppLearnerSettings = {
    ...initial,
    mode: "exam",
    max_sentences: 6,
    rememberChat: true,
  };
  saveLearnerSettings(updated);

  const loaded = loadLearnerSettings();
  assert.equal(loaded.mode, "exam");
  assert.equal(loaded.max_sentences, 6);
  assert.equal(loaded.rememberChat, true);
});

test("learnerSettings: rememberChat toggle controls chat history storage", () => {
  storage.clear();
  const sampleChat = [{ role: "student", text: "What is friction?" }];

  // When rememberChat is false, saveChatHistory removes it
  saveChatHistory(sampleChat, false);
  assert.deepEqual(loadSavedChatHistory(), []);

  // When rememberChat is true, saveChatHistory persists it
  saveChatHistory(sampleChat, true);
  assert.deepEqual(loadSavedChatHistory(), sampleChat);

  // clearSavedChatHistory removes it
  clearSavedChatHistory();
  assert.deepEqual(loadSavedChatHistory(), []);
});
