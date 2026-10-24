import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SPLITS, splitLabel, statDef } from '../lib/catalog.js';
import { SECTIONS, sectionIds, sectionKeys, sectionLabel } from '../lib/sections.js';
import { pctColor } from '../lib/themes.js';
import { headshot, useData } from '../lib/data.js';

export function Seg({ value, onChange, options, small }) {
  return (
    <span className={'seg' + (small ? ' small' : '')} role="group">
      {options.map(([v, l]) => <button type="button" key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </span>
  );
}
export const SplitSeg = ({ role = 'bat', ...p }) => <Seg {...p} options={SPLITS.map(([id]) => [id, splitLabel(id, role)])} />;
export const RoleSeg = (p) => <Seg {...p} options={[['bat', 'Hitters'], ['pit', 'Pitchers']]} />;
export const SeasonSelect = ({ seasons, value, onChange, all }) => (
  <select value={value} onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
    {all && <option value="all">All seasons</option>}
    {[...seasons].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
  </select>
);
export function Headshot({ id, size = 64, className = '' }) {
  const [bad, setBad] = useState(false);
  return bad
    ? <div className={'avatar ' + className} style={{ width: size, height: size }}>⚾</div>
    : <img className={'avatar ' + className} width={size} height={size} src={headshot(id, size * 2)} alt="" loading="lazy" onError={() => setBad(true)} />;
}

/** Savant-style percentile bubble. */
export function Bubble({ p, size = 26 }) {
  if (p == null) return <span className="bubble none" style={{ width: size, height: size }}>–</span>;
  return <span className="bubble" style={{ width: size, height: size, background: pctColor(p) }}>{p}</span>;
}

/** Search-as-you-type over players-index.json. onPick({id, name, role, ...}) */
export function PlayerSearch({ onPick, placeholder = 'Search players…', role, autoFocus, className = '' }) {
  const { data: index } = useData('players-index.json');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!index || s.length < 2) return [];
    const out = [];
    for (const p of index) {
      if (role && !p.r.includes(role)) continue;
      const n = p.n?.toLowerCase() || '';
      const at = n.indexOf(s);
      if (at >= 0) out.push([at === 0 || n[at - 1] === ' ' ? 0 : 1, -p.y[1], p]);
      if (out.length > 400) break;
    }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 8).map((x) => x[2]);
  }, [index, q, role]);
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => { const f = (e) => { if (!box.current?.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  const pick = (p) => { onPick({ id: p.id, name: p.n, roles: role ? [role] : p.r, last: p.y[1], first: p.y[0], team: p.t }); setQ(''); setOpen(false); };
  return (
    <div className={'search ' + className} ref={box}>
      <input autoFocus={autoFocus} value={q} placeholder={placeholder} onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && hits[hi]) pick(hits[hi]);
          else if (e.key === 'Escape') setOpen(false);
        }} />
      {open && hits.length > 0 && (
        <div className="search-pop">
          {hits.map((p, i) => (
            <div key={p.id} className={'hit' + (i === hi ? ' hi' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
              <Headshot id={p.id} size={30} /><span className="grow">{p.n}</span>
              <span className="muted small">{p.r.map((r) => (r === 'bat' ? 'H' : 'P')).join('/')} · {p.t} · {p.y[0] === p.y[1] ? p.y[0] : `${p.y[0]}–${p.y[1]}`}</span>
            </div>))}
        </div>)}
    </div>
  );
}
export const playerHref = (role, id, season, split) => `/player/${role}/${id}${season || split ? '?' : ''}${[season && `season=${season}`, split && split !== 'all' && `split=${split}`].filter(Boolean).join('&')}`;
export const PlayerLink = ({ role, id, season, split, children }) => <Link to={playerHref(role, id, season, split)}>{children}</Link>;

/** Search + toggle chips over stat keys, grouped by section. */
export function StatPicker({ keys, role, value, onChange, max = Infinity }) {
  const [q, setQ] = useState('');
  const [sec, setSec] = useState('all');
  const on = new Set(value);
  const avail = useMemo(() => new Set(keys), [keys]);
  const base = useMemo(() => (sec === 'all' ? keys : sectionKeys(role, sec, avail)), [sec, keys, role, avail]);
  const ql = q.toLowerCase();
  const shown = base.filter((k) => !ql || k.toLowerCase().includes(ql) || statDef(k, role).label.toLowerCase().includes(ql));
  const toggle = (k) => onChange(on.has(k) ? value.filter((x) => x !== k) : value.length < max ? [...value, k] : value);
  return (
    <div className="picker">
      <div className="row">
        <input placeholder={`Search ${keys.length} stats…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sec} onChange={(e) => setSec(e.target.value)}>
          <option value="all">Every stat</option>
          {sectionIds(role).filter((s) => s !== 'all').map((s) => <option key={s} value={s}>{sectionLabel(role, s)}</option>)}
        </select>
        <button type="button" className="btn sm" onClick={() => onChange([...new Set([...value, ...shown])].slice(0, max))}>Add shown</button>
        <button type="button" className="btn sm" onClick={() => onChange([])}>Clear</button>
        <span className="muted small">{value.length} selected</span>
      </div>
      <div className="chips">{shown.slice(0, 600).map((k) => { const d = statDef(k, role); return <span key={k} title={d.desc || k} className={'chip' + (on.has(k) ? ' on' : '')} onClick={() => toggle(k)}>{d.label}</span>; })}</div>
    </div>
  );
}
export { SECTIONS };

/** Small "L .xxx · R .xxx" line under a value; each split is green/red vs the main value. */
export function SubSplits({ line, k, d, main, role }) {
  const items = SPLITS.filter(([x]) => x !== 'all').map(([x]) => ({ x, v: line?.[x]?.[k] }));
  if (!items.some((i) => typeof i.v === 'number')) return null;
  const cls = (v) => (typeof v !== 'number' || typeof main !== 'number' || !d.dir || v === main ? '' : (v - main) * d.dir > 0 ? ' good' : ' bad');
  return <div className="sub">{items.map(({ x, v }) => <span key={x} className={'s' + cls(v)} title={splitLabel(x, role)}>{x === 'vsL' ? 'L' : 'R'} {d.f(v)}</span>)}</div>;
}
