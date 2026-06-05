import type { LineTokens } from '../worker/types';

interface VirtualLineRowProps {
  text: string;
  tokens: LineTokens | null;
}

export function VirtualLineRow({ text, tokens }: VirtualLineRowProps) {
  const display = text.length === 0 ? '\u00A0' : text;

  if (!tokens || tokens.spans.length === 0) {
    return <span className="token-plain">{display}</span>;
  }

  return (
    <>
      {tokens.spans.map((span, i) => (
        <span key={i} className={span.className}>
          {display.slice(span.start, span.end)}
        </span>
      ))}
    </>
  );
}
