import { Turn, SourceCitation } from "../api/types";

export const MAX_HISTORY_TURNS = 6;

/**
 * Appends a new turn and trims to the last N turns (default 6).
 */
export function appendTurn(
  history: Turn[],
  newTurn: Turn,
  maxTurns: number = MAX_HISTORY_TURNS
): Turn[] {
  const updated = [...history, newTurn];
  if (updated.length > maxTurns) {
    return updated.slice(updated.length - maxTurns);
  }
  return updated;
}

/**
 * Extracts active chapter number from sources or topic hints.
 */
export function extractActiveChapter(
  sources?: SourceCitation[],
  topicHint?: string | null
): number | null {
  if (sources && sources.length > 0) {
    for (const src of sources) {
      if (typeof src.chapter_no === "number" && src.chapter_no > 0) {
        return src.chapter_no;
      }
    }
  }

  if (topicHint) {
    const match = /(?:chapter|unit)\s*(\d+)/i.exec(topicHint);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) return num;
    }
  }

  return null;
}
