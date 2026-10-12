/**
 * Robust, pure Server-Sent Events (SSE) stream parser for fetch + ReadableStream.
 * Correctly handles chunk boundaries, multi-line data, custom event types, and UTF-8 decodes.
 */

import type { SseEvent } from "./types";

export interface RawSseMessage {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

export class SseBufferParser {
  private buffer: string = "";

  /**
   * Pushes a new chunk of text into the internal buffer and returns any fully assembled SSE messages.
   */
  public push(chunk: string): RawSseMessage[] {
    this.buffer += chunk;
    const messages: RawSseMessage[] = [];

    // SSE messages are separated by two consecutive line endings (\n\n or \r\n\r\n)
    while (true) {
      // Find boundary between complete events
      const match = /\r?\n\r?\n/.exec(this.buffer);
      if (!match) break;

      const rawBlock = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);

      const parsed = this.parseBlock(rawBlock);
      if (parsed) {
        messages.push(parsed);
      }
    }

    return messages;
  }

  /**
   * Parses a single block of SSE lines into a message object.
   */
  public parseBlock(block: string): RawSseMessage | null {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    let id: string | undefined;
    let retry: number | undefined;

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments or empty lines
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        // SSE standard specifies that a single leading space after ':' is ignored
        const dataPart = line.slice(5).replace(/^ /, "");
        dataLines.push(dataPart);
      } else if (line.startsWith("id:")) {
        id = line.slice(3).trim();
      } else if (line.startsWith("retry:")) {
        const r = parseInt(line.slice(6).trim(), 10);
        if (!isNaN(r)) retry = r;
      }
    }

    if (dataLines.length === 0 && event === "message") {
      return null;
    }

    return {
      event,
      data: dataLines.join("\n"),
      id,
      retry,
    };
  }

  /**
   * Resets the buffer.
   */
  public reset(): void {
    this.buffer = "";
  }
}

/**
 * Transforms a Web API ReadableStream of Uint8Array into an AsyncGenerator of typed SseEvent objects.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = new SseBufferParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const textChunk = decoder.decode(value, { stream: true });
      const rawMessages = parser.push(textChunk);

      for (const msg of rawMessages) {
        try {
          const parsedData = msg.data ? JSON.parse(msg.data) : {};
          if (
            msg.event === "meta" ||
            msg.event === "sources" ||
            msg.event === "token" ||
            msg.event === "done" ||
            msg.event === "error"
          ) {
            yield {
              event: msg.event,
              data: parsedData,
            } as SseEvent;
          }
        } catch {
          // If JSON parse fails, yield plain token delta or error
          if (msg.event === "token") {
            yield { event: "token", data: { delta: msg.data } };
          } else if (msg.event === "error") {
            yield { event: "error", data: { message: msg.data } };
          }
        }
      }
    }

    // Flush any remaining trailing data in the text decoder
    const finalChunk = decoder.decode();
    if (finalChunk) {
      const remaining = parser.push(finalChunk);
      for (const msg of remaining) {
        try {
          const parsedData = msg.data ? JSON.parse(msg.data) : {};
          yield { event: msg.event, data: parsedData } as SseEvent;
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
