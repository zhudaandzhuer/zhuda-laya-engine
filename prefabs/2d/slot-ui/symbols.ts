// Code-drawn placeholder symbols: a coloured shape per symbol id, so a slot runs and can be
// judged before it has art. A game replaces SymbolPainter with its own (sprites, Spine).
// Needs the engine (Laya.Graphics).

export type SymbolShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'drop' | 'moon' | 'cross' | 'ring' | 'ball';

export interface SymbolStyle {
  shape: SymbolShape;
  color: string;
  /** Darker edge colour. */
  edge: string;
}

/** Styles for the example ids (0 scatter ring, 1–8 shapes, 9 multiplier ball). */
export const EXAMPLE_SYMBOL_STYLES: Record<number, SymbolStyle> = {
  0: { shape: 'ring', color: '#f5c542', edge: '#8a6410' },
  1: { shape: 'circle', color: '#ef4444', edge: '#7f1d1d' },
  2: { shape: 'square', color: '#f97316', edge: '#7c2d12' },
  3: { shape: 'triangle', color: '#facc15', edge: '#854d0e' },
  4: { shape: 'diamond', color: '#22c55e', edge: '#14532d' },
  5: { shape: 'hexagon', color: '#2dd4bf', edge: '#115e59' },
  6: { shape: 'drop', color: '#3b82f6', edge: '#1e3a8a' },
  7: { shape: 'moon', color: '#a855f7', edge: '#4c1d95' },
  8: { shape: 'cross', color: '#cbd5e1', edge: '#475569' },
  9: { shape: 'ball', color: '#fb7185', edge: '#881337' },
};

/** Draws one symbol centred at (cx, cy) in a size × size box. */
export type SymbolPainter = (g: Laya.Graphics, symbol: number, cx: number, cy: number, size: number) => void;

function polygon(cx: number, cy: number, r: number, n: number, start: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * Math.PI * 2) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

/** A painter for a style table (unknown ids draw a grey square with nothing in it). */
export function shapePainter(styles: Record<number, SymbolStyle> = EXAMPLE_SYMBOL_STYLES): SymbolPainter {
  return (g, symbol, cx, cy, size) => {
    const st = styles[symbol] ?? { shape: 'square', color: '#64748b', edge: '#334155' };
    const r = size * 0.36;
    const lw = Math.max(2, size * 0.05);
    switch (st.shape) {
      case 'circle':
        g.drawCircle(cx, cy, r, st.color, st.edge, lw);
        g.drawCircle(cx - r * 0.3, cy - r * 0.3, r * 0.25, 'rgba(255,255,255,0.35)');
        break;
      case 'square':
        g.drawRoundRect(cx - r, cy - r, r * 2, r * 2, r * 0.3, r * 0.3, r * 0.3, r * 0.3, st.color, st.edge, lw);
        break;
      case 'triangle':
        g.drawPoly(0, 0, polygon(cx, cy + r * 0.15, r * 1.15, 3, -Math.PI / 2), st.color, st.edge, lw);
        break;
      case 'diamond':
        g.drawPoly(0, 0, [cx, cy - r * 1.15, cx + r * 0.85, cy, cx, cy + r * 1.15, cx - r * 0.85, cy], st.color, st.edge, lw);
        break;
      case 'hexagon':
        g.drawPoly(0, 0, polygon(cx, cy, r * 1.05, 6, 0), st.color, st.edge, lw);
        break;
      case 'drop':
        g.drawCircle(cx, cy + r * 0.25, r * 0.78, st.color, st.edge, lw);
        g.drawPoly(0, 0, [cx, cy - r * 1.15, cx + r * 0.62, cy - r * 0.05, cx - r * 0.62, cy - r * 0.05], st.color);
        break;
      case 'moon':
        g.drawCircle(cx, cy, r, st.color, st.edge, lw);
        g.drawCircle(cx + r * 0.45, cy - r * 0.25, r * 0.78, 'rgba(15,23,42,0.92)');
        break;
      case 'cross': {
        const w = r * 0.62;
        g.drawRoundRect(cx - w / 2, cy - r, w, r * 2, 4, 4, 4, 4, st.color, st.edge, lw);
        g.drawRoundRect(cx - r, cy - w / 2, r * 2, w, 4, 4, 4, 4, st.color, st.edge, lw);
        break;
      }
      case 'ring':
        g.drawCircle(cx, cy, r * 1.05, null, st.edge, lw * 3.2);
        g.drawCircle(cx, cy, r * 1.05, null, st.color, lw * 2);
        g.drawPoly(0, 0, polygon(cx, cy, r * 0.42, 5, -Math.PI / 2), st.color);
        break;
      case 'ball':
        g.drawCircle(cx, cy, r * 1.08, st.color, st.edge, lw);
        g.drawCircle(cx, cy, r * 0.8, 'rgba(255,255,255,0.18)');
        break;
    }
  };
}
