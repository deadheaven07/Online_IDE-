import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VirtualRenderer } from './VirtualRenderer';
import { TerminalPanel } from './TerminalPanel';
import { TextBuffer } from '../../core/models/TextBuffer';
import { Token } from '../../core/workers/syntax.worker';
import { LogMessage } from '../../core/workers/execution.worker';

export const EditorShell: React.FC = () => {
  // initialize text buffer
  const [buffer] = useState(() => {
    const buf = new TextBuffer();
    buf.insert("// High-Performance IDE Core\nfunction bootstrap() {\n  console.log('Rendering 60 FPS!');\n}\n\nbootstrap();\n\nfor (let i = 0; i < 3; i++) {\n  console.log('Loop iteration:', i);\n}\n");
    return buf;
  });

  // Editor and Rendering State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [latencyMs, setLatencyMs] = useState(0);
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  
  // UI Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Terminal and Execution State
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const executionWorkerRef = useRef<Worker | null>(null);
  
  // Worker Sync State
  const [version, setVersion] = useState(0);
  const syntaxWorkerRef = useRef<Worker | null>(null);
  const timestampRef = useRef<number>(0);

  // Initialize Syntax Highlight Worker
  useEffect(() => {
    syntaxWorkerRef.current = new Worker(new URL('../../core/workers/syntax.worker.ts', import.meta.url), {
      type: 'module'
    });

    syntaxWorkerRef.current.onmessage = (e) => {
      const { version: msgVersion, tokens: newTokens } = e.data;
      if (msgVersion === version) {
        setTokens(newTokens);
        setLatencyMs(performance.now() - timestampRef.current);
      }
    };

    return () => {
      syntaxWorkerRef.current?.terminate();
      syntaxWorkerRef.current = null;
    };
  }, [version]);

  // Cleanup execution worker on unmount
  useEffect(() => {
    return () => {
      if (executionWorkerRef.current) {
        executionWorkerRef.current.terminate();
        executionWorkerRef.current = null;
      }
    };
  }, []);

  // Request high-performance asynchronous compilation layer update
  const triggerSyntaxWorker = useCallback(() => {
    if (!syntaxWorkerRef.current) return;
    timestampRef.current = performance.now();
    const newVersion = version + 1;
    setVersion(newVersion);
    
    syntaxWorkerRef.current.postMessage({
      version: newVersion,
      text: buffer.getText()
    });
  }, [buffer, version]);

  // Initial trigger
  useEffect(() => {
    triggerSyntaxWorker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Orchestrates the secure execution thread.
   */
  const handleRunCode = () => {
    if (executionWorkerRef.current) {
      executionWorkerRef.current.terminate(); // Kill any runaway threads
    }

    executionWorkerRef.current = new Worker(new URL('../../core/workers/execution.worker.ts', import.meta.url), {
      type: 'module'
    });

    setLogs(prev => [...prev, { level: 'system', content: '--- Process Started ---' }]);

    executionWorkerRef.current.onmessage = (e) => {
      const { logs: executionLogs } = e.data;
      setLogs(prev => [
        ...prev, 
        ...executionLogs, 
        { level: 'system', content: `--- Process Exited with code 0 ---` }
      ]);
    };

    executionWorkerRef.current.onerror = (err) => {
      setLogs(prev => [...prev, { level: 'error', content: `Fatal Worker Exception: ${err.message}` }]);
    };

    executionWorkerRef.current.postMessage({ code: buffer.getText() });
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Simple keyboard loop logic for interactive demo
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let updateNeeded = false;

    if (e.key === 'ArrowRight') {
      setCursorCol(prev => prev + 1);
    } else if (e.key === 'ArrowLeft') {
      setCursorCol(prev => Math.max(0, prev - 1));
    } else if (e.key === 'ArrowDown') {
      setCursorRow(prev => prev + 1);
    } else if (e.key === 'ArrowUp') {
      setCursorRow(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Backspace') {
      buffer.moveCursor(cursorRow, cursorCol);
      buffer.delete();
      setCursorCol(prev => Math.max(0, prev - 1));
      updateNeeded = true;
    } else if (e.key.length === 1 || e.key === 'Enter') {
      const char = e.key === 'Enter' ? '\n' : e.key;
      buffer.moveCursor(cursorRow, cursorCol);
      buffer.insert(char);
      
      if (char === '\n') {
        setCursorRow(prev => prev + 1);
        setCursorCol(0);
      } else {
        setCursorCol(prev => prev + 1);
      }
      updateNeeded = true;
    }

    if (updateNeeded) {
      triggerSyntaxWorker();
    }
  };

  return (
    <div 
      className={`h-screen w-screen flex flex-col overflow-hidden outline-none font-sans ${isDarkMode ? 'dark bg-[#1e1e1e] text-[#cccccc]' : 'bg-white text-gray-800'}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Main Body */}
      <div className="flex-1 flex min-h-0">
        
        {/* Activity Bar (Leftmost) */}
        <div className={`w-12 flex flex-col items-center justify-between py-4 shrink-0 z-20 transition-colors ${isDarkMode ? 'bg-[#333333]' : 'bg-gray-100'}`}>
          <div className="flex flex-col gap-4 w-full items-center">
            <div 
              className={`w-full flex justify-center py-2 cursor-pointer border-l-2 ${isSidebarOpen ? (isDarkMode ? 'border-white text-white' : 'border-black text-black') : `border-transparent ${isDarkMode ? 'text-[#858585] hover:text-[#cccccc]' : 'text-gray-400 hover:text-gray-600'}`}`} 
              title="Explorer" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
          </div>
          <div className="flex flex-col gap-4 w-full items-center mb-2">
            <div 
              className={`w-full flex justify-center py-2 cursor-pointer border-l-2 border-transparent ${isDarkMode ? 'text-[#858585] hover:text-[#cccccc]' : 'text-gray-400 hover:text-gray-600'}`} 
              title="Settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className={`w-64 border-r flex flex-col shrink-0 transition-colors ${isDarkMode ? 'bg-[#252526] border-[#333]' : 'bg-[#f3f3f3] border-gray-200'}`}>
            <div className={`h-9 flex items-center px-4 text-[11px] font-semibold tracking-wider uppercase ${isDarkMode ? 'text-[#cccccc]' : 'text-gray-600'}`}>
              Language Selected
            </div>
            <div className="flex-1 overflow-y-auto mt-1">
              {/* Folder Header */}
              <div className={`px-1 py-1 flex items-center justify-between cursor-pointer font-bold text-xs group ${isDarkMode ? 'text-[#cccccc] hover:bg-[#2a2d2e]' : 'text-gray-700 hover:bg-gray-200'}`}>
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  IDE_PROJECT
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 pr-2">
                  <button className={`p-0.5 rounded-md ${isDarkMode ? 'hover:bg-[#333333] text-[#cccccc] hover:text-white' : 'hover:bg-gray-300 text-gray-600 hover:text-black'}`} title="New File...">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  </button>
                </div>
              </div>
              
              {/* Files */}
              <div className={`pl-6 pr-4 py-1 cursor-pointer text-[13px] flex items-center gap-2 ${isDarkMode ? 'hover:bg-[#2a2d2e] text-[#cccccc] bg-[#37373d]' : 'hover:bg-gray-200 text-gray-700 bg-[#e4e6f1]'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#519aba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                index.ts
              </div>
            </div>
          </div>
        )}

        {/* Right Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Editor Header/Tabs */}
          <div className={`h-9 flex items-center justify-between pr-4 shrink-0 transition-colors ${isDarkMode ? 'bg-[#252526]' : 'bg-[#ececec]'}`}>
            <div className="flex h-full">
              <div className={`px-3 flex items-center justify-between text-[13px] border-t border-[#007fd4] min-w-[130px] cursor-pointer gap-2 group ${isDarkMode ? 'bg-[#1e1e1e] text-white' : 'bg-white text-black'}`}>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#519aba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  index.ts
                </div>
                <div className={`w-5 h-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'hover:bg-[#333333] text-[#858585] hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle Button */}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center justify-center p-1.5 rounded-md text-[12px] transition-colors outline-none focus:outline-none ${isDarkMode ? 'hover:bg-[#333333] text-[#cccccc] hover:text-white' : 'hover:bg-gray-300 text-gray-600 hover:text-black'}`}
                title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
              >
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                )}
              </button>
              
              <button 
                onClick={handleRunCode}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] transition-colors outline-none focus:outline-none ${isDarkMode ? 'bg-transparent hover:bg-[#333333] text-[#cccccc] hover:text-white' : 'bg-transparent hover:bg-gray-300 text-gray-700 hover:text-black'}`}
                title="Run Code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4CAF50]"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Run
              </button>
            </div>
          </div>

          {/* Editor Area */}
          <div className={`flex-1 relative transition-colors ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
            <VirtualRenderer 
              buffer={buffer}
              tokens={tokens}
              cursorRow={cursorRow}
              cursorCol={cursorCol}
              isDarkMode={isDarkMode}
            />
          </div>

          {/* Divider */}
          <div className={`h-1 cursor-row-resize shrink-0 transition-colors ${isDarkMode ? 'bg-[#333] hover:bg-[#007fd4]' : 'bg-gray-200 hover:bg-[#007fd4]'}`}></div>

          {/* Terminal Area */}
          <div className="h-64 shrink-0 flex flex-col min-h-0">
            <TerminalPanel logs={logs} onClear={handleClearLogs} height="100%" isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>

      {/* Status Bar (Bottom) */}
      <div className="h-6 bg-[#007acc] text-white flex justify-between px-4 text-[11px] items-center shrink-0">
        <div className="flex items-center gap-3 h-full">
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full">
            Harsh Raghuwanshi' IDE
          </span>
        </div>
        <div className="flex items-center gap-3 h-full">
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full">
            Ln {cursorRow + 1}, Col {cursorCol + 1}
          </span>
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full">
            Spaces: 2
          </span>
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full">
            UTF-8
          </span>
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full">
            TypeScript React
          </span>
          <span className="cursor-pointer hover:bg-[#1f8ad6] px-2 flex items-center h-full text-[#4ade80]" title={`Worker Latency: ${latencyMs.toFixed(1)}ms`}>
            ● {latencyMs.toFixed(1)}ms
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${isSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          onClick={() => setIsSettingsOpen(false)}
        />
        
        {/* Animated Modal Container */}
        <div 
          className={`absolute flex flex-col items-center justify-center p-8 bg-black border border-[#333] rounded-xl shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom-left text-white`}
          style={{
            width: '400px',
            top: '50%',
            left: '50%',
            // If open, be exactly centered. If closed, translate way down and left towards the icon, and shrink to 0.
            transform: isSettingsOpen 
              ? 'translate(-50%, -50%) scale(1)' 
              : 'translate(calc(-50vw + 24px), calc(50vh - 24px)) scale(0)'
          }}
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-tight">Welcome</h2>
          <p className="text-center text-gray-300 leading-relaxed">
            Hey ! there Welcome to this IDE Project , made with love by Harsh Raghuwanshi .
          </p>
          <button 
            className="mt-8 px-8 py-2.5 bg-[#007acc] hover:bg-[#0069a5] transition-colors rounded-md text-white font-semibold text-sm outline-none focus:outline-none shadow-lg shadow-blue-500/20"
            onClick={() => setIsSettingsOpen(false)}
          >
            Thankyou
          </button>
        </div>
      </div>
    </div>
  );
};
