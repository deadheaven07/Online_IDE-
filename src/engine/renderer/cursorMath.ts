import type { BufferPosition } from '../buffer/types';
import type { CursorPixelPosition } from './types';

/**
 * Convert buffer row/col → pixel coordinates inside the scroll container.
 *
 * Document space:  top = row * LINE_HEIGHT, left = col * FONT_WIDTH
 * Viewport space:  subtract scroll offsets so the cursor tracks the content
 *                  while only the visible window is mounted in the DOM.
 */
export function computeCursorPosition(
  cursor: BufferPosition,
  charWidth: number,
  lineHeight: number,
  scrollTop: number,
  scrollLeft: number,
  gutterWidthPx: number,
): CursorPixelPosition {
  return {
    x: gutterWidthPx + cursor.column * charWidth - scrollLeft,
    y: cursor.line * lineHeight - scrollTop,
    height: lineHeight,
  };
}
