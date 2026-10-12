/**
 * Sentence Aligner for Read-Along TTS Highlighting.
 *
 * Requirements:
 * - Read aloud uses speech_text (cleaned of citation markers and formatted for speech).
 * - Split both displayed answer and speech_text with the same sentence splitter.
 * - When sentence counts match, align by index (highlight sentence i on display when sentence i is spoken).
 * - When sentence counts do not match, fall back to highlighting the entire answer block.
 */

import { splitIntoSentences, SentenceChunk } from "./browserTts";

export interface SentenceAlignmentResult {
  matches: boolean;
  displayedSentences: SentenceChunk[];
  speechSentences: SentenceChunk[];
  totalSentences: number;
  /**
   * Given the sentence index currently spoken in speech_text (0-based),
   * returns the corresponding sentence index to highlight in displayed text.
   * If counts do not match, returns -1 indicating fallback to full block highlight.
   */
  getDisplayHighlightIndex: (speechSentenceIdx: number) => number;
}

export function alignSentences(
  displayedAnswer: string,
  speechText: string
): SentenceAlignmentResult {
  const displayed = splitIntoSentences(displayedAnswer);
  const speech = splitIntoSentences(speechText);

  const matches = displayed.length > 0 && displayed.length === speech.length;

  return {
    matches,
    displayedSentences: displayed,
    speechSentences: speech,
    totalSentences: displayed.length,
    getDisplayHighlightIndex: (speechSentenceIdx: number) => {
      if (!matches) {
        return -1; // -1 represents whole-block highlight fallback
      }
      if (speechSentenceIdx >= 0 && speechSentenceIdx < displayed.length) {
        return speechSentenceIdx;
      }
      return -1;
    },
  };
}
