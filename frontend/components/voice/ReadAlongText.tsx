"use client";

import React, { useMemo } from "react";
import { splitIntoSentences, type SentenceChunk } from "@/lib/voice";

export interface ReadAlongTextProps {
  text: string;
  isSpeaking: boolean;
  currentCharIndex?: number;
  currentSentenceIndex?: number;
  className?: string;
}

export function ReadAlongText({
  text,
  isSpeaking,
  currentCharIndex = 0,
  currentSentenceIndex = 0,
  className = "",
}: ReadAlongTextProps) {
  const sentences: SentenceChunk[] = useMemo(() => {
    return splitIntoSentences(text);
  }, [text]);

  if (!isSpeaking || sentences.length === 0) {
    return <div className={`text-slate-200 leading-relaxed ${className}`}>{text}</div>;
  }

  // Determine active sentence: either by sentenceIndex or by currentCharIndex
  let activeSentenceIdx = currentSentenceIndex;
  if (currentCharIndex > 0) {
    for (let i = 0; i < sentences.length; i++) {
      if (
        currentCharIndex >= sentences[i].startIndex &&
        currentCharIndex <= sentences[i].endIndex
      ) {
        activeSentenceIdx = i;
        break;
      }
    }
  }

  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {sentences.map((sentence, idx) => {
        const isCurrentSentence = idx === activeSentenceIdx;

        if (!isCurrentSentence) {
          return (
            <span key={idx} className="transition-colors duration-150 mr-1 text-slate-300">
              {sentence.text}{" "}
            </span>
          );
        }

        // Within active sentence: render with prominent sentence highlight and optional word highlight
        const relativeChar = Math.max(0, currentCharIndex - sentence.startIndex);
        const words = sentence.text.split(/(\s+)/);

        let charCount = 0;

        return (
          <span
            key={idx}
            className="inline-block bg-amber-400/25 text-white font-medium border-l-4 border-amber-400 px-2 py-0.5 rounded-r shadow-[0_0_12px_rgba(251,191,36,0.2)] transition-all duration-150 mr-1"
          >
            {words.map((word, wIdx) => {
              const wordStart = charCount;
              const wordEnd = charCount + word.length;
              charCount = wordEnd;

              const isWord = word.trim().length > 0;
              const isCurrentWord =
                isWord &&
                relativeChar >= wordStart &&
                relativeChar < wordEnd &&
                relativeChar > 0;

              if (isCurrentWord) {
                return (
                  <span
                    key={wIdx}
                    className="bg-amber-300 text-slate-950 font-black px-1.5 py-0.5 rounded shadow-sm scale-105 inline-block transition-transform duration-100"
                  >
                    {word}
                  </span>
                );
              }

              return <span key={wIdx}>{word}</span>;
            })}
            {" "}
          </span>
        );
      })}
    </div>
  );
}
