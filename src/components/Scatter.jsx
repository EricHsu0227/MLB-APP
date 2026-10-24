import { useState } from 'react';
import { fitLine } from '../lib/saber.js';

/** Scatter of [{x,y,label,href,hot}]. fx/fy format the axes; onPick(point) on click. */
export default function Scatter({ points, fx, fy, xLabel, yLabel, onPick }) {
  const W = 700, H = 420, m = { l: 58, r: 16, t: 14, b: 40 };
  const [hov, setHov] = useState(null);
  if (!points.length) return <div className="muted small">No players have both stats.</div>;
  const ext = (k) => { let lo = Math.min(...points.map((p) => p[k])), hi = Math.max(...points.map((p) => p[k])); if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.05; return [lo - pad, hi + pad]; };
  const [x0, x1] = ext('x'), [y0, y1] = ext('y');
  const X = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const tick = (lo, hi) => Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * i) / 5);
  const fit = fitLine(points);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart scatter" onMouseLeave={() => setHov(null)}>
      {tick(y0, y1).map((t, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} className="gl" /><text x={m.l - 6} y={Y(t) + 4} textAnchor="end" className="axis">{fy(t)}</text></g>)}
      {tick(x0, x1).map((t, i) => <text key={i} x={X(t)} y={H - 22} textAnchor="middle" className="axis">{fx(t)}</text>)}
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" className="axis b">{xLabel}</text>
      <text transform={`translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis b">{yLabel}</text>
      {fit && <line x1={X(x0)} x2={X(x1)} y1={Y(fit.slope * x0 + fit.intercept)} y2={Y(fit.slope * x1 + fit.intercept)} className="fitline" />}
      {points.map((p) => <circle key={p.key} cx={X(p.x)} cy={Y(p.y)} r={p.hot ? 6 : hov?.key === p.key ? 6 : 3.4} className={'sdot' + (p.hot ? ' hot' : '')} onMouseEnter={() => setHov(p)} onClick={() => onPick?.(p)} />)}
      {hov && (() => { const px = X(hov.x), py = Y(hov.y), w = 190, left = px > W / 2; const x = left ? px - w - 10 : px + 10; return (
        <g pointerEvents="none"><rect x={x} y={Math.max(4, py - 34)} width={w} height={44} rx="6" className="tipbox" />
          <text x={x + 8} y={Math.max(4, py - 34) + 17} className="tiptext b">{hov.label}</text>
          <text x={x + 8} y={Math.max(4, py - 34) + 34} className="tiptext">{fx(hov.x)} · {fy(hov.y)}</text></g>); })()}
      {fit && <text x={W - m.r - 4} y={m.t + 12} textAnchor="end" className="axis">r = {fit.r.toFixed(2)} · n = {points.length}</text>}
    </svg>
  );
}
