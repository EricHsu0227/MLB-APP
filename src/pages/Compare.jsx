import { useMemo, useState } from 'react';
import { useData, usePref } from '../lib/data.js';
import { statDef, statKeys } from '../lib/catalog.js';
import { RoleSeg, SplitSeg, SeasonSelect, StatPicker } from '../components/ui.jsx';

export default function Compare({ index }) {
  const [role, setRole] = usePref('cmp:role', 'bat');
  const [season, setSeason] = usePref('cmp:season', index.seasons.at(-1));
  const [split, setSplit] = usePref('cmp:split', 'all');
  const [picked, setPicked] = usePref('cmp:players', []); // [{id,name}] (matched by id within the chosen season)
  const [sel, setSel] = usePref(`cmp:stats:${role}`, ['wOBA', 'sc_xwOBA', 'sc_EV', 'K%', 'BB%', 'WAR']);
  const [q, setQ] = useState('');
  const { data } = useData(`${season}/${role}.json`);
  const keys = useMemo(() => (data ? statKeys(data.players) : []), [data]);
  const players = picked.map((p) => data?.players.find((x) => x.id === p.id)).filter(Boolean);
  const hits = q.length > 1 && data ? data.players.filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()) && !picked.some((x) => x.id === p.id)).slice(0, 8) : [];
  const best = (k) => { const d = statDef(k, role); const vs = players.map((p) => p.splits[split]?.[k]).filter((v) => typeof v === 'number'); return vs.length < 2 ? null : d.lowGood ? Math.min(...vs) : Math.max(...vs); };
  return (
    <>
      <div className="row panel">
        <RoleSeg value={role} onChange={(r) => { setRole(r); setPicked([]); }} />
        <SeasonSelect seasons={index.seasons} value={season} onChange={setSeason} />
        <SplitSeg value={split} onChange={setSplit} />
        <input placeholder="Add player…" value={q} onChange={(e) => setQ(e.target.value)} />
        {hits.map((p) => <button key={p.id} className="btn" onClick={() => { setPicked([...picked, { id: p.id, name: p.name }]); setQ(''); }}>+ {p.name}</button>)}
      </div>
      <div className="panel"><StatPicker keys={keys} role={role} value={sel} onChange={setSel} /></div>
      <div className="panel scroll"><table>
        <thead><tr><th>Stat</th>{players.map((p) => <th key={p.id}>{p.name} <a onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} style={{ cursor: 'pointer' }}>✕</a></th>)}</tr></thead>
        <tbody>{sel.map((k) => { const d = statDef(k, role), b = best(k); return (
          <tr key={k}><td>{d.label}</td>{players.map((p) => { const v = p.splits[split]?.[k]; return <td key={p.id} className="mono" style={b != null && v === b ? { fontWeight: 700, color: 'var(--accent)' } : null}>{d.f(v)}</td>; })}</tr>); })}</tbody>
      </table>{players.length === 0 && <div className="muted">Search and add players to compare.</div>}</div>
    </>
  );
}
