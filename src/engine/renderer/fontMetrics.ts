import type { FontMetrics } from './types';

const DEFAULT_FONT =
  '14px "JetBrains Mono", Menlo, Monaco, Consolas, monospace';

/**
 * Probe the browser for monospace cell dimensions.
 * Canvas gives us char width; a hidden DOM node gives real line height.
 */
export function measureFontMetrics(
  font: string = DEFAULT_FONT,
): FontMetrics {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let charWidth = 7.8;
  if (ctx) {
    ctx.font = font;
    charWidth = ctx.measureText('m').width;
  }

  const probe = document.createElement('span');
  probe.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'white-space:pre',
    'font:' + font,
  ].join(';');
  probe.textContent = 'Xg';
  document.body.appendChild(probe);

  const lineHeight = probe.offsetHeight || 20;
  document.body.removeChild(probe);

  return {
    charWidth,
    lineHeight,
    ascent: lineHeight * 0.78,
    descent: lineHeight * 0.22,
  };
}
