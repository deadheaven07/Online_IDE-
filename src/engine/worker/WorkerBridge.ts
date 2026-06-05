import type { ITextBuffer } from '../buffer/types';
import type {
  SyntaxHighlightResult,
  WorkerBridgeOptions,
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkerRequestId,
} from './types';

import SyntaxWorker from './syntax.worker?worker';

/**
 * Main-thread facade for syntax highlighting.
 *
 * Owns the Worker lifecycle, debounces mutation flushes, and correlates
 * async responses so stale token results never overwrite fresh ones.
 */
export class WorkerBridge {
  private worker: Worker;
  private buffer: ITextBuffer | null = null;

  private readonly language: string;
  private readonly debounceMs: number;
  private readonly diffCoalesceThreshold: number;
  private readonly onTokens?: (result: SyntaxHighlightResult) => void;
  private readonly onError?: (error: Error) => void;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedVersion = 0;
  private pendingRequestId: WorkerRequestId | null = null;
  private requestCounter = 0;
  private disposed = false;

  constructor(options: WorkerBridgeOptions = {}) {
    this.language = options.language ?? 'typescript';
    this.debounceMs = options.debounceMs ?? 50;
    this.diffCoalesceThreshold = options.diffCoalesceThreshold ?? 2048;
    this.onTokens = options.onTokens;
    this.onError = options.onError;

    this.worker = new SyntaxWorker();
    this.worker.onmessage = this.handleWorkerMessage;
    this.worker.onerror = (event) => {
      this.onError?.(new Error(event.message));
    };

    this.send({ type: 'init', requestId: this.nextRequestId(), language: this.language });
  }

  /** Bind a TextBuffer and start listening for mutations. */
  attach(buffer: ITextBuffer): void {
    this.detach();
    this.buffer = buffer;
    this.lastSyncedVersion = buffer.getVersion();
    buffer.onChange(() => this.scheduleSync());
  }

  detach(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.buffer = null;
  }

  /** Force an immediate sync (e.g. after viewport scroll stabilizes). */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.syncToWorker();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    this.worker.terminate();
  }

  // ── Private ───────────────────────────────────────────────────────

  private scheduleSync(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.syncToWorker();
    }, this.debounceMs);
  }

  private syncToWorker(): void {
    if (!this.buffer || this.disposed) return;

    const snapshot = this.buffer.getSnapshot();
    const mutations = this.buffer.getMutationsSince(this.lastSyncedVersion);

    if (mutations.length === 0) return;

    const requestId = this.nextRequestId();
    this.pendingRequestId = requestId;
    this.lastSyncedVersion = snapshot.version;

    const diffCharCount = mutations.reduce(
      (sum, m) => sum + m.deletedLength + m.insertedText.length,
      0,
    );

    const text = this.buffer.getText();
    const message: WorkerInboundMessage =
      diffCharCount > this.diffCoalesceThreshold
        ? { type: 'tokenize-full', requestId, text, snapshot }
        : { type: 'tokenize-diff', requestId, mutations, snapshot, text };

    this.send(message);
  }

  private handleWorkerMessage = (event: MessageEvent<WorkerOutboundMessage>): void => {
    const message = event.data;

    switch (message.type) {
      case 'ready':
        break;

      case 'tokens':
        // Drop stale responses — user may have typed ahead
        if (message.requestId !== this.pendingRequestId) return;

        this.pendingRequestId = null;
        this.onTokens?.({
          lines: message.lines,
          snapshot: message.snapshot,
          durationMs: message.durationMs,
        });
        break;

      case 'error':
        this.pendingRequestId = null;
        this.onError?.(new Error(message.message));
        break;
    }
  };

  private send(message: WorkerInboundMessage): void {
    this.worker.postMessage(message);
  }

  private nextRequestId(): WorkerRequestId {
    this.requestCounter += 1;
    return `req-${this.requestCounter}`;
  }
}
