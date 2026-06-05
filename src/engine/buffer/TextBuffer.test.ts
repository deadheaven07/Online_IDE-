import { TextBuffer } from './TextBuffer';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

export function runTextBufferTests(): void {
  const empty = new TextBuffer();
  assert(empty.getLength() === 0, 'empty length');
  assert(empty.getLineCount() === 1, 'empty line count');
  assert(empty.getLine(0) === '', 'empty line text');

  const buf = new TextBuffer({ initialText: 'hello\nworld' });
  assert(buf.getLength() === 11, 'initial length');
  assert(buf.getLineCount() === 2, 'initial line count');
  assert(buf.getLine(0) === 'hello', 'line 0');
  assert(buf.getLine(1) === 'world', 'line 1');

  buf.insert(5, '!');
  assert(buf.getText() === 'hello!\nworld', 'insert mid-line');

  buf.insert(7, 'foo\n');
  assert(buf.getLineCount() === 3, 'line count after newline insert');
  assert(buf.getLine(1) === 'foo', 'inserted line');

  buf.delete(0, 6);
  assert(buf.getLine(0) === 'foo', 'delete merges lines');

  const pos = buf.positionToOffset({ line: 0, column: 2 });
  const back = buf.offsetToPosition(pos);
  assert(back.line === 0 && back.column === 2, 'offset round-trip');

  const big = new TextBuffer();
  let text = '';
  for (let i = 0; i < 500; i++) {
    text += `line ${i}\n`;
  }
  big.insert(0, text);
  assert(big.getLineCount() === 501, 'bulk line count');
  assert(big.getLine(499) === 'line 499', 'line 499 text');
  assert(big.getLine(500) === '', 'trailing empty line');

  const line499Offset = big.positionToOffset({ line: 499, column: 0 });
  const line499Pos = big.offsetToPosition(line499Offset);
  assert(line499Pos.line === 499 && line499Pos.column === 0, 'line 499 position');

  const range = big.getLines({ startLine: 498, endLine: 500 });
  assert(range.length === 3, 'line range export');

  console.log('TextBuffer tests passed');
}
