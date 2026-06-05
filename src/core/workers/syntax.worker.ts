/**
 * TokenType classifies the syntax elements identified by the scanner.
 */
export enum TokenType {
  KEYWORD = 'KEYWORD',
  STRING = 'STRING',
  COMMENT = 'COMMENT',
  NUMBER = 'NUMBER',
  DEFAULT = 'DEFAULT',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  start: number;
  end: number;
}

export interface SyntaxMessage {
  version: number;
  text: string;
}

const KEYWORDS = new Set(['const', 'let', 'function', 'return', 'if', 'else', 'for']);

let latestVersion = -1;

self.onmessage = (e: MessageEvent<SyntaxMessage>) => {
  const { version, text } = e.data;
  
  // Ignore stale payloads based on version
  if (version < latestVersion) return;
  latestVersion = version;

  const tokens = tokenize(text);
  
  // Only post back if we are still the latest version (checking again after synchronous work)
  if (version === latestVersion) {
    self.postMessage({ version, tokens });
  }
};

/**
 * Single-pass O(N) evaluation over strings without catastrophic regex backtracking loops.
 * Operates as a simple synchronous state machine.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let currentLine = 0;
  
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    // Handle newlines
    if (char === '\n') {
      currentLine++;
      i++;
      continue;
    }

    // Whitespace (excluding newline)
    if (/[ \t\r]/.test(char)) {
      const start = i;
      while (i < len && /[ \t\r]/.test(text[i])) {
        i++;
      }
      tokens.push({
        type: TokenType.DEFAULT,
        value: text.substring(start, i),
        line: currentLine,
        start,
        end: i,
      });
      continue;
    }

    // Comments
    if (char === '/' && i + 1 < len) {
      const nextChar = text[i + 1];
      if (nextChar === '/') {
        // Single line comment
        const start = i;
        i += 2;
        while (i < len && text[i] !== '\n') {
          i++;
        }
        tokens.push({
          type: TokenType.COMMENT,
          value: text.substring(start, i),
          line: currentLine,
          start,
          end: i,
        });
        continue;
      } else if (nextChar === '*') {
        // Multi-line comment (splitting at newlines to associate with proper rows)
        let currentWord = '';
        let start = i;
        i += 2;
        currentWord += '/*';
        
        while (i < len && !(text[i] === '*' && text[i + 1] === '/')) {
          if (text[i] === '\n') {
            tokens.push({
              type: TokenType.COMMENT,
              value: currentWord,
              line: currentLine,
              start,
              end: i
            });
            currentLine++;
            currentWord = '';
            i++;
            start = i;
          } else {
            currentWord += text[i];
            i++;
          }
        }
        
        if (i < len) {
          currentWord += '*/';
          i += 2; // skip */
        }
        
        if (currentWord.length > 0) {
          tokens.push({
            type: TokenType.COMMENT,
            value: currentWord,
            line: currentLine,
            start,
            end: i,
          });
        }
        continue;
      }
    }

    // Strings
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let currentWord = quote;
      let start = i;
      i++;
      
      while (i < len && text[i] !== quote) {
        if (text[i] === '\n') {
          tokens.push({
            type: TokenType.STRING,
            value: currentWord,
            line: currentLine,
            start,
            end: i
          });
          currentLine++;
          currentWord = '';
          i++;
          start = i;
        } else {
          currentWord += text[i];
          i++;
        }
      }
      if (i < len) {
        currentWord += quote;
        i++; // closing quote
      }
      
      if (currentWord.length > 0) {
        tokens.push({
          type: TokenType.STRING,
          value: currentWord,
          line: currentLine,
          start,
          end: i,
        });
      }
      continue;
    }

    // Numbers
    if (/[0-9]/.test(char)) {
      const start = i;
      while (i < len && /[0-9\.]/.test(text[i])) {
        i++;
      }
      tokens.push({
        type: TokenType.NUMBER,
        value: text.substring(start, i),
        line: currentLine,
        start,
        end: i,
      });
      continue;
    }

    // Keywords & Default Words
    if (/[a-zA-Z_]/.test(char)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(text[i])) {
        i++;
      }
      const word = text.substring(start, i);
      tokens.push({
        type: KEYWORDS.has(word) ? TokenType.KEYWORD : TokenType.DEFAULT,
        value: word,
        line: currentLine,
        start,
        end: i,
      });
      continue;
    }

    // Other chars (Punctuation, symbols, etc.)
    const startChar = i;
    i++;
    tokens.push({
      type: TokenType.DEFAULT,
      value: text.substring(startChar, i),
      line: currentLine,
      start: startChar,
      end: i,
    });
  }

  return tokens;
}
