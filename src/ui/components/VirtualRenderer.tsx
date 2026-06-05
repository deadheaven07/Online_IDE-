import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TextBuffer } from '../../core/models/TextBuffer';
import { Token, TokenType } from '../../core/workers/syntax.worker';

interface VirtualRendererProps {
  buffer: TextBuffer;
  tokens: Token[];
  cursorRow: number;
  cursorCol: number;
  width?: string | number;
  height?: string | number;
  isDarkMode?: boolean;
}

const LINE_HEIGHT = 24; 
const CHAR_WIDTH = 8;   

export const VirtualRenderer: React.FC<VirtualRendererProps> = ({ 
  buffer, 
  tokens, 
  cursorRow, 
  cursorCol,
  width = '100%',
  height = '100%',
  isDarkMode = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;

    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        setScrollTop(container.scrollTop);
      });
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Compute text bounds and virtualization properties
  const lines = buffer.getLines(); 
  const totalLines = lines.length;
  const totalHeight = totalLines * LINE_HEIGHT;

  // Calculate strict visible slice (with small overscan buffer of 2 lines)
  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - 2);
  const endIndex = Math.min(totalLines - 1, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + 2);
  
  const visibleLines = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleLines.push({ index: i, text: lines[i] });
  }

  // Pre-group tokens by their respective row for instantaneous lookup during row render
  const tokensByLine = useMemo(() => {
    const map = new Map<number, Token[]>();
    for (const token of tokens) {
      const list = map.get(token.line) || [];
      list.push(token);
      map.set(token.line, list);
    }
    return map;
  }, [tokens]);

  const cursorTop = cursorRow * LINE_HEIGHT;
  const cursorLeft = cursorCol * CHAR_WIDTH;

  const renderLine = (lineIndex: number, text: string) => {
    const lineTokens = tokensByLine.get(lineIndex) || [];
    
    if (lineTokens.length === 0) {
      return <span style={{ color: isDarkMode ? '#d4d4d4' : '#000000' }}>{text || ' '}</span>; // Fallback
    }

    return (
      <>
        {lineTokens.map((token, idx) => {
          let color = isDarkMode ? '#d4d4d4' : '#000000'; // DEFAULT text
          if (token.type === TokenType.KEYWORD) color = isDarkMode ? '#569cd6' : '#0000ff';
          if (token.type === TokenType.STRING) color = isDarkMode ? '#ce9178' : '#a31515';
          if (token.type === TokenType.COMMENT) color = isDarkMode ? '#6a9955' : '#008000';
          if (token.type === TokenType.NUMBER) color = isDarkMode ? '#b5cea8' : '#098658';
          
          return (
            <span key={idx} style={{ color }}>
              {token.value}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width, 
        height, 
        overflow: 'auto', 
        position: 'relative',
        backgroundColor: 'transparent',
        fontFamily: '"JetBrains Mono", Consolas, Menlo, Monaco, monospace',
        fontSize: '14px',
        lineHeight: `${LINE_HEIGHT}px`,
        whiteSpace: 'pre'
      }}
    >
      {/* Synthetic height placeholder to activate native scrollbar */}
      <div style={{ height: totalHeight, width: '1px', position: 'absolute', top: 0, left: 0 }} />
      
      {/* Absolute positioned rendering layer mapping strictly over the visible slice */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        {visibleLines.map((line) => (
          <div 
            key={line.index} 
            style={{ 
              position: 'absolute', 
              top: line.index * LINE_HEIGHT, 
              left: 0, 
              height: LINE_HEIGHT,
              width: '100%',
              display: 'flex'
            }}
            className="hover:bg-[#2a2d2e] transition-colors duration-75"
          >
            {/* Line Number Gutter */}
            <div 
              style={{
                width: '60px',
                minWidth: '60px',
                height: '100%',
                color: line.index === cursorRow ? '#c6c6c6' : '#858585',
                textAlign: 'right',
                paddingRight: '16px',
                userSelect: 'none',
                fontFamily: '"JetBrains Mono", Consolas, Menlo, Monaco, monospace',
                fontSize: '13px'
              }}
            >
              {line.index + 1}
            </div>
            
            {/* Code Line */}
            <div style={{
                fontFamily: '"JetBrains Mono", Consolas, Menlo, Monaco, monospace',
                fontSize: '14px',
                whiteSpace: 'pre',
                flex: 1
            }}>
              {renderLine(line.index, line.text)}
            </div>
          </div>
        ))}
      </div>

      {/* Programmatic Blinking Cursor mapped to exact font metrics */}
      <div 
        style={{
          position: 'absolute',
          top: cursorTop,
          left: cursorLeft + 60, // align with gutter width
          width: 2,
          height: LINE_HEIGHT,
          backgroundColor: '#aeafad',
          animation: 'cursor-blink 1s step-end infinite',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />
      <style>
        {`
          @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};
