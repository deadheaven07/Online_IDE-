import type { BufferLine } from '../buffer/types';
import type { LineTokens } from '../worker/types';

/** Monospace metrics measured once at startup via canvas probe. */
export interface FontMetrics {
  charWidth: number;
  lineHeight: number;
  ascent: number;
  descent: number;
}

/** Describes which lines are mounted in the virtual DOM window. */
export interface ViewportWindow {
  firstVisibleLine: number;
  lastVisibleLine: number;
  visibleLineCount: number;
  scrollTop: number;
}

/** A single absolutely-positioned row in the editor canvas. */
export interface VirtualLineNode {
  line: BufferLine;
  tokens: LineTokens | null;
  top: number;
}

/** Pixel position for the custom cursor div. */
export interface CursorPixelPosition {
  x: number;
  y: number;
  height: number;
}

/** Scroll state managed outside React reconciliation (rAF loop). */
export interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  viewportHeight: number;
  viewportWidth: number;
}

/** Props contract for the virtualized editor canvas (implementation pending). */
export interface EditorCanvasProps {
  lineHeight: number;
  charWidth: number;
  tabSize?: number;
}
