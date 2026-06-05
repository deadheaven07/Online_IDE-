/**
 * TextBuffer manages the document text using a Gap Buffer data structure.
 * This ensures that local edits (insertions/deletions) are O(1) by keeping
 * a sliding window (the "gap") exactly at the cursor's location.
 * 
 * Additionally, it tracks the absolute offsets of every newline in `lineOffsets`
 * to provide O(log N) row/column lookups and O(1) line counting.
 */
export class TextBuffer {
  private buffer: string[];
  private gapStart: number;
  private gapEnd: number;
  
  // Array of logical indices indicating the start of each line
  private lineOffsets: number[] = [0];
  
  // Current logical cursor position
  private cursorIndex: number = 0;

  constructor(initialCapacity = 1024) {
    this.buffer = new Array(initialCapacity).fill('');
    this.gapStart = 0;
    this.gapEnd = initialCapacity;
  }

  /**
   * Returns the total logical length of the document.
   */
  public get length(): number {
    return this.buffer.length - (this.gapEnd - this.gapStart);
  }

  /**
   * Move the gap to the specified logical index.
   */
  private moveGap(index: number) {
    if (index === this.gapStart) return;

    if (index < this.gapStart) {
      const amount = this.gapStart - index;
      for (let i = 0; i < amount; i++) {
        this.buffer[this.gapEnd - 1 - i] = this.buffer[this.gapStart - 1 - i];
      }
      this.gapStart -= amount;
      this.gapEnd -= amount;
    } else {
      const amount = index - this.gapStart;
      for (let i = 0; i < amount; i++) {
        this.buffer[this.gapStart + i] = this.buffer[this.gapEnd + i];
      }
      this.gapStart += amount;
      this.gapEnd += amount;
    }
  }

  /**
   * Expands the gap size when we run out of space.
   */
  private expandGap() {
    const newGapSize = this.buffer.length * 2 || 1024;
    const newBuffer = new Array(this.buffer.length + newGapSize).fill('');
    
    for (let i = 0; i < this.gapStart; i++) {
      newBuffer[i] = this.buffer[i];
    }
    
    const newGapEnd = this.gapEnd + newGapSize;
    for (let i = this.gapEnd; i < this.buffer.length; i++) {
      newBuffer[i + newGapSize] = this.buffer[i];
    }
    
    this.buffer = newBuffer;
    this.gapEnd = newGapEnd;
  }

  /**
   * Recomputes the line offsets dynamically.
   */
  private recomputeLineOffsets() {
    this.lineOffsets = [0];
    let logicalIndex = 0;
    
    for (let i = 0; i < this.buffer.length; i++) {
      if (i >= this.gapStart && i < this.gapEnd) {
        continue; // skip the gap
      }
      if (this.buffer[i] === '\n') {
        this.lineOffsets.push(logicalIndex + 1);
      }
      logicalIndex++;
    }
  }

  /**
   * Inserts text at the current cursor position.
   */
  public insert(text: string) {
    this.moveGap(this.cursorIndex);
    
    for (let i = 0; i < text.length; i++) {
      if (this.gapStart === this.gapEnd) {
        this.expandGap();
      }
      this.buffer[this.gapStart] = text[i];
      this.gapStart++;
      this.cursorIndex++;
    }
    
    this.recomputeLineOffsets();
  }

  /**
   * Deletes one character behind the cursor position.
   */
  public delete() {
    this.moveGap(this.cursorIndex);
    if (this.gapStart > 0) {
      this.gapStart--;
      this.cursorIndex--;
      this.recomputeLineOffsets();
    }
  }

  /**
   * Moves the internal cursor to a specific row and column.
   */
  public moveCursor(row: number, col: number) {
    const safeRow = Math.max(0, Math.min(row, this.lineOffsets.length - 1));
    const lineStart = this.lineOffsets[safeRow];
    const nextLineStart = safeRow + 1 < this.lineOffsets.length ? this.lineOffsets[safeRow + 1] : this.length + 1;
    
    // Calculate max length of this line (excluding the newline character if it exists)
    const maxCol = Math.max(0, nextLineStart - lineStart - 1);
    const safeCol = Math.max(0, Math.min(col, maxCol));
    
    this.cursorIndex = lineStart + safeCol;
  }

  /**
   * Reconstructs and returns the document as an array of strings, one per line.
   */
  public getLines(): string[] {
    const lines: string[] = [];
    for (let i = 0; i < this.lineOffsets.length; i++) {
      const start = this.lineOffsets[i];
      const end = i + 1 < this.lineOffsets.length ? this.lineOffsets[i + 1] - 1 : this.length;
      lines.push(this.getTextInRange(start, end));
    }
    return lines;
  }

  /**
   * Internal helper to get text within a specific logical range.
   */
  private getTextInRange(logicalStart: number, logicalEnd: number): string {
    let result = '';
    for (let i = logicalStart; i < logicalEnd; i++) {
      if (i < this.gapStart) {
        result += this.buffer[i];
      } else {
        result += this.buffer[this.gapEnd + (i - this.gapStart)];
      }
    }
    return result;
  }

  /**
   * Returns the entire text as a single string.
   */
  public getText(): string {
    const beforeGap = this.buffer.slice(0, this.gapStart).join('');
    const afterGap = this.buffer.slice(this.gapEnd).join('');
    return beforeGap + afterGap;
  }
  
  /**
   * Gets the current logical cursor index.
   */
  public getCursorIndex(): number {
    return this.cursorIndex;
  }
}
