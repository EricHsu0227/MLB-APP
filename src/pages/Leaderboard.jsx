import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { load, usePref } from '../lib/data.js';
import { statDef, statKeys, splitLabel } from '../lib/catalog.js';
import { sectionIds, sectionKeys, sectionLabel } from '../lib/sections.js';
import { percentile, peerPool, sortRows, toCSV } from '../lib/stats.js';
import { Headshot, RoleSeg, SplitSeg, StatPicker, SubSplits, playerHref } from '../components/ui.jsx';
import { pctColor } from '../lib/themes.js';

const OPS = { '≥': (a, b) => a >= b, '≤': (a, b) => a <= b, '=': (a, b) => Math.abs(a - b) < 1e-9 };
const PAGE = [25, 50, 100, 250];

function useRows(role, from, to, seasons) {
  const [st, set] = useState({ rows: [], loading: true, error: null, loaded: 0, total: 0 });
  useEffect(() => {
    let on = true;
    const ys = seasons.filter((y) => y >= from && y <= to);
    set({ rows: [], loading: true, error: null, loaded: 0, total: ys.length });
    let n = 0;
    Promise.all(ys.map((y) => load(`${y}/${role}.json`).then((d) => { n++; on && set((s) => ({ ...s, loaded: n })); return d.players.map((p) => ({ ...p, season: y })); })))
      .then((parts) => on && set((s) => ({ ...s, rows: parts.flat(), loading: false })), (e) => on && set((s) => ({ ...s, error: e, loading: false })));
    return () => { on = false; };
  }, [role, from, to, seasons]);
  return st;
}

export default function Leaderboard({ index }) {
  const nav = useNavigate();
  const seasons = index.seasons;
  const [role, setRole] = usePref('lb:role', 'bat');
  const [from, setFrom] = usePref('lb:from', seasons.at(-1));
  const [to, setTo] = usePref('lb:to', seasons.at(-1));
  const [split, setSplit] = usePref('lb:split', 'all');
  const [sec, setSec] = usePref('lb:sec', 'dashboard');
  const [custom, setCustom] = usePref(`lb:custom:${role}`, null);
  const [min, setMin] = usePref(`lb:min:${role}`, role === 'bat' ? 100 : 30);
  const [team, setTeam] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState([]);
  const [sort, setSort] = useState({ key: null, dir: -1 });
  const [shade, setShade] = usePref('tools:shade', true);
  const [inline, setInline] = usePref('tools:splits', true);
  const [pageSize, setPageSize] = usePref('lb:ps', 50);
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState(false);
  const [picked, setPicked] = useState({});
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const { rows: all, loading, error, loaded, total } = useRows(role, lo, hi, seasons);
  const allKeys = useMemo(() => statKeys(all.length > 3000 ? all.slice(0, 3000) : all), [all]);
  const keySet = useMemo(() => new Set(allKeys), [allKeys]);
  const secKeys = sec === 'custom' ? (custom || []) : sectionKeys(role, sec, keySet);
  const cols = secKeys.length > 80 && sec === 'all' ? secKeys.slice(0, 80) : secKeys;
  const teams = useMemo(() => [...new Set(all.map((r) => r.team).filter(Boolean))].sort(), [all]);
  const multi = lo !== hi;
  const defSort = cols.includes('WAR') ? 'WAR' : cols[0];

  const rows = useMemo(() => {
    let r = peerPool(all, split, role === 'bat' ? { minPA: min } : { minIP: min });
    if (team) r = r.filter((x) => x.team === team);
    if (q) r = r.filter((x) => x.name?.toLowerCase().includes(q.toLowerCase()));
    for (const f of filters) {
      if (!f.key || f.val === '' || Number.isNaN(+f.val)) continue;
      const d = statDef(f.key, role); const v = d.pct ? +f.val / 100 : +f.val;
      r = r.filter((x) => { const a = x.splits[split]?.[f.key]; return typeof a === 'number' && OPS[f.op](a, v); });
    }
    return sortRows(r, split, sort.key || defSort || 'WAR', sort.dir);
  }, [all, split, min, role, team, q, filters, sort, defSort]);

  useEffect(() => { setPage(0); }, [rows.length, pageSize]);
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  const pools = useMemo(() => { // per-column sorted values for shading, by season
    if (!shade) return null;
    const m = new Map();
    for (const k of cols) { const d = statDef(k, role); if (!d.dir) continue; const bySeason = new Map(); for (const r of rows) { const v = r.splits[split]?.[k]; if (typeof v === 'number') { if (!bySeason.has(r.season)) bySeason.set(r.season, []); bySeason.get(r.season).push(v); } } m.set(k, bySeason); }
    return m;
  }, [rows, cols, shade, split, role]);
  const hdr = (k) => setSort((s) => ({ key: k, dir: (s.key || defSort) === k ? -s.dir : (statDef(k, role).dir < 0 ? 1 : -1) }));
  const rowKey = (r) => `${r.id}:${r.season}`;
  const sel = Object.keys(picked).filter((k) => picked[k]);
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCSV(rows.map((r) => ({ ...r, name: multi ? `${r.name} (${r.season})` : r.name })), split, cols)], { type: 'text/csv' })); a.download = `${lo}-${hi}-${role}-${split}.csv`; a.click(); };
  const activeSort = sort.key || defSort;

  return (
    <>
      <section className="panel toolbar">
        <div className="row"><RoleSeg value={role} onChange={(r) => { setRole(r); setSec('dashboard'); setSort({ key: null, dir: -1 }); setFilters([]); setPicked({}); }} />
          <label className="row small">Seasons <select value={from} onChange={(e) => { const v = +e.target.value; setFrom(v); if (v > to) setTo(v); }}>{seasons.map((y) => <option key={y}>{y}</option>)}</select>
            to <select value={to} onChange={(e) => { const v = +e.target.value; setTo(v); if (v < from) setFrom(v); }}>{seasons.map((y) => <option key={y}>{y}</option>)}</select></label>
          <SplitSeg role={role} value={split} onChange={setSplit} /></div>
        <div className="row">
          <label className="small">Min {role === 'bat' ? 'PA' : 'IP'} <input type="number" style={{ width: 70 }} value={min} onChange={(e) => setMin(+e.target.value)} /></label>
          <select value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{teams.map((t) => <option key={t}>{t}</option>)}</select>
          <input placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="btn sm" onClick={() => setFilters([...filters, { key: cols[0] || 'WAR', op: '≥', val: '' }])}>+ Stat filter</button>
          <label className="small row"><input type="checkbox" checked={shade} onChange={(e) => setShade(e.target.checked)} /> Percentile shading</label>
          <label className="small row"><input type="checkbox" checked={inline} onChange={(e) => setInline(e.target.checked)} /> Show L/R splits</label>
        </div>
        {filters.map((f, i) => (
          <div className="row" key={i}>
            <select value={f.key} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}>{allKeys.map((k) => <option key={k} value={k}>{statDef(k, role).label}</option>)}</select>
            <select value={f.op} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}>{Object.keys(OPS).map((o) => <option key={o}>{o}</option>)}</select>
            <input style={{ width: 90 }} placeholder={statDef(f.key, role).pct ? 'percent, e.g. 25' : 'value'} value={f.val} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, val: e.target.value } : x)))} />
            <button type="button" className="btn sm" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>✕</button>
          </div>))}
      </section>

      <div className="tabs">
        {sectionIds(role).map((s) => <button type="button" key={s} className={sec === s ? 'on' : ''} onClick={() => { setSec(s); setSort({ key: null, dir: -1 }); }}>{sectionLabel(role, s)}</button>)}
        <button type="button" className={sec === 'custom' ? 'on' : ''} onClick={() => { if (!custom) setCustom(cols.length ? cols : ['WAR']); setSec('custom'); setEdit(true); }}>★ Custom</button>
      </div>
      {(sec === 'custom' || edit) && sec === 'custom' && <section className="panel"><StatPicker keys={allKeys} role={role} value={custom || []} onChange={setCustom} /></section>}

      <section className="panel nopad">
        <div className="row between pad">
          <span className="muted small">{loading ? `Loading ${loaded}/${total} seasons…` : `${rows.length.toLocaleString()} ${multi ? 'player-seasons' : 'players'} · ${splitLabel(split, role)} · ${cols.length} columns`}</span>
          <span className="row">
            {sel.length > 0 && <button type="button" className="btn primary sm" onClick={() => nav(`/compare?p=${sel.slice(0, 8).map((k) => { const [id, y] = k.split(':'); return `${role}:${id}:${y}`; }).join(',')}`)}>Compare {Math.min(sel.length, 8)} selected</button>}
            <button type="button" className="btn sm" onClick={download}>CSV</button></span>
        </div>
        {error && <div className="pad">Couldn’t load: {String(error.message)}</div>}
        <div className="scroll tall">
          <table className="t lb sticky-2">
            <thead><tr><th className="c"><input type="checkbox" aria-label="select page" checked={shown.length > 0 && shown.every((r) => picked[rowKey(r)])} onChange={(e) => setPicked({ ...picked, ...Object.fromEntries(shown.map((r) => [rowKey(r), e.target.checked])) })} /></th><th>#</th><th className="l">Player</th>{multi && <th>Season</th>}<th className="l">Team</th>
              {cols.map((k) => { const d = statDef(k, role); return <th key={k} onClick={() => hdr(k)} title={d.desc || k} className={activeSort === k ? 'active' : ''}>{d.label}{activeSort === k ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>; })}</tr></thead>
            <tbody>{shown.map((r, i) => (
              <tr key={rowKey(r)} className={picked[rowKey(r)] ? 'sel' : ''}>
                <td className="c"><input type="checkbox" checked={!!picked[rowKey(r)]} onChange={(e) => setPicked({ ...picked, [rowKey(r)]: e.target.checked })} /></td>
                <td className="muted">{page * pageSize + i + 1}</td>
                <td className="l player-cell"><Headshot id={r.id} size={26} /><Link to={playerHref(role, r.id, r.season, split)}>{r.name}</Link></td>
                {multi && <td>{r.season}</td>}<td className="l">{r.team}</td>
                {cols.map((k) => {
                  const d = statDef(k, role); const v = r.splits[split]?.[k];
                  let style;
                  if (pools && d.dir && typeof v === 'number') { const p = percentile(pools.get(k)?.get(r.season) || [], v, d.dir < 0); if (p != null) style = { background: `color-mix(in srgb, ${pctColor(p)} 38%, transparent)` }; }
                  return <td key={k} className="mono" style={style}>{d.f(v)}{inline && split === 'all' && <SubSplits line={r.splits} k={k} d={d} main={v} role={role} />}</td>;
                })}
              </tr>))}</tbody>
          </table>
        </div>
        <div className="row between pad">
          <span className="row"><button type="button" className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Prev</button>
            <span className="small">Page {page + 1} / {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
            <button type="button" className="btn sm" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(page + 1)}>Next ›</button></span>
          <label className="small">Rows <select value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>{PAGE.map((n) => <option key={n}>{n}</option>)}</select></label>
        </div>
      </section>
    </>
  );
}
