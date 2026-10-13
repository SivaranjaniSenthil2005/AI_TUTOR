import {
  ScopeResponse,
  LLMStatusResponse,
  AskRequest,
  AnswerResult,
  SseEvent,
  ApiError,
  SourceCitation,
} from "./types";
import { parseSseStream } from "./sseParser";
import { getTutorReply } from "../tutor/mock";

const DEFAULT_BASE_URL = "http://localhost:8000";

export function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

export function isMockMode(): boolean {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("ai_tutor_use_mock") === "1") {
        return true;
      }
    } catch {}
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCK === "1") {
    return true;
  }
  return false;
}

export const FALLBACK_SCOPE: ScopeResponse = {
  supported_boards: {
    tn: "Tamil Nadu State Board",
    cbse: "CBSE (NCERT)",
  },
  supported_classes: [10],
  supported_subjects: {
    science: "Science",
    social_science: "Social Science",
  },
  medium: "English",
  description: "AI Tutor standard Class 10 Scope (English Medium)",
};

/**
 * Friendly error mapper for students.
 */
export function mapHttpError(status: number, message?: string): ApiError {
  if (status === 429) {
    return new ApiError(
      "rate_limit",
      "The tutor is receiving a lot of questions right now! Please wait a moment and try again.",
      { statusCode: status, retryable: true }
    );
  }
  if (status === 422) {
    return new ApiError(
      "validation",
      "We couldn't quite understand that question format. Could you rephrase it for your Class 10 book?",
      { statusCode: status, retryable: false }
    );
  }
  if (status >= 500) {
    return new ApiError(
      "provider",
      "The AI tutor encountered a brief hiccup while finding your answer. Let's try once more!",
      { statusCode: status, retryable: true }
    );
  }
  return new ApiError(
    "unknown",
    message || "Something went wrong while talking to the tutor. Please try again.",
    { statusCode: status, retryable: true }
  );
}

/**
 * Maps JS network / timeout / abort errors into friendly student errors.
 */
export function mapNetworkError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError("aborted", "Question cancelled.", { retryable: false });
  }

  if (err instanceof DOMException && err.name === "TimeoutError") {
    return new ApiError(
      "timeout",
      "The tutor took a bit too long to answer. Let's try asking again!",
      { retryable: true }
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Load failed")
  ) {
    return new ApiError(
      "unreachable",
      "Cannot connect to the AI Tutor server. Please check if the server is running or switch to Demo mode.",
      { retryable: true, cause: err }
    );
  }

  return new ApiError(
    "unknown",
    "We had trouble connecting. Let's give it another shot!",
    { retryable: true, cause: err }
  );
}

/**
 * Fetch supported curriculum scope from backend.
 */
export async function getScope(signal?: AbortSignal): Promise<ScopeResponse> {
  if (isMockMode()) {
    return FALLBACK_SCOPE;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/scope`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      throw mapHttpError(res.status);
    }
    return (await res.json()) as ScopeResponse;
  } catch (err) {
    // If backend unreachable and in dev, gracefully fallback to scope
    if (err instanceof ApiError) throw err;
    return FALLBACK_SCOPE;
  }
}

/**
 * Fetch LLM providers status and circuit breaker state.
 */
export async function getLLMStatus(signal?: AbortSignal): Promise<LLMStatusResponse> {
  if (isMockMode()) {
    return {
      enabled_providers: ["mock"],
      provider_chain: ["mock"],
      circuit_breakers: {
        mock: { state: "CLOSED", failure_count: 0, cooldown_remaining_sec: 0 },
      },
      models: { mock: "offline-mock-tutor" },
    };
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/llm/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });

    if (!res.ok) {
      throw mapHttpError(res.status);
    }
    return (await res.json()) as LLMStatusResponse;
  } catch (err) {
    throw mapNetworkError(err);
  }
}

/**
 * Non-streaming POST /api/ask
 */
export async function askQuestion(
  request: AskRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<AnswerResult> {
  if (isMockMode()) {
    const replyText = await getTutorReply(request.question, {
      board: request.board,
      className: "Class 10",
      subject: request.subject,
    });
    return {
      answer: replyText,
      sources: [
        {
          citation_index: 1,
          chunk_id: "mock_c1",
          book_title: `${request.board.toUpperCase()} Class 10 ${request.subject}`,
          chapter_no: request.chapter_no ?? 1,
          chapter_title: "Key Concepts & Fundamentals",
          page_start: 12,
          page_end: 14,
          source_file: "textbook_ch1.pdf",
          text_snippet: replyText.slice(0, 150),
        },
      ],
      grounded: true,
      provider: "mock",
      model: "canned-mock-v1",
      latency_ms: { total: 450 },
      mock: true,
      rewritten_query: request.question,
      rewrite_used: false,
      mode: request.mode || "simple",
      learning_mode: request.learning_mode || request.mode || "simple",
      speech_text: replyText.replace(/\[\d+\]/g, ""),
      suggested_questions: [
        "Can you explain this with a real-life example?",
        "What questions about this appear in exams?",
        "Could you break this down step by step?",
      ],
    };
  }

  const timeoutMs = options?.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw mapHttpError(res.status);
    }
    return (await res.json()) as AnswerResult;
  } catch (err) {
    clearTimeout(timeoutId);
    throw mapNetworkError(err);
  }
}

/**
 * Streaming POST /api/ask/stream with SSE.
 * Yields parsed SSE events: meta, sources, token, done, error.
 */
export async function* streamAskQuestion(
  request: AskRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): AsyncGenerator<SseEvent, void, unknown> {
  if (isMockMode()) {
    yield* mockStreamResponse(request, options?.signal);
    return;
  }

  const timeoutMs = options?.timeoutMs ?? 45000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw mapNetworkError(err);
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  if (!response.body) {
    throw new ApiError("unknown", "No response received from tutor server.");
  }

  try {
    for await (const event of parseSseStream(response.body)) {
      yield event;
    }
  } catch (err) {
    throw mapNetworkError(err);
  }
}

/**
 * Simulates a realistic SSE stream for offline / demo mode.
 */
async function* mockStreamResponse(
  request: AskRequest,
  signal?: AbortSignal
): AsyncGenerator<SseEvent, void, unknown> {
  const checkAbort = () => {
    if (signal?.aborted) {
      throw new ApiError("aborted", "Question cancelled.");
    }
  };

  checkAbort();

  // 1. Meta event
  yield {
    event: "meta",
    data: {
      rewritten_query: request.question,
      rewrite_used: false,
      learning_mode: request.learning_mode || request.mode || "simple",
      mode: request.mode || "simple",
      topic_hint: `${request.board.toUpperCase()} Class 10 ${request.subject}`,
    },
  };

  await new Promise((r) => setTimeout(r, 120));
  checkAbort();

  // 2. Sources event
  const mockSources: SourceCitation[] = [
    {
      citation_index: 1,
      chunk_id: "mock_source_1",
      book_title: `${request.board.toUpperCase()} Class 10 ${request.subject}`,
      chapter_no: request.chapter_no ?? 1,
      chapter_title: "Chapter Overview & Essential Concepts",
      section_title: "Core Principles",
      page_start: 10,
      page_end: 15,
      source_file: "textbook.pdf",
      text_snippet: `Class 10 ${request.subject} textbook foundational concepts for examination and learning.`,
    },
  ];

  yield {
    event: "sources",
    data: {
      sources: mockSources,
      total_retrieved: 1,
    },
  };

  // 3. Tokens streaming
  const replyText = await getTutorReply(request.question, {
    board: request.board,
    className: "Class 10",
    subject: request.subject,
  });

  const words = replyText.split(/(\s+)/);
  for (const word of words) {
    checkAbort();
    yield {
      event: "token",
      data: { delta: word },
    };
    await new Promise((r) => setTimeout(r, 25));
  }

  checkAbort();

  // 4. Done event
  yield {
    event: "done",
    data: {
      sources: mockSources,
      grounded: true,
      provider: "mock",
      model: "canned-mock-v1",
      mock: true,
      speech_text: replyText.replace(/\[\d+\]/g, ""),
      suggested_questions: [
        "Can you explain this with a real-life example?",
        "What questions about this appear in exams?",
        "Could you break this down step by step?",
      ],
      topic_hint: `${request.board.toUpperCase()} Class 10 ${request.subject}`,
      latency_ms: { total: 600, generation: 500, retrieval: 100 },
    },
  };
}
