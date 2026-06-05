/**
 * Core types for the text document model.
 *
 * The buffer is addressed two ways:
 *   - absolute offset (flat index into the character stream)
 *   - line/column (what the renderer and cursor use)
 *
 * Mutations are recorded so the syntax worker can apply incremental diffs
 * instead of re-tokenizing the entire document on every keystroke.
 */

/** Zero-based line/column position in the document. */
export interface BufferPosition {
  line: number;
  column: number;
}

/** Flat character index from the start of the document. */
export type BufferOffset = number;

/** A single exported line for the virtualized renderer. */
export interface BufferLine {
  /** Zero-based line index. */
  index: number;
  /** Line content without the trailing newline character. */
  text: string;
  /** Absolute offset where this line begins in the buffer. */
  startOffset: BufferOffset;
  /** Character length of `text` (excludes `\n`). */
  length: number;
}

/** Describes a single buffer mutation for incremental worker sync. */
export interface BufferMutation {
  type: 'insert' | 'delete';
  /** Absolute offset where the mutation begins. */
  offset: BufferOffset;
  /** Deleted character count (0 for pure inserts). */
  deletedLength: number;
  /** Inserted text (empty string for pure deletes). */
  insertedText: string;
  /** Monotonic version stamped at mutation time. */
  version: number;
}

/** Lightweight snapshot the renderer/worker can compare for staleness. */
export interface BufferSnapshot {
  version: number;
  totalLength: number;
  lineCount: number;
}

/** Range of lines to fetch for viewport virtualization. */
export interface LineRange {
  startLine: number;
  endLine: number;
}

/**
 * Public contract for the text buffer.
 *
 * Implementations must guarantee O(1) insert/delete at the cursor gap
 * and O(k) line export where k is the number of lines requested.
 */
export interface ITextBuffer {
  /** Insert text at an absolute offset. */
  insert(offset: BufferOffset, text: string): void;

  /** Delete `length` characters starting at `offset`. */
  delete(offset: BufferOffset, length: number): void;

  /** Total character count (newlines included). */
  getLength(): number;

  /** Number of lines (always >= 1 for a non-empty doc). */
  getLineCount(): number;

  /** Read a contiguous slice of the document as a single string. */
  getText(start?: BufferOffset, end?: BufferOffset): string;

  /** Fetch one line by index. Returns '' for out-of-range indices. */
  getLine(lineIndex: number): string;

  /** Export a line range for the virtualized renderer. */
  getLines(range: LineRange): BufferLine[];

  /** Convert absolute offset to line/column. */
  offsetToPosition(offset: BufferOffset): BufferPosition;

  /** Convert line/column to absolute offset. */
  positionToOffset(position: BufferPosition): BufferOffset;

  /** Current monotonic version (increments on every mutation). */
  getVersion(): number;

  /** Immutable snapshot for worker/renderer staleness checks. */
  getSnapshot(): BufferSnapshot;

  /**
   * Mutations recorded since `sinceVersion` (exclusive).
   * Used to build debounced diffs for the syntax worker.
   */
  getMutationsSince(sinceVersion: number): BufferMutation[];

  /** Subscribe to buffer changes. Returns an unsubscribe function. */
  onChange(listener: (snapshot: BufferSnapshot) => void): () => void;
}

/** Configuration passed when constructing a TextBuffer. */
export interface TextBufferOptions {
  initialText?: string;
  /** Max mutations retained in the ring buffer for worker diffs. */
  mutationHistoryLimit?: number;
}
