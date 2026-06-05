/**
 * LogLevel classifies the output from the sandboxed execution.
 */
export type LogLevel = 'log' | 'warn' | 'error' | 'system';

export interface LogMessage {
  level: LogLevel;
  content: string;
}

export interface ExecutionPayload {
  code: string;
}

/**
 * Sandboxed Execution Thread
 * Runs user code securely away from the main UI thread.
 * Infinite loops will only hang this specific worker, which can be terminated
 * from the main thread without freezing the React application.
 */
self.onmessage = (e: MessageEvent<ExecutionPayload>) => {
  const code = e.data.code;
  const logs: LogMessage[] = [];

  // 1. Capture original console methods to prevent complete isolation loss
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // 2. Override console methods to intercept standard output
  console.log = (...args: any[]) => {
    logs.push({ level: 'log', content: args.map(a => String(a)).join(' ') });
    // originalConsoleLog(...args); // Keep silent in actual terminal
  };
  
  console.warn = (...args: any[]) => {
    logs.push({ level: 'warn', content: args.map(a => String(a)).join(' ') });
  };
  
  console.error = (...args: any[]) => {
    logs.push({ level: 'error', content: args.map(a => String(a)).join(' ') });
  };

  try {
    // 3. Evaluate code securely
    // We construct a new function and shadow potentially dangerous global variables
    // to provide a basic Javascript sandbox boundary.
    const executor = new Function('window', 'document', 'self', 'code', code);
    
    // Execute the code
    executor({}, {}, {}, code);
  } catch (err: any) {
    // 4. Gracefully catch syntax or runtime errors
    logs.push({ level: 'error', content: err.toString() });
  } finally {
    // 5. Restore standard console bindings
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // 6. Post the serialized execution trace back to the IDE Terminal UI
    self.postMessage({ logs });
  }
};
