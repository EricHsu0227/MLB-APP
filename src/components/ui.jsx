import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SPLITS, splitLabel, statDef } from '../lib/catalog.js';
import { SECTIONS, noSplit, pickerGroups } from '../lib/sections.js';
import { pctColor } from '../lib/themes.js';
import { headshot, useData, usePref } from '../lib/data.js';

export function Seg({ value, onChange, options, small }) {
  return (
    <span className={'seg' + (small ? ' small' : '')} role="group">
      {options.map(([v, l]) => <button type="button" key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </span>
  );
}
export const SplitSeg = ({ role = 'bat', ...p }) => <Seg {...p} options={SPLITS.map(([id]) => [id, splitLabel(id, role)])} />;
export const SplitSelect = ({ role = 'bat', value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>{SPLITS.map(([id]) => <option key={id} value={id}>{splitLabel(id, role)}</option>)}</select>
);
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
    ? <div className={'avatar ' + className} style={{ width: size, height: size }} />
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

/** Stat picker: search, then the stats grouped in sections. Pitch-level sections start folded. */
export function StatPicker({ keys, role, value, onChange, max = Infinity }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const on = new Set(value);
  const groups = useMemo(() => pickerGroups(role, keys), [role, keys]);
  const ql = q.trim().toLowerCase();
  const hit = (k) => !ql || k.toLowerCase().includes(ql) || statDef(k, role).label.toLowerCase().includes(ql);
  const toggle = (k) => onChange(on.has(k) ? value.filter((x) => x !== k) : value.length < max ? [...value, k] : value);
  const chip = (k) => { const d = statDef(k, role); return <span key={k} title={d.desc || k} className={'chip' + (on.has(k) ? ' on' : '')} onClick={() => toggle(k)}>{d.label}</span>; };
  return (
    <div className="picker">
      <div className="row">
        <input placeholder="Search stats" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">{value.length} selected{Number.isFinite(max) ? ` of ${max} max` : ''}</span>
        {value.length > 0 && <button type="button" className="btn sm" onClick={() => onChange([])}>Clear</button>}
      </div>
      {value.length > 0 && !ql && <div className="pick-sel"><span className="muted small">Selected</span><div className="chips">{value.map(chip)}</div></div>}
      <div className="pick-groups">
        {groups.map((g) => {
          const ks = g.keys.filter(hit);
          if (!ks.length) return null;
          const isOpen = ql ? true : open[g.id] ?? !g.folded;
          const n = ks.filter((k) => on.has(k)).length;
          return (
            <div key={g.id} className="pick-group">
              <div className="pick-head">
                <button type="button" className="link-btn" onClick={() => setOpen({ ...open, [g.id]: !isOpen })}>{isOpen ? '\u25BE' : '\u25B8'} {g.label}</button>
                <span className="muted small">{n ? `${n} of ${ks.length}` : ks.length}</span>
                {isOpen && <button type="button" className="link-btn small" onClick={() => onChange(n === ks.length ? value.filter((k) => !ks.includes(k)) : [...new Set([...value, ...ks])].slice(0, max))}>{n === ks.length ? 'Remove all' : 'Add all'}</button>}
              </div>
              {isOpen && <div className="chips">{ks.map(chip)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export { SECTIONS };

/** Small "L .xxx · R .xxx" line under a value; each split is green/red vs the main value. */
export function SubSplits({ line, k, d, main, role }) {
  if (noSplit(k)) return null;
  const items = SPLITS.filter(([x]) => x !== 'all').map(([x]) => ({ x, v: line?.[x]?.[k] }));
  if (!items.some((i) => typeof i.v === 'number')) return null;
  const cls = (v) => (typeof v !== 'number' || typeof main !== 'number' || !d.dir || v === main ? '' : (v - main) * d.dir > 0 ? ' good' : ' bad');
  return <div className="sub">{items.map(({ x, v }) => <span key={x} className={'s' + cls(v)} title={splitLabel(x, role)}>{x === 'vsL' ? 'L' : 'R'} {d.f(v)}</span>)}</div>;
}

/** Section switcher: one row of underlined tabs that scrolls sideways (like the original), pitch-level
 *  sections at the end after a divider. The selected tab is kept in view. With `orderKey`, the person can
 *  reorder the sections ("Reorder" opens a list with up/down buttons); the order is saved per orderKey. */
export function SectionTabs({ items, more = [], value, onChange, orderKey }) {
  const ref = useRef(null);
  const [order, setOrder] = usePref(orderKey || 'sec:order:none', null);
  const [editing, setEditing] = useState(false);
  useEffect(() => { // scroll the row (only the row, never the page) so the selected tab is visible
    const row = ref.current; const b = row?.querySelector('button.on'); if (!b) return;
    if (b.offsetLeft < row.scrollLeft || b.offsetLeft + b.offsetWidth > row.scrollLeft + row.clientWidth - 28) row.scrollLeft = b.offsetLeft - 24;
  }, [value, order]);
  const all = [...items, ...more];
  const saved = orderKey && Array.isArray(order) ? order : null;
  const sorted = saved ? [...all].sort((a, b) => rankIn(saved, a[0], all) - rankIn(saved, b[0], all)) : null;
  const move = (i, d) => { const ids = (sorted || all).map(([id]) => id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; setOrder(ids); };
  const btn = ([id, label]) => <button type="button" role="tab" aria-selected={value === id} key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>;
  return (
    <>
      <div className="sectabs-wrap">
        <div className="sectabs" role="tablist" ref={ref}>
          {sorted ? sorted.map(btn) : <>{items.map(btn)}{more.length > 0 && <span className="sectabs-div" aria-hidden="true" />}{more.map(btn)}</>}
        </div>
        {orderKey && <button type="button" className={'sectabs-edit' + (editing ? ' on' : '')} onClick={() => setEditing(!editing)} title="Reorder sections" aria-label="Reorder sections">{editing ? 'Done' : 'Reorder'}</button>}
      </div>
      {editing && (
        <div className="reorder">
          {(sorted || all).map(([id, label], i, arr) => (
            <div key={id} className="reorder-row">
              <span className="grow">{label}</span>
              <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${label} up`}>↑</button>
              <button type="button" className="btn sm" disabled={i === arr.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${label} down`}>↓</button>
            </div>))}
          <div className="row"><button type="button" className="btn sm" onClick={() => setOrder(null)}>Reset to default order</button><span className="muted small">The order is saved on this device.</span></div>
        </div>)}
    </>
  );
}
// position in the saved order; sections added later keep their default place after the saved ones
const rankIn = (saved, id, all) => { const i = saved.indexOf(id); return i >= 0 ? i : saved.length + all.findIndex(([x]) => x === id); };
