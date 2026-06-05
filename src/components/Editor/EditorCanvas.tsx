import { useCallback, useEffect, useRef, useState } from 'react';
import type { BufferPosition } from '@/engine/buffer';
import { TextBuffer } from '@/engine/buffer';
import { measureFontMetrics, VirtualRenderer } from '@/engine/renderer';
import type { FontMetrics } from '@/engine/renderer';
import { useSyntaxHighlight } from '@/hooks/useSyntaxHighlight';

export interface EditorStats {
  row: number;
  col: number;
  renderTimeMs: number;
}

interface EditorCanvasProps {
  onStatsChange?: (stats: EditorStats) => void;
}

function buildSampleDocument(lineCount: number): string {
  let text = '';
  for (let i = 0; i < lineCount; i++) {
    text += `// Line ${i + 1}: export const value_${i} = ${i};\n`;
  }
  return text;
}

export function EditorCanvas({ onStatsChange }: EditorCanvasProps) {
  const bufferRef = useRef<TextBuffer | null>(null);
  if (!bufferRef.current) {
    bufferRef.current = new TextBuffer({
      initialText: buildSampleDocument(10_000),
    });
  }

  const buffer = bufferRef.current;
  const fontMetricsRef = useRef<FontMetrics | null>(null);
  if (!fontMetricsRef.current) {
    fontMetricsRef.current = measureFontMetrics();
  }

  const [cursor, setCursor] = useState<BufferPosition>({ line: 0, column: 0 });
  const { tokens } = useSyntaxHighlight({ buffer });

  const [renderTimeMs, setRenderTimeMs] = useState(0);

  const handleRenderTime = useCallback((ms: number) => {
    setRenderTimeMs(ms);
  }, []);

  const handleCursorChange = useCallback((next: BufferPosition) => {
    setCursor(next);
  }, []);

  useEffect(() => {
    onStatsChange?.({
      row: cursor.line + 1,
      col: cursor.column + 1,
      renderTimeMs,
    });
  }, [cursor, renderTimeMs, onStatsChange]);

  return (
    <VirtualRenderer
      buffer={buffer}
      tokens={tokens}
      cursor={cursor}
      onCursorChange={handleCursorChange}
      onRenderTime={handleRenderTime}
      fontMetrics={fontMetricsRef.current}
    />
  );
}
