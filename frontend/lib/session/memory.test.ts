import test from "node:test";
import assert from "node:assert/strict";
import { appendTurn, extractActiveChapter, MAX_HISTORY_TURNS } from "./memory";
import type { Turn, SourceCitation } from "../api/types";

test("memory: maintains sliding window trimmed to last 6 turns", () => {
  let history: Turn[] = [];

  for (let i = 1; i <= 8; i++) {
    history = appendTurn(history, {
      role: i % 2 === 1 ? "student" : "tutor",
      text: `Turn ${i}`,
    });
  }

  assert.equal(history.length, MAX_HISTORY_TURNS);
  assert.equal(history[0].text, "Turn 3");
  assert.equal(history[history.length - 1].text, "Turn 8");
});

test("memory: extracts active chapter from sources", () => {
  const sources: SourceCitation[] = [
    {
      citation_index: 1,
      chunk_id: "c1",
      book_title: "Class 10 Science",
      chapter_no: 12,
      chapter_title: "Plant Physiology",
      page_start: 100,
      page_end: 105,
      source_file: "ch12.pdf",
      text_snippet: "Photosynthesis snippet",
    },
  ];

  const chap = extractActiveChapter(sources);
  assert.equal(chap, 12);
});

test("memory: extracts active chapter from topic hint regex fallback", () => {
  const chap = extractActiveChapter([], "Review of Chapter 4: Carbon and its compounds");
  assert.equal(chap, 4);

  const unitChap = extractActiveChapter([], "Unit 7 Social Science Geography");
  assert.equal(unitChap, 7);

  const none = extractActiveChapter([], "General Overview");
  assert.equal(none, null);
});
