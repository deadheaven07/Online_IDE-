import { GapBuffer } from './GapBuffer';
import type {
  BufferLine,
  BufferMutation,
  BufferOffset,
  BufferPosition,
  BufferSnapshot,
  ITextBuffer,
  LineRange,
  TextBufferOptions,
} from './types';

/**
 * Document model: gap buffer for O(1) mutations + lineStarts for O(log L) line lookup.
 */
export class TextBuffer implements ITextBuffer {
  private readonly gap: GapBuffer;
  private readonly mutationHistoryLimit: number;

  private version = 0;
  private mutationLog: BufferMutation[] = [];
  private changeListeners = new Set<(snapshot: BufferSnapshot) => void>();

  // Absolute offsets where each line begins. lineStarts[i] is the first char of line i.
  private lineStarts: number[] = [0];

  constructor(options: TextBufferOptions = {}) {
    this.mutationHistoryLimit = options.mutationHistoryLimit ?? 512;
    this.gap = new GapBuffer();

    if (options.initialText) {
      this.insert(0, options.initialText);
    }
  }

  insert(offset: BufferOffset, text: string): void {
    if (text.length === 0) return;
    this.assertOffset(offset, 'insert');

    this.gap.insert(offset, text);
    this.applyLineStartsOnInsert(offset, text);

    this.recordMutation({
      type: 'insert',
      offset,
      deletedLength: 0,
      insertedText: text,
    });
  }

  delete(offset: BufferOffset, length: number): void {
    if (length === 0) return;
    this.assertOffset(offset, 'delete');

    const clamped = Math.min(length, this.getLength() - offset);
    const removed = this.gap.slice(offset, offset + clamped);

    this.gap.delete(offset, clamped);
    this.applyLineStartsOnDelete(offset, clamped);

    this.recordMutation({
      type: 'delete',
      offset,
      deletedLength: clamped,
      insertedText: removed,
    });
  }

  getLength(): number {
    return this.gap.length;
  }

  getLineCount(): number {
    return this.lineStarts.length;
  }

  getText(start = 0, end = this.getLength()): string {
    const clampedStart = Math.max(0, Math.min(start, this.getLength()));
    const clampedEnd = Math.max(clampedStart, Math.min(end, this.getLength()));
    return this.gap.slice(clampedStart, clampedEnd);
  }

  getLine(lineIndex: number): string {
    if (lineIndex < 0 || lineIndex >= this.lineStarts.length) return '';

    const start = this.lineStarts[lineIndex]!;
    const end =
      lineIndex + 1 < this.lineStarts.length
        ? this.lineStarts[lineIndex + 1]!
        : this.getLength();

    const raw = this.gap.slice(start, end);
    return raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  }

  getLines(range: LineRange): BufferLine[] {
    const startLine = Math.max(0, range.startLine);
    const endLine = Math.min(range.endLine, this.lineStarts.length - 1);
    if (startLine > endLine) return [];

    const lines: BufferLine[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const text = this.getLine(i);
      lines.push({
        index: i,
        text,
        startOffset: this.lineStarts[i]!,
        length: text.length,
      });
    }
    return lines;
  }

  offsetToPosition(offset: BufferOffset): BufferPosition {
    const clamped = Math.max(0, Math.min(offset, this.getLength()));
    const line = this.lineIndexAt(clamped);
    return { line, column: clamped - this.lineStarts[line]! };
  }

  positionToOffset(position: BufferPosition): BufferOffset {
    const line = Math.max(0, Math.min(position.line, this.lineStarts.length - 1));
    const lineStart = this.lineStarts[line]!;
    const lineEnd =
      line + 1 < this.lineStarts.length
        ? this.lineStarts[line + 1]!
        : this.getLength();

    const column = Math.max(0, Math.min(position.column, lineEnd - lineStart));
    return lineStart + column;
  }

  getVersion(): number {
    return this.version;
  }

  getSnapshot(): BufferSnapshot {
    return {
      version: this.version,
      totalLength: this.getLength(),
      lineCount: this.getLineCount(),
    };
  }

  getMutationsSince(sinceVersion: number): BufferMutation[] {
    return this.mutationLog.filter((m) => m.version > sinceVersion);
  }

  onChange(listener: (snapshot: BufferSnapshot) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  // ── Line index maintenance ──────────────────────────────────────────

  /**
   * Largest line index whose start offset is <= offset.
   * Binary search gives O(log L) — no scanning the gap to find line 500.
   */
  private lineIndexAt(offset: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (this.lineStarts[mid]! <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    return lo;
  }

  private applyLineStartsOnInsert(offset: number, text: string): void {
    const delta = text.length;
    const newStarts: number[] = [];

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        newStarts.push(offset + i + 1);
      }
    }

    // Existing boundaries past the insertion point slide right.
    for (let i = 0; i < this.lineStarts.length; i++) {
      if (this.lineStarts[i]! > offset) {
        this.lineStarts[i]! += delta;
      }
    }

    if (newStarts.length === 0) return;

    const lineIdx = this.lineIndexAt(offset);
    this.lineStarts.splice(lineIdx + 1, 0, ...newStarts);
  }

  private applyLineStartsOnDelete(offset: number, length: number): void {
    const end = offset + length;
    const delta = -length;

    // Any line start that landed inside the deleted span is gone.
    this.lineStarts = this.lineStarts.filter((start) => start < offset || start >= end);

    for (let i = 0; i < this.lineStarts.length; i++) {
      if (this.lineStarts[i]! >= end) {
        this.lineStarts[i]! += delta;
      }
    }

    if (this.lineStarts.length === 0) {
      this.lineStarts = [0];
    }
  }

  // ── Mutation log ────────────────────────────────────────────────────

  private recordMutation(mutation: Omit<BufferMutation, 'version'>): void {
    this.version += 1;

    const entry: BufferMutation = { ...mutation, version: this.version };
    this.mutationLog.push(entry);

    if (this.mutationLog.length > this.mutationHistoryLimit) {
      this.mutationLog.splice(
        0,
        this.mutationLog.length - this.mutationHistoryLimit,
      );
    }

    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.changeListeners) {
      listener(snapshot);
    }
  }

  private assertOffset(offset: number, op: string): void {
    const len = this.getLength();
    if (offset < 0 || offset > len) {
      throw new RangeError(`${op} offset ${offset} out of range [0, ${len}]`);
    }
  }
}
