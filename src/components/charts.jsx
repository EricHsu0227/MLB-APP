import { useState } from 'react';

const palette = (i) => `var(--c${(i % 6) + 1})`;
export const seriesColor = palette;

/** Multi-series line chart. series: [{label, color?, points:[{x:number, y:number|null}]}] */
export function LineChart({ series, xTicks, fmt = (v) => v, height = 220, onPoint }) {
  const W = 640, H = height, m = { l: 46, r: 14, t: 12, b: 26 };
  const pts = series.flatMap((s) => s.points.filter((p) => p.y != null));
  const [hover, setHover] = useState(null);
  if (!pts.length) return <div className="muted small">No data for this stat.</div>;
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const x0 = xs[0], x1 = xs.at(-1);
  let lo = Math.min(...pts.map((p) => p.y)), hi = Math.max(...pts.map((p) => p.y));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = (x) => m.l + (x1 === x0 ? (W - m.l - m.r) / 2 : ((x - x0) / (x1 - x0)) * (W - m.l - m.r));
  const Y = (y) => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseLeave={() => setHover(null)}>
      {ticks.map((t, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} className="gl" /><text x={m.l - 6} y={Y(t) + 4} textAnchor="end" className="axis">{fmt(t)}</text></g>)}
      {(xTicks || xs).map((x) => <text key={x} x={X(x)} y={H - 7} textAnchor="middle" className="axis">{x}</text>)}
      {series.map((s, i) => {
        const c = s.color || palette(i);
        const ps = s.points.filter((p) => p.y != null);
        const d = ps.map((p, j) => `${j ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
        return (
          <g key={i}>
            <path d={d} fill="none" style={{ stroke: c }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {ps.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={hover?.x === p.x && hover?.i === i ? 5.5 : 3.6} style={{ fill: c }} className="dot"
              onMouseEnter={() => setHover({ x: p.x, y: p.y, i, label: s.label })} onClick={() => onPoint?.(s, p)} />)}
          </g>);
      })}
      {hover && (() => { const px = X(hover.x), py = Y(hover.y); const w = 150; const left = px > W / 2; return (
        <g pointerEvents="none"><rect x={left ? px - w - 8 : px + 8} y={py - 28} width={w} height={42} rx="6" className="tipbox" />
          <text x={(left ? px - w - 8 : px + 8) + 8} y={py - 12} className="tiptext">{hover.label}</text>
          <text x={(left ? px - w - 8 : px + 8) + 8} y={py + 5} className="tiptext b">{hover.x}: {fmt(hover.y)}</text></g>); })()}
    </svg>
  );
}

/** Radar chart on 0-100 values. axes: [label]; series: [{label, values:[0-100|null]}] */
export function Radar({ axes, series, size = 340 }) {
  const n = axes.length;
  if (n < 3) return <div className="muted small">Pick at least 3 stats for the radar.</div>;
  const c = size / 2, R = size / 2 - 52;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; const r = (R * v) / 100; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="chart radar">
      {[25, 50, 75, 100].map((g) => <polygon key={g} className="gl" fill="none" points={axes.map((_, i) => pt(i, g).join(',')).join(' ')} />)}
      {axes.map((a, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 118); return <g key={i}><line x1={c} y1={c} x2={x} y2={y} className="gl" /><text x={lx} y={ly + 4} textAnchor={lx < c - 4 ? 'end' : lx > c + 4 ? 'start' : 'middle'} className="axis">{a}</text></g>; })}
      {series.map((s, k) => (
        <polygon key={k} points={s.values.map((v, i) => pt(i, v ?? 0).join(',')).join(' ')} style={{ stroke: palette(k), fill: palette(k) }} fillOpacity="0.16" strokeWidth="2.2" />))}
    </svg>
  );
}

export function Spark({ values, width = 90, height = 26 }) {
  const ps = values.filter((v) => v != null);
  if (ps.length < 2) return null;
  const lo = Math.min(...ps), hi = Math.max(...ps), span = hi - lo || 1;
  const d = values.map((v, i) => (v == null ? null : [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - lo) / span) * (height - 6)])).filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return <svg width={width} height={height} className="spark"><path d={d} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
