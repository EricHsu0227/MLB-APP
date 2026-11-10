import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePref, useRows } from '../lib/data.js';
import { percentile, toCSV } from '../lib/stats.js';
import { shadeStyle } from '../lib/themes.js';
import { Seg, playerHref } from './ui.jsx';
import { activeCount, makeFilter } from './LbFilters.jsx';

// One RRAA board for hitters and pitchers together. Two-way players get one row with both parts added up.
const COLS = [
  ['RRAA', 'RRAA', 'Total runs above average (hitting + pitching)'],
  ['RRAA_H', 'Hitting', 'Hitter RRAA: batting + baserunning + fielding'],
  ['RRAA_P', 'Pitching', 'Pitcher RRAA'],
  ['RRAA_Bat', 'Bat', 'Batting runs (wRAA + park + league)', 'bat'],
  ['RRAA_BsR', 'BsR', 'Baserunning runs', 'bat'],
  ['RRAA_Fld', 'Fld', 'Fielding runs', 'bat'],
  ['wwOBA', 'wwOBA', 'Weighted wOBA (hitters)', 'bat'],
  ['wwRC+', 'wwRC+', 'wRC+ built on wwOBA (100 = average)', 'bat'],
  ['RRAA_wOBA', 'wOBA against', 'Pitcher wOBA against', 'pit', -1],
  ['P_wwOBA', 'wwOBA against', 'Pitcher wwOBA against', 'pit', -1],
  ['P_wwRC+', 'wwRC+ against', 'Pitcher wwRC+ against (100 = average, lower is better)', 'pit', -1],
  ['PA', 'PA', 'Plate appearances as a hitter', 'bat', 0],
  ['TBF', 'TBF', 'Batters faced as a pitcher', 'pit', 0],
  ['RWAR', 'RWAR', 'RRAA wins above replacement, hitting + pitching'],
  ['WAR', 'WAR', 'FanGraphs WAR, hitting + pitching'],
];
const PAGE = [25, 50, 100, 250];
const ROLE_OF = { H: 'bat', P: 'pit', TW: 'bat' };

function merge(bat, pit, split) {
  const m = new Map();
  const get = (r) => { const k = `${r.id}:${r.season}`; if (!m.has(k)) m.set(k, { id: r.id, name: r.name, season: r.season, team: r.team, splits: { [split]: {}, ...(split !== 'all' ? { all: {} } : {}) }, has: {} }); const o = m.get(k); if (r.rookie) o.rookie = true; const a = r.splits.all?.Age; if (a != null) o.splits.all.Age = a; return o; };
  for (const r of bat) {
    const s = r.splits[split]; if (!s || typeof s.RRAA !== 'number') continue;
    const o = get(r); const d = o.splits[split]; o.has.bat = true;
    Object.assign(d, { RRAA_H: s.RRAA, RRAA_Bat: s.RRAA_Bat, RRAA_BsR: s.RRAA_BsR, RRAA_Fld: s.RRAA_Fld, wwOBA: s.wwOBA, 'wwRC+': s['wwRC+'], PA: s.RRAA_PA ?? s.PA });
    d.WAR = (d.WAR ?? 0) + (r.splits.all?.WAR ?? 0); if (r.splits.all?.RWAR != null) d.RWAR = (d.RWAR ?? 0) + r.splits.all.RWAR;
  }
  for (const r of pit) {
    const s = r.splits[split]; if (!s || typeof s.RRAA !== 'number') continue;
    const o = get(r); const d = o.splits[split]; o.has.pit = true;
    if (!o.has.bat) o.team = r.team;
    Object.assign(d, { RRAA_P: s.RRAA, RRAA_wOBA: s.RRAA_wOBA, P_wwOBA: s.wwOBA, 'P_wwRC+': s['wwRC+'], TBF: s.RRAA_PA ?? s.TBF });
    d.WAR = (d.WAR ?? 0) + (r.splits.all?.WAR ?? 0); if (r.splits.all?.RWAR != null) d.RWAR = (d.RWAR ?? 0) + r.splits.all.RWAR;
  }
  return [...m.values()].map((o) => {
    const d = o.splits[split];
    d.RRAA = (d.RRAA_H ?? 0) + (d.RRAA_P ?? 0);
    if (split !== 'all') { delete d.WAR; delete d.RWAR; }
    return { ...o, type: o.has.bat && o.has.pit ? 'TW' : o.has.bat ? 'H' : 'P' };
  });
}

export default function RraaBoard({ seasons, lo, hi, split, team, q, xf }) {
  const bat = useRows('bat', lo, hi, seasons);
  const pit = useRows('pit', lo, hi, seasons);
  const [who, setWho] = usePref('lb:rraa:who', 'all');
  const [min, setMin] = usePref('lb:rraa:min', 150);
  const [shade] = usePref('lb:shade', true);
  const [pageSize, setPageSize] = usePref('lb:ps', 50);
  const [sort, setSort] = useState({ key: 'RRAA', dir: -1 });
  const [page, setPage] = useState(0);
  const multi = lo !== hi;
  const all = useMemo(() => merge(bat.rows, pit.rows, split), [bat.rows, pit.rows, split]);
  const cols = COLS.filter(([, , , side]) => !side || who === 'all' || (who === 'H' ? side === 'bat' : side === 'pit')).filter(([k]) => !(who === 'H' && k === 'RRAA_P') && !(who === 'P' && k === 'RRAA_H'));
  const rows = useMemo(() => {
    let r = all.filter((x) => { const d = x.splits[split]; return (d.PA ?? 0) + (d.TBF ?? 0) >= min * (split === 'all' ? 1 : 0.4); });
    if (who === 'H') r = r.filter((x) => x.type !== 'P'); else if (who === 'P') r = r.filter((x) => x.type !== 'H');
    if (team) r = r.filter((x) => x.team === team);
    if (xf && activeCount(xf)) r = r.filter(makeFilter({ ...xf, pos: [], role: '', hand: '', qual: false, maxQ: '' }, 'rraa', split, new Map()));
    if (q) r = r.filter((x) => x.name?.toLowerCase().includes(q.toLowerCase()));
    const v = (x) => x.splits[split][sort.key];
    return r.sort((a, b) => { const x = v(a), y = v(b); if (x == null) return y == null ? 0 : 1; if (y == null) return -1; return sort.dir * (x - y); });
  }, [all, split, min, who, team, q, sort, xf]);
  useEffect(() => { setPage(0); }, [rows.length, pageSize]);
  const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
  const pools = useMemo(() => {
    if (!shade) return null;
    const m = new Map();
    for (const [k, , , , dir] of cols) { if (dir === 0) continue; const by = new Map(); for (const r of rows) { const x = r.splits[split][k]; if (typeof x === 'number') { if (!by.has(r.season)) by.set(r.season, []); by.get(r.season).push(x); } } m.set(k, by); }
    return m;
  }, [rows, cols, shade, split]);
  const fmt = (k, x) => (x == null ? '—' : k === 'WAR' || k === 'RWAR' ? x.toFixed(1) : /wOBA/.test(k) ? x.toFixed(3).replace(/^0/, '') : Math.round(x).toString());
  const loading = bat.loading || pit.loading;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCSV(rows.map((r) => ({ ...r, name: multi ? `${r.name} (${r.season})` : r.name })), split, cols.map(([k]) => k))], { type: 'text/csv' })); a.download = `${lo}-${hi}-rraa-${split}.csv`; a.click(); };

  return (
    <>
      <div className="toolbar">
        <Seg small value={who} onChange={setWho} options={[['all', 'Everyone'], ['H', 'Hitters'], ['P', 'Pitchers']]} />
        <label>Min PA + TBF <input type="number" style={{ width: 64 }} value={min} onChange={(e) => setMin(+e.target.value)} /></label>
      </div>
      <p className="note">RRAA is runs above average: batting, baserunning and fielding for hitters, runs prevented for pitchers. Two-way players show both added together.{split !== 'all' && ' In L/R splits, a hitter’s baserunning and fielding runs are shared out by PA.'}</p>
      <section className="panel nopad">
        <div className="row between pad">
          <span className="muted small">{loading ? 'Loading…' : `${rows.length.toLocaleString()} ${multi ? 'player-seasons' : 'players'}`}</span>
          <button type="button" className="btn sm" onClick={download}>CSV</button>
        </div>
        <div className="scroll tall">
          <table className="t lb sticky-2">
            <thead><tr><th>#</th><th>Type</th><th className="l">Player</th>{multi && <th>Season</th>}<th className="l">Team</th>
              {cols.map(([k, l, desc]) => <th key={k} title={desc} className={sort.key === k ? 'active' : ''} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : -1 }))}>{l}{sort.key === k ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>)}</tr></thead>
            <tbody>{shown.map((r, i) => (
              <tr key={`${r.id}:${r.season}`}>
                <td className="muted">{page * pageSize + i + 1}</td>
                <td><span className={`rraa-type ${r.type}`} title={{ H: 'Hitter', P: 'Pitcher', TW: 'Two-way' }[r.type]}>{r.type}</span></td>
                <td className="l player-cell"><Link to={playerHref(ROLE_OF[r.type], r.id, r.season, split)}>{r.name}</Link></td>
                {multi && <td>{r.season}</td>}<td className="l">{r.team}</td>
                {cols.map(([k, , , , dir = 1]) => {
                  const x = r.splits[split][k];
                  let style;
                  if (pools && dir && typeof x === 'number') { const p = percentile(pools.get(k)?.get(r.season) || [], x, dir < 0); if (p != null) style = shadeStyle(p); }
                  return <td key={k} className="mono" style={style}>{k === 'RRAA' ? <b>{fmt(k, x)}</b> : fmt(k, x)}</td>;
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
