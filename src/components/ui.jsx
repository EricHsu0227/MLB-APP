import { useState } from 'react';
import { SPLITS, statDef } from '../lib/catalog.js';

export function Seg({ value, onChange, options }) {
  return <span className="row">{options.map(([v, l]) => <button key={v} className={'btn' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</span>;
}
export const SplitSeg = (p) => <Seg {...p} options={SPLITS} />;
export const RoleSeg = (p) => <Seg {...p} options={[['bat', 'Hitters'], ['pit', 'Pitchers']]} />;

export function SeasonSelect({ seasons, value, onChange }) {
  return <select value={value} onChange={(e) => onChange(Number(e.target.value))}>{[...seasons].reverse().map((y) => <option key={y}>{y}</option>)}</select>;
}

/** Search + toggle chips over every available stat key. */
export function StatPicker({ keys, role, value, onChange, max = Infinity }) {
  const [q, setQ] = useState('');
  const on = new Set(value);
  const shown = keys.filter((k) => statDef(k, role).label.toLowerCase().includes(q.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase()));
  const toggle = (k) => onChange(on.has(k) ? value.filter((x) => x !== k) : value.length < max ? [...value, k] : value);
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <input placeholder={`Search ${keys.length} stats…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => onChange(keys.slice(0, max))}>All</button>
        <button className="btn" onClick={() => onChange([])}>None</button>
        <span className="muted">{value.length} selected</span>
      </div>
      <div className="chips">{shown.map((k) => <span key={k} className={'chip' + (on.has(k) ? ' on' : '')} onClick={() => toggle(k)}>{statDef(k, role).label}</span>)}</div>
    </div>
  );
}

export const pctColor = (p) => `hsl(${Math.round((p / 100) * 120)} 65% 42%)`;
