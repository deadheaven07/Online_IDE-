import { useEffect, useRef, useState } from 'react';
import type { ITextBuffer } from '@/engine/buffer';
import { WorkerBridge } from '@/engine/worker';
import type { LineTokens, SyntaxHighlightResult } from '@/engine/worker';

interface UseSyntaxHighlightOptions {
  buffer: ITextBuffer | null;
  language?: string;
  debounceMs?: number;
}

interface UseSyntaxHighlightResult {
  tokens: Map<number, LineTokens>;
  lastTokenizeMs: number;
}

/**
 * Thin React adapter over WorkerBridge.
 * Keeps token state in a Map keyed by line index for O(1) viewport lookups.
 */
export function useSyntaxHighlight({
  buffer,
  language = 'typescript',
  debounceMs = 50,
}: UseSyntaxHighlightOptions): UseSyntaxHighlightResult {
  const [tokens, setTokens] = useState<Map<number, LineTokens>>(new Map());
  const [lastTokenizeMs, setLastTokenizeMs] = useState(0);
  const bridgeRef = useRef<WorkerBridge | null>(null);

  useEffect(() => {
    const bridge = new WorkerBridge({
      language,
      debounceMs,
      onTokens: (result: SyntaxHighlightResult) => {
        setTokens((prev) => {
          const next = new Map(prev);
          for (const line of result.lines) {
            next.set(line.lineIndex, line);
          }
          return next;
        });
        setLastTokenizeMs(result.durationMs);
      },
    });

    bridgeRef.current = bridge;

    if (buffer) {
      bridge.attach(buffer);
    }

    return () => {
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, [language, debounceMs]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge || !buffer) return;
    bridge.attach(buffer);
  }, [buffer]);

  return { tokens, lastTokenizeMs };
}
