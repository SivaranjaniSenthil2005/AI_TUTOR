import test from "node:test";
import assert from "node:assert/strict";
import { SseBufferParser, parseSseStream } from "./sseParser";

test("SseBufferParser: parses standard event and data", () => {
  const parser = new SseBufferParser();
  const raw = "event: meta\ndata: {\"topic_hint\":\"science\"}\n\n";
  const msgs = parser.push(raw);

  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].event, "meta");
  assert.equal(msgs[0].data, '{"topic_hint":"science"}');
});

test("SseBufferParser: handles chunk boundaries splitting events across pushes", () => {
  const parser = new SseBufferParser();

  // Push partial first half
  const chunk1 = "event: token\nda";
  const res1 = parser.push(chunk1);
  assert.equal(res1.length, 0);

  // Push remainder and second event
  const chunk2 = "ta: {\"delta\":\"Hello \"}\n\nevent: token\ndata: {\"delta\":\"world!\"}\n\n";
  const res2 = parser.push(chunk2);

  assert.equal(res2.length, 2);
  assert.equal(res2[0].event, "token");
  assert.equal(res2[0].data, '{"delta":"Hello "}');
  assert.equal(res2[1].event, "token");
  assert.equal(res2[1].data, '{"delta":"world!"}');
});

test("SseBufferParser: handles multi-line data according to SSE specification", () => {
  const parser = new SseBufferParser();
  const raw = "event: token\ndata: line 1\ndata: line 2\n\n";
  const msgs = parser.push(raw);

  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].event, "token");
  assert.equal(msgs[0].data, "line 1\nline 2");
});

test("parseSseStream: transforms ReadableStream into typed SseEvents", async () => {
  const encoder = new TextEncoder();
  const text =
    'event: meta\ndata: {"mode":"simple"}\n\n' +
    'event: token\ndata: {"delta":"Photosynthesis"}\n\n' +
    'event: done\ndata: {"grounded":true,"provider":"mock"}\n\n';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  const events: unknown[] = [];
  for await (const evt of parseSseStream(stream)) {
    events.push(evt);
  }

  assert.equal(events.length, 3);
  const typedEvents = events as { event: string; data: Record<string, unknown> }[];
  assert.equal(typedEvents[0].event, "meta");
  assert.equal(typedEvents[0].data.mode, "simple");
  assert.equal(typedEvents[1].event, "token");
  assert.equal(typedEvents[1].data.delta, "Photosynthesis");
  assert.equal(typedEvents[2].event, "done");
  assert.equal(typedEvents[2].data.grounded, true);
});

test("parseSseStream: handles error events cleanly", async () => {
  const encoder = new TextEncoder();
  const text = 'event: error\ndata: {"message":"Rate limit exceeded"}\n\n';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  const events: unknown[] = [];
  for await (const evt of parseSseStream(stream)) {
    events.push(evt);
  }

  assert.equal(events.length, 1);
  const typedEvents = events as { event: string; data: { message: string } }[];
  assert.equal(typedEvents[0].event, "error");
  assert.equal(typedEvents[0].data.message, "Rate limit exceeded");
});
