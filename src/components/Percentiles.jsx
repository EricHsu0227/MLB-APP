import { useMemo, useState } from 'react';
import { statDef } from '../lib/catalog.js';
import { percentile, peerPool } from '../lib/stats.js';
import { StatPicker, SplitSeg, pctColor } from './ui.jsx';
import { usePref } from '../lib/data.js';

const DEFAULT = { bat: ['sc_xwOBA', 'sc_EV', 'sc_Barrel%', 'sc_HardHit%', 'K%', 'BB%', 'sc_Whiff%'], pit: ['sc_xwOBA', 'K%', 'BB%', 'sc_Whiff%', 'sc_HardHit%', 'ERA', 'FIP'] };

/** Customizable percentile rankings: any stats, any split, pool by min PA/IP (+ optional team). */
export default function Percentiles({ rows, player, role, keys }) {
  const [sel, setSel] = usePref(`pct:${role}`, DEFAULT[role]);
  const [split, setSplit] = usePref('pct:split', 'all');
  const [minPA, setMinPA] = usePref(`pct:minPA:${role}`, role === 'bat' ? 100 : 0);
  const [minIP, setMinIP] = usePref('pct:minIP', role === 'pit' ? 30 : 0);
  const [edit, setEdit] = useState(false);
  const pool = useMemo(() => peerPool(rows, split, { minPA: role === 'bat' ? minPA : 0, minIP: role === 'pit' ? minIP : 0 }), [rows, split, minPA, minIP, role]);
  const line = player.splits[split];
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <SplitSeg value={split} onChange={setSplit} />
        {role === 'bat'
          ? <label>Min PA <input type="number" value={minPA} style={{ width: 70 }} onChange={(e) => setMinPA(+e.target.value)} /></label>
          : <label>Min IP <input type="number" value={minIP} style={{ width: 70 }} onChange={(e) => setMinIP(+e.target.value)} /></label>}
        <span className="muted">vs {pool.length} players</span>
        <button className="btn" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Customize'}</button>
      </div>
      {edit && <div style={{ marginBottom: 8 }}><StatPicker keys={keys} role={role} value={sel} onChange={setSel} /></div>}
      {!line && <div className="muted">No data for this split.</div>}
      {line && sel.map((k) => {
        const d = statDef(k, role), v = line[k];
        const p = percentile(pool.map((r) => r.splits[split][k]), v, d.lowGood);
        return (
          <div className="pct" key={k}>
            <span>{d.label}</span>
            <div className="bar">{p != null && <><i style={{ width: p + '%', background: pctColor(p), opacity: 0.3 }} /><b style={{ left: Math.max(4, Math.min(96, p)) + '%', background: pctColor(p) }}>{p}</b></>}</div>
            <span className="mono" style={{ textAlign: 'right' }}>{d.f(v)}</span>
          </div>
        );
      })}
    </div>
  );
}
