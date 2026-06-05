import type { ViewportWindow } from './types';

export interface VisibleLineRange {
  startIndex: number;
  endIndex: number;
}

/**
 * Map scroll pixels → line indices.
 *
 * firstVisible = floor(scrollTop / lineHeight) tells us which row sits
 * at the top edge. We add overscan rows above and below so fast flick
 * scroll doesn't flash empty space before React catches up.
 */
export function computeVisibleLineRange(
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  totalLines: number,
  overscan = 3,
): VisibleLineRange {
  if (totalLines <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const firstVisible = Math.floor(scrollTop / lineHeight);
  const visibleCount = Math.ceil(viewportHeight / lineHeight) + 1;

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(
    totalLines - 1,
    firstVisible + visibleCount + overscan,
  );

  return { startIndex, endIndex };
}

export function computeViewportWindow(
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  totalLines: number,
  overscan = 3,
): ViewportWindow {
  const { startIndex, endIndex } = computeVisibleLineRange(
    scrollTop,
    viewportHeight,
    lineHeight,
    totalLines,
    overscan,
  );

  return {
    firstVisibleLine: startIndex,
    lastVisibleLine: endIndex,
    visibleLineCount: endIndex - startIndex + 1,
    scrollTop,
  };
}

export function gutterWidth(lineCount: number, charWidth: number): number {
  const digits = Math.max(1, String(lineCount).length);
  return (digits + 2) * charWidth;
}
