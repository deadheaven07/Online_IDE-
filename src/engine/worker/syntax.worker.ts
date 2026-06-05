/// <reference lib="webworker" />

import type {
  LineTokens,
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkerTokenizeDiffMessage,
  WorkerTokenizeFullMessage,
} from './types';

let activeLanguage = 'typescript';

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      activeLanguage = message.language;
      post({ type: 'ready' });
      break;

    case 'tokenize-full':
      handleTokenizeFull(message);
      break;

    case 'tokenize-diff':
      handleTokenizeDiff(message);
      break;
  }
};

function handleTokenizeFull(message: WorkerTokenizeFullMessage): void {
  const start = performance.now();
  const lines = tokenizeDocument(message.text, activeLanguage);

  post({
    type: 'tokens',
    requestId: message.requestId,
    lines,
    snapshot: message.snapshot,
    durationMs: performance.now() - start,
  });
}

function handleTokenizeDiff(message: WorkerTokenizeDiffMessage): void {
  const start = performance.now();

  // Diff-aware tokenizer lands in a later step; full re-scan for now.
  const lines = tokenizeDocument(message.text, activeLanguage);

  post({
    type: 'tokens',
    requestId: message.requestId,
    lines,
    snapshot: message.snapshot,
    durationMs: performance.now() - start,
  });
}

/**
 * Placeholder lexer — returns unstyled spans so the pipeline can be
 * wired up before we implement a real tokenizer.
 */
function tokenizeDocument(text: string, _language: string): LineTokens[] {
  const rawLines = text.split('\n');

  return rawLines.map((line, lineIndex) => ({
    lineIndex,
    spans: [{ start: 0, end: line.length, className: 'token-plain' }],
  }));
}

function post(message: WorkerOutboundMessage): void {
  self.postMessage(message);
}
