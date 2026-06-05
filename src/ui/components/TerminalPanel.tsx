import React, { useEffect, useRef } from 'react';
import { LogMessage } from '../../core/workers/execution.worker';

interface TerminalPanelProps {
  logs: LogMessage[];
  onClear: () => void;
  height?: number | string;
  isDarkMode?: boolean;
}

/**
 * TerminalPanel renders the integrated console output mirroring VS Code's strict layout.
 */
export const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, onClear, height = '16rem', isDarkMode = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the terminal when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div 
      className={`flex flex-col w-full transition-colors ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}`}
      style={{ height }}
    >
      {/* Header */}
      <div className={`h-9 flex items-center justify-between px-4 border-b shrink-0 transition-colors ${isDarkMode ? 'border-[#333] bg-[#1e1e1e]' : 'border-gray-300 bg-[#f3f3f3]'}`}>
        <div className="flex space-x-6 h-full mt-1">
          <span className={`text-[11px] font-medium uppercase tracking-wide cursor-pointer flex items-center border-b border-transparent ${isDarkMode ? 'text-[#808080] hover:text-[#cccccc]' : 'text-gray-500 hover:text-gray-800'}`}>PROBLEMS</span>
          <span className={`text-[11px] font-medium uppercase tracking-wide cursor-pointer flex items-center border-b-2 ${isDarkMode ? 'text-[#e7e7e7] border-[#e7e7e7]' : 'text-black border-black'}`}>TERMINAL</span>
        </div>
        <button 
          onClick={onClear}
          className={`flex items-center justify-center p-1 rounded-md outline-none focus:outline-none transition-colors ${isDarkMode ? 'text-[#cccccc] hover:bg-[#333] hover:text-white' : 'text-gray-600 hover:bg-gray-300 hover:text-black'}`}
          title="Clear Console"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>

      {/* Console Body */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-y-auto p-4 font-mono text-sm transition-colors ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}`}
      >
        {logs.length === 0 && (
          <div className={`italic ${isDarkMode ? 'text-[#808080]' : 'text-gray-500'}`}>Waiting for execution...</div>
        )}
        
        {logs.map((log, idx) => {
          // Color coding map based on execution status
          let colorClass = isDarkMode ? 'text-[#d4d4d4]' : 'text-gray-800'; // Default
          if (log.level === 'error') colorClass = isDarkMode ? 'text-[#f48771]' : 'text-red-600';
          else if (log.level === 'warn') colorClass = isDarkMode ? 'text-[#cca700]' : 'text-yellow-600';
          else if (log.level === 'system') colorClass = isDarkMode ? 'text-[#569cd6] font-semibold' : 'text-blue-600 font-semibold';
          else if (log.level === 'log') colorClass = isDarkMode ? 'text-[#ce9178]' : 'text-green-700'; // String outputs
          
          return (
            <div 
              key={idx} 
              className={`whitespace-pre-wrap flex items-start py-0.5 ${isDarkMode ? 'hover:bg-[#2a2d2e]' : 'hover:bg-gray-100'} ${colorClass}`}
            >
              <span className={`mr-3 select-none mt-0.5 ${isDarkMode ? 'text-[#5a5a5a]' : 'text-gray-400'}`}>
                {log.level === 'system' ? '⚙' : '>'}
              </span>
              <span className="flex-1">{log.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
