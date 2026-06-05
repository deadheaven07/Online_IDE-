import type { BufferMutation, BufferSnapshot } from '../buffer/types';

/** Unique id for correlating async worker requests with responses. */
export type WorkerRequestId = string;

// ── Token output ────────────────────────────────────────────────────

/** A colored span within a single line. Offsets are line-local. */
export interface TokenSpan {
  start: number;
  end: number;
  className: string;
}

/** Tokenized result for one visible line. */
export interface LineTokens {
  lineIndex: number;
  spans: TokenSpan[];
}

// ── Main → Worker messages ──────────────────────────────────────────

export interface WorkerInitMessage {
  type: 'init';
  requestId: WorkerRequestId;
  language: string;
}

/** Full-document tokenize (used on cold start or after large paste). */
export interface WorkerTokenizeFullMessage {
  type: 'tokenize-full';
  requestId: WorkerRequestId;
  text: string;
  snapshot: BufferSnapshot;
}

/** Incremental tokenize from a set of buffer mutations. */
export interface WorkerTokenizeDiffMessage {
  type: 'tokenize-diff';
  requestId: WorkerRequestId;
  mutations: BufferMutation[];
  snapshot: BufferSnapshot;
  /** Full text fallback when diff coalescing isn't worth it. */
  text: string;
}

export type WorkerInboundMessage =
  | WorkerInitMessage
  | WorkerTokenizeFullMessage
  | WorkerTokenizeDiffMessage;

// ── Worker → Main messages ──────────────────────────────────────────

export interface WorkerReadyMessage {
  type: 'ready';
}

export interface WorkerTokensMessage {
  type: 'tokens';
  requestId: WorkerRequestId;
  lines: LineTokens[];
  snapshot: BufferSnapshot;
  /** Worker-side tokenization duration in ms (for status bar). */
  durationMs: number;
}

export interface WorkerErrorMessage {
  type: 'error';
  requestId: WorkerRequestId;
  message: string;
}

export type WorkerOutboundMessage =
  | WorkerReadyMessage
  | WorkerTokensMessage
  | WorkerErrorMessage;

// ── Bridge callbacks ────────────────────────────────────────────────

export interface SyntaxHighlightResult {
  lines: LineTokens[];
  snapshot: BufferSnapshot;
  durationMs: number;
}

export interface WorkerBridgeOptions {
  language?: string;
  /** Debounce window before flushing mutations to the worker. */
  debounceMs?: number;
  /** If accumulated diff exceeds this char count, fall back to full tokenize. */
  diffCoalesceThreshold?: number;
  onTokens?: (result: SyntaxHighlightResult) => void;
  onError?: (error: Error) => void;
}
