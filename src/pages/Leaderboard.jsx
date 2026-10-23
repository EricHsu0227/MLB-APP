import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, usePref } from '../lib/data.js';
import { statDef, statKeys } from '../lib/catalog.js';
import { peerPool, sortRows, toCSV } from '../lib/stats.js';
import { RoleSeg, SplitSeg, SeasonSelect, StatPicker } from '../components/ui.jsx';

const COLS = { bat: ['PA', 'AVG', 'OBP', 'SLG', 'wOBA', 'wRC+', 'WAR', 'sc_xwOBA', 'sc_EV', 'sc_Barrel%'], pit: ['IP', 'ERA', 'FIP', 'K%', 'BB%', 'WAR', 'sc_xwOBA', 'sc_Whiff%'] };

export default function Leaderboard({ index }) {
  const [role, setRole] = usePref('lb:role', 'bat');
  const [season, setSeason] = usePref('lb:season', index.seasons.at(-1));
  const [split, setSplit] = usePref('lb:split', 'all');
  const [cols, setCols] = usePref(`lb:cols:${role}`, COLS[role]);
  const [sort, setSort] = useState({ key: null, dir: -1 });
  const [minPA, setMinPA] = useState(0);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const { data, error } = useData(`${season}/${role}.json`);
  const keys = useMemo(() => (data ? statKeys(data.players) : []), [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    const k = sort.key || cols[0];
    const pool = peerPool(data.players, split, { minPA: role === 'bat' ? minPA : 0, minIP: role === 'pit' ? minPA : 0 })
      .filter((r) => !q || r.name?.toLowerCase().includes(q.toLowerCase()));
    return sortRows(pool, split, k, sort.dir);
  }, [data, split, sort, cols, minPA, q, role]);
  const hdr = (k) => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : -1 }));
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCSV(rows, split, cols)], { type: 'text/csv' })); a.download = `${season}-${role}-${split}.csv`; a.click(); };
  return (
    <>
      <div className="row panel">
        <RoleSeg value={role} onChange={(r) => { setRole(r); setCols(COLS[r]); setSort({ key: null, dir: -1 }); }} />
        <SeasonSelect seasons={index.seasons} value={season} onChange={setSeason} />
        <SplitSeg value={split} onChange={setSplit} />
        <label>Min {role === 'bat' ? 'PA' : 'IP'} <input type="number" style={{ width: 70 }} value={minPA} onChange={(e) => setMinPA(+e.target.value)} /></label>
        <input placeholder="Search player" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `Columns (${cols.length})`}</button>
        <button className="btn" onClick={download}>CSV</button>
      </div>
      {edit && <div className="panel"><StatPicker keys={keys} role={role} value={cols} onChange={setCols} /></div>}
      {error && <div className="panel">No data for {season}: {String(error.message)}</div>}
      <div className="panel scroll">
        <table>
          <thead><tr><th>#</th><th className="l">Player</th><th className="l">Team</th>{cols.map((k) => <th key={k} onClick={() => hdr(k)}>{statDef(k, role).label}{(sort.key || cols[0]) === k ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 500).map((r, i) => (
            <tr key={r.id}><td>{i + 1}</td><td className="l"><Link to={`/player/${season}/${role}/${r.id}`}>{r.name}</Link></td><td className="l">{r.team}</td>
              {cols.map((k) => <td key={k} className="mono">{statDef(k, role).f(r.splits[split]?.[k])}</td>)}</tr>))}</tbody>
        </table>
      </div>
    </>
  );
}
