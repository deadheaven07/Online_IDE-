import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { BufferPosition, ITextBuffer } from '../buffer/types';
import type { LineTokens } from '../worker/types';
import { computeCursorPosition } from './cursorMath';
import type { FontMetrics } from './types';
import { VirtualLineRow } from './VirtualLineRow';
import { computeVisibleLineRange, gutterWidth } from './viewportMath';

const OVERSCAN_LINES = 3;

export interface VirtualRendererProps {
  buffer: ITextBuffer;
  tokens: Map<number, LineTokens>;
  cursor: BufferPosition;
  onCursorChange: (cursor: BufferPosition) => void;
  onRenderTime?: (ms: number) => void;
  fontMetrics: FontMetrics;
}

export function VirtualRenderer({
  buffer,
  tokens,
  cursor,
  onCursorChange,
  onRenderTime,
  fontMetrics,
}: VirtualRendererProps) {
  const { charWidth, lineHeight } = fontMetrics;

  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef(cursor);
  const onRenderTimeRef = useRef(onRenderTime);
  onRenderTimeRef.current = onRenderTime;

  const [lineCount, setLineCount] = useState(buffer.getLineCount());
  const [bufferVersion, setBufferVersion] = useState(buffer.getVersion());
  const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 });

  const gutterW = useMemo(
    () => gutterWidth(lineCount, charWidth),
    [lineCount, charWidth],
  );

  const totalHeight = lineCount * lineHeight;

  cursorPosRef.current = cursor;

  // Re-fetch only the windowed slice — never the full document.
  const visibleLines = useMemo(() => {
    const t0 = performance.now();
    const lines = buffer.getLines({
      startLine: visibleRange.startIndex,
      endLine: visibleRange.endIndex,
    });
    onRenderTimeRef.current?.(performance.now() - t0);
    return lines;
  }, [buffer, visibleRange.startIndex, visibleRange.endIndex, bufferVersion]);

  useEffect(() => {
    return buffer.onChange((snapshot) => {
      setLineCount(snapshot.lineCount);
      setBufferVersion(snapshot.version);
    });
  }, [buffer]);

  // rAF loop reads scrollTop directly from the DOM — no onScroll → setState path.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId = 0;
    let lastStart = -1;
    let lastEnd = -1;

    const tick = () => {
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;
      const viewportHeight = container.clientHeight;
      const total = buffer.getLineCount();

      const { startIndex, endIndex } = computeVisibleLineRange(
        scrollTop,
        viewportHeight,
        lineHeight,
        total,
        OVERSCAN_LINES,
      );

      if (startIndex !== lastStart || endIndex !== lastEnd) {
        lastStart = startIndex;
        lastEnd = endIndex;
        setVisibleRange({ startIndex, endIndex });
      }

      const cursorEl = cursorRef.current;
      if (cursorEl) {
        const pos = computeCursorPosition(
          cursorPosRef.current,
          charWidth,
          lineHeight,
          scrollTop,
          scrollLeft,
          gutterW,
        );
        cursorEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        cursorEl.style.height = `${pos.height}px`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [buffer, charWidth, lineHeight, gutterW]);

  const clampCursor = useCallback(
    (pos: BufferPosition): BufferPosition => {
      const line = Math.max(0, Math.min(pos.line, buffer.getLineCount() - 1));
      const lineLen = buffer.getLine(line).length;
      const column = Math.max(0, Math.min(pos.column, lineLen));
      return { line, column };
    },
    [buffer],
  );

  const applyEdit = useCallback(
    (nextCursor: BufferPosition) => {
      onCursorChange(clampCursor(nextCursor));
    },
    [clampCursor, onCursorChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const pos = cursorPosRef.current;
      const offset = buffer.positionToOffset(pos);

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        applyEdit({ line: pos.line - 1, column: pos.column });
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        applyEdit({ line: pos.line + 1, column: pos.column });
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (pos.column > 0) {
          applyEdit({ line: pos.line, column: pos.column - 1 });
        } else if (pos.line > 0) {
          const prevLen = buffer.getLine(pos.line - 1).length;
          applyEdit({ line: pos.line - 1, column: prevLen });
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const lineLen = buffer.getLine(pos.line).length;
        if (pos.column < lineLen) {
          applyEdit({ line: pos.line, column: pos.column + 1 });
        } else if (pos.line < buffer.getLineCount() - 1) {
          applyEdit({ line: pos.line + 1, column: 0 });
        }
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        if (offset > 0) {
          buffer.delete(offset - 1, 1);
          applyEdit(buffer.offsetToPosition(offset - 1));
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        buffer.insert(offset, '\n');
        applyEdit({ line: pos.line + 1, column: 0 });
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        buffer.insert(offset, '  ');
        applyEdit({ line: pos.line, column: pos.column + 2 });
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        buffer.insert(offset, event.key);
        applyEdit(
          event.key === '\n'
            ? { line: pos.line + 1, column: 0 }
            : { line: pos.line, column: pos.column + event.key.length },
        );
      }
    },
    [buffer, applyEdit],
  );

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-editor-bg outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        className="relative font-mono text-[14px] leading-none"
        style={{ height: totalHeight, minWidth: '100%' }}
      >
        {visibleLines.map((line) => (
          <div
            key={line.index}
            className="absolute left-0 flex w-full items-start"
            style={{
              top: line.index * lineHeight,
              height: lineHeight,
              lineHeight: `${lineHeight}px`,
            }}
          >
            <span
              className="shrink-0 select-none pr-3 text-right text-editor-muted"
              style={{ width: gutterW }}
            >
              {line.index + 1}
            </span>
            <span className="whitespace-pre text-editor-text">
              <VirtualLineRow
                text={line.text}
                tokens={tokens.get(line.index) ?? null}
              />
            </span>
          </div>
        ))}

        <div
          ref={cursorRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-0.5 bg-white will-change-transform"
          style={{ width: 2 }}
        />
      </div>
    </div>
  );
}
