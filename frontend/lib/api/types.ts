/**
 * TypeScript schemas mirroring backend Pydantic models for AI Tutor.
 */

export interface ScopeResponse {
  supported_boards: Record<string, string>;
  supported_classes: number[];
  supported_subjects: Record<string, string>;
  medium: string;
  description: string;
}

export interface CircuitBreakerStatus {
  state: "CLOSED" | "OPEN" | "HALF_OPEN" | string;
  failure_count: number;
  cooldown_remaining_sec: number;
}

export interface LLMStatusResponse {
  enabled_providers: string[];
  provider_chain: string[];
  circuit_breakers: Record<string, CircuitBreakerStatus>;
  models: Record<string, string>;
}

export interface Turn {
  role: "student" | "tutor";
  text: string;
}

export interface LearnerProfile {
  reading_level: "easy" | "standard";
  max_sentences: number;
  avoid_figurative_language: boolean;
  repeat_key_term: boolean;
}

export interface AskRequest {
  question: string;
  board: string;
  subject: string;
  chapter_no?: number | null;
  active_chapter_no?: number | null;
  class_level?: number;
  mode?: string;
  learning_mode?: string;
  retrieval_mode?: string;
  learner_profile?: LearnerProfile | null;
  history?: Turn[];
}

export interface SourceCitation {
  citation_index: number;
  chunk_id: string;
  book_title: string;
  chapter_no?: number | null;
  chapter_title: string;
  section_title?: string | null;
  page_start: number;
  page_end: number;
  source_file: string;
  text_snippet: string;
}

export interface AnswerLatency {
  rewriting?: number;
  expansion?: number;
  retrieval?: number;
  generation?: number;
  total: number;
}

export interface AnswerResult {
  answer: string;
  sources: SourceCitation[];
  grounded: boolean;
  provider: string;
  model: string;
  latency_ms: AnswerLatency;
  usage?: Record<string, unknown>;
  mock: boolean;
  rewritten_query?: string | null;
  rewrite_used: boolean;
  mode: string;
  learning_mode: string;
  topic_hint?: string | null;
  speech_text: string;
  suggested_questions: string[];
  retrieval_debug?: Record<string, unknown> | null;
}

// SSE Event Payloads
export interface StreamMetaEvent {
  rewritten_query?: string | null;
  rewrite_used: boolean;
  learning_mode: string;
  mode: string;
  topic_hint?: string | null;
}

export interface StreamSourcesEvent {
  sources: SourceCitation[];
  total_retrieved: number;
}

export interface StreamTokenEvent {
  delta: string;
}

export interface StreamDoneEvent {
  sources: SourceCitation[];
  grounded: boolean;
  provider: string;
  model: string;
  mock: boolean;
  speech_text: string;
  suggested_questions: string[];
  topic_hint?: string | null;
  latency_ms: AnswerLatency;
}

export interface StreamErrorEvent {
  message: string;
}

export type SseEvent =
  | { event: "meta"; data: StreamMetaEvent }
  | { event: "sources"; data: StreamSourcesEvent }
  | { event: "token"; data: StreamTokenEvent }
  | { event: "done"; data: StreamDoneEvent }
  | { event: "error"; data: StreamErrorEvent };

// Typed Student-Friendly Errors
export type ApiErrorType =
  | "unreachable"
  | "rate_limit"
  | "validation"
  | "timeout"
  | "provider"
  | "aborted"
  | "unknown";

export class ApiError extends Error {
  public type: ApiErrorType;
  public studentMessage: string;
  public statusCode?: number;
  public retryable: boolean;

  constructor(
    type: ApiErrorType,
    studentMessage: string,
    options?: { statusCode?: number; retryable?: boolean; cause?: unknown }
  ) {
    super(studentMessage);
    this.name = "ApiError";
    this.type = type;
    this.studentMessage = studentMessage;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? true;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
