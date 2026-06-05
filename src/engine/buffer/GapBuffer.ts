const INITIAL_CAPACITY = 4096;
const GROWTH_FACTOR = 2;

/**
 * Low-level gap buffer over a pre-allocated char array.
 *
 * Logical layout:  [0 .. gapStart)  |  GAP  |  [gapEnd .. capacity)
 * The gap slides to the mutation point so insert/delete touch only gap boundaries.
 */
export class GapBuffer {
  private buffer: string[];
  private gapStart: number;
  private gapEnd: number;

  constructor(capacity: number = INITIAL_CAPACITY) {
    this.buffer = new Array(capacity);
    this.gapStart = 0;
    this.gapEnd = capacity;
  }

  get length(): number {
    return this.gapStart + (this.buffer.length - this.gapEnd);
  }

  insert(logicalOffset: number, text: string): void {
    if (text.length === 0) return;

    this.moveGap(logicalOffset);
    this.ensureGapSpace(text.length);

    for (let i = 0; i < text.length; i++) {
      this.buffer[this.gapStart++] = text[i]!;
    }
  }

  delete(logicalOffset: number, deleteLength: number): void {
    if (deleteLength === 0) return;

    const len = this.length;
    if (logicalOffset < 0 || logicalOffset > len) {
      throw new RangeError(`delete offset ${logicalOffset} out of range [0, ${len}]`);
    }

    const clamped = Math.min(deleteLength, len - logicalOffset);
    this.moveGap(logicalOffset);
    this.gapEnd += clamped;
  }

  charAt(logicalOffset: number): string {
    if (logicalOffset < this.gapStart) {
      return this.buffer[logicalOffset] ?? '';
    }
    const physical = this.gapEnd + (logicalOffset - this.gapStart);
    return this.buffer[physical] ?? '';
  }

  slice(start: number, end: number): string {
    if (start >= end) return '';

    let out = '';
    for (let i = start; i < end; i++) {
      out += this.charAt(i);
    }
    return out;
  }

  toString(): string {
    return this.slice(0, this.length);
  }

  /**
   * Slide the gap so logical offset == gapStart.
   *
   * Moving left copies [target, gapStart) into the right end of the gap.
   * Moving right pulls [gapStart, target) out of the post-gap segment.
   * Cost is proportional to distance traveled, not total document size —
   * sequential typing at the cursor is effectively free.
   */
  moveGap(target: number): void {
    if (target === this.gapStart) return;

    if (target < 0 || target > this.length) {
      throw new RangeError(`moveGap target ${target} out of range [0, ${this.length}]`);
    }

    if (target < this.gapStart) {
      const distance = this.gapStart - target;
      for (let i = 0; i < distance; i++) {
        this.buffer[this.gapEnd - distance + i] = this.buffer[target + i]!;
      }
      this.gapStart = target;
      this.gapEnd -= distance;
    } else {
      const distance = target - this.gapStart;
      for (let i = 0; i < distance; i++) {
        this.buffer[this.gapStart + i] = this.buffer[this.gapEnd + i]!;
      }
      this.gapStart = target;
      this.gapEnd += distance;
    }
  }

  /**
   * Grow only when the gap cannot absorb the incoming write.
   * Reallocation is O(n), but amortized rare if we double capacity.
   */
  private ensureGapSpace(needed: number): void {
    const gapSize = this.gapEnd - this.gapStart;
    if (gapSize >= needed) return;
    this.grow(needed - gapSize);
  }

  private grow(minExtra: number): void {
    const oldCapacity = this.buffer.length;
    const rightSegmentLen = oldCapacity - this.gapEnd;
    const newCapacity = Math.max(
      oldCapacity * GROWTH_FACTOR,
      oldCapacity + minExtra + INITIAL_CAPACITY,
    );

    const newBuffer = new Array<string>(newCapacity);
    const newGapEnd = newCapacity - rightSegmentLen;

    for (let i = 0; i < this.gapStart; i++) {
      newBuffer[i] = this.buffer[i]!;
    }

    for (let i = 0; i < rightSegmentLen; i++) {
      newBuffer[newGapEnd + i] = this.buffer[this.gapEnd + i]!;
    }

    this.buffer = newBuffer;
    this.gapEnd = newGapEnd;
  }
}
