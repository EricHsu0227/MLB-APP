import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { load, useRows, usePref, useSeason } from '../lib/data.js';
import { statDef, statKeys } from '../lib/catalog.js';
import { agingDeltas, cumulative, regress, zDistance, zStats, similarity, fitLine } from '../lib/saber.js';
import { PlayerSearch, RoleSeg, SeasonSelect, Seg, StatPicker } from '../components/ui.jsx';
import { LineChart } from '../components/charts.jsx';
import Scatter from '../components/Scatter.jsx';
import { tint } from '../lib/themes.js';

const TOOLS = [
  ['luck', 'Luck report', 'Who is over- or under-performing their expected stats.'],
  ['platoon', 'Platoon finder', 'The biggest left/right gaps, with small samples regressed.'],
  ['scatter', 'Scatter explorer', 'Plot any stat against any other for a season.'],
  ['aging', 'Aging curves', 'How a stat changes with age (delta method, all seasons).'],
  ['similar', 'Similar players', 'Closest statistical matches to any player-season.'],
];
const f = (k, role) => statDef(k, role).f;
const seasonFile = (rows, season) => rows.filter((r) => r.season === season);
const ovr = (r, k) => r.splits.all?.[k];

function useLoad(role, seasons, from, to) { return useRows(role, from, to, seasons); }

function Controls({ role, setRole, season, setSeason, seasons, min, setMin, extra }) {
  return (
    <div className="row">
      <RoleSeg value={role} onChange={setRole} />
      {setSeason && <SeasonSelect seasons={seasons} value={season} onChange={setSeason} />}
      {setMin && <label className="small">Min {role === 'bat' ? 'PA' : 'IP'} <input type="number" style={{ width: 70 }} value={min} onChange={(e) => setMin(+e.target.value)} /></label>}
      {extra}
    </div>
  );
}

/** Sortable results table. cols: [{k,label,get,fmt,tint?(row)=>0-100}] */
function Table({ rows, cols, role, sortKey, setSortKey, dir, limit = 40 }) {
  const col = cols.find((c) => c.k === sortKey) || cols[0];
  const sorted = [...rows].sort((a, b) => { const sv = col.sort || col.get; const x = sv(a), y = sv(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x - y) * dir; }).slice(0, limit);
  return (
    <div className="scroll tall"><table className="t sticky-first"><thead><tr><th className="l">Player</th><th className="l">Team</th>{cols.map((c) => <th key={c.k} className={c.k === col.k ? 'active' : ''} style={{ cursor: 'pointer' }} onClick={() => setSortKey(c.k)} title={c.title}>{c.label}</th>)}</tr></thead>
      <tbody>{sorted.map((r) => <tr key={r.id + ':' + r.season}><td className="l"><Link to={`/player/${role}/${r.id}?season=${r.season}`}>{r.name}</Link></td><td className="l">{r.team}</td>
        {cols.map((c) => <td key={c.k} className="mono" style={c.tint ? tint(c.tint(r), 40) : undefined}>{c.get(r) == null ? '—' : c.fmt(c.get(r))}</td>)}</tr>)}</tbody></table></div>
  );
}

/* ---------- luck ---------- */
function Luck({ seasons, role, setRole }) {
  const [season, setSeason] = usePref('lab:season', seasons.at(-1));
  const [min, setMin] = usePref(`lab:min:${role}`, role === 'bat' ? 200 : 60);
  const [metric, setMetric] = useState(null);
  const [dir, setDir] = useState(-1);
  const { rows: all, loading } = useLoad(role, seasons, season, season);
  const rows = useMemo(() => seasonFile(all, season).filter((r) => (role === 'bat' ? (ovr(r, 'PA') ?? 0) : (ovr(r, 'IP') ?? 0)) >= min), [all, season, role, min]);
  const defs = role === 'bat'
    ? [['woba', 'wOBA − xwOBA', (r) => ovr(r, 'wOBA') - ovr(r, 'xwOBA'), (v) => (v >= 0 ? '+' : '') + v.toFixed(3).replace('0.', '.'), 'Positive = hitting better than the quality of contact says'],
       ['avg', 'AVG − xAVG', (r) => ovr(r, 'AVG') - ovr(r, 'xAVG'), (v) => (v >= 0 ? '+' : '') + v.toFixed(3).replace('0.', '.')],
       ['slg', 'SLG − xSLG', (r) => ovr(r, 'SLG') - ovr(r, 'xSLG'), (v) => (v >= 0 ? '+' : '') + v.toFixed(3).replace('0.', '.')]]
    : [['fip', 'FIP − ERA', (r) => ovr(r, 'FIP') - ovr(r, 'ERA'), (v) => (v >= 0 ? '+' : '') + v.toFixed(2), 'Positive = ERA better than FIP (lucky)'],
       ['xfip', 'xFIP − ERA', (r) => ovr(r, 'xFIP') - ovr(r, 'ERA'), (v) => (v >= 0 ? '+' : '') + v.toFixed(2)],
       ['siera', 'SIERA − ERA', (r) => ovr(r, 'SIERA') - ovr(r, 'ERA'), (v) => (v >= 0 ? '+' : '') + v.toFixed(2)]];
  const key = metric || defs[0][0];
  const cur = defs.find((d) => d[0] === key) || defs[0];
  const vals = rows.map((r) => cur[2](r)).filter((v) => Number.isFinite(v));
  const mx = Math.max(1e-9, ...vals.map(Math.abs));
  const base = role === 'bat' ? [['PA', 'PA', 0], ['wOBA', 'wOBA', 3], ['xwOBA', 'xwOBA', 3], ['BABIP', 'BABIP', 3]] : [['IP', 'IP', 1], ['ERA', 'ERA', 2], ['FIP', 'FIP', 2], ['xFIP', 'xFIP', 2], ['LOB%', 'LOB%', 'pct']];
  const cols = [
    ...base.map(([k, label, d]) => ({ k, label, get: (r) => ovr(r, k), fmt: d === 'pct' ? f(k, role) : (v) => (d === 3 ? v.toFixed(3).replace('0.', '.') : v.toFixed(d)) })),
    ...defs.map(([k, label, get, fmt, title]) => ({ k, label, get: (r) => { const v = get(r); return Number.isFinite(v) ? v : null; }, fmt, title, tint: (r) => { const v = get(r); return Number.isFinite(v) ? 50 + (v / mx) * 50 : null; } })),
  ];
  return (
    <>
      <Controls role={role} setRole={setRole} season={season} setSeason={setSeason} seasons={seasons} min={min} setMin={setMin}
        extra={<><Seg value={key} onChange={setMetric} options={defs.map((d) => [d[0], d[1]])} /><Seg value={dir} onChange={setDir} options={[[-1, 'Lucky first'], [1, 'Unlucky first']]} /></>} />
      <div className="muted small">{role === 'bat' ? 'Expected stats come from exit velocity and launch angle. A gap is not destiny, but big gaps tend to shrink.' : 'FIP, xFIP and SIERA ignore balls in play luck. Positive = the ERA looks better than the skills.'} Click a column to sort.</div>
      {loading ? <div className="muted pad">Loading…</div> : <Table rows={rows} cols={cols} role={role} sortKey={key} setSortKey={(k) => setMetric(defs.some((d) => d[0] === k) ? k : metric)} dir={dir} />}
    </>
  );
}

/* ---------- platoon finder ---------- */
function Platoon({ seasons, role, setRole }) {
  const [season, setSeason] = usePref('lab:season', seasons.at(-1));
  const [min, setMin] = usePref(`lab:psplit:${role}`, role === 'bat' ? 60 : 40);
  const [side, setSide] = useState('abs');
  const { rows: all, loading } = useLoad(role, seasons, season, season);
  const rows = useMemo(() => {
    const pa = (r, s) => (role === 'bat' ? r.splits[s]?.PA : r.splits[s]?.TBF ?? r.splits[s]?.PA) ?? 0;
    const have = seasonFile(all, season).filter((r) => typeof r.splits.vsL?.wOBA === 'number' && typeof r.splits.vsR?.wOBA === 'number' && pa(r, 'vsL') >= min && pa(r, 'vsR') >= min);
    const lg = (s) => { let w = 0, n = 0; for (const r of have) { const p = pa(r, s); w += r.splits[s].wOBA * p; n += p; } return n ? w / n : 0.32; };
    const mL = lg('vsL'), mR = lg('vsR');
    return have.map((r) => { const pL = pa(r, 'vsL'), pR = pa(r, 'vsR'); const L = regress(r.splits.vsL.wOBA, pL, mL), R = regress(r.splits.vsR.wOBA, pR, mR); return { ...r, pL, pR, rawL: r.splits.vsL.wOBA, rawR: r.splits.vsR.wOBA, gap: (L - mL) - (R - mR) }; });
  }, [all, season, role, min]);
  const mx = Math.max(1e-9, ...rows.map((r) => Math.abs(r.gap)));
  const shown = rows.filter((r) => side === 'abs' || (side === 'L' ? r.gap > 0 : r.gap < 0)).map((r) => ({ ...r, ag: Math.abs(r.gap) }));
  const w3 = (v) => v.toFixed(3).replace('0.', '.');
  const cols = [{ k: 'pL', label: role === 'bat' ? 'PA vs L' : 'TBF vs L', get: (r) => r.pL, fmt: (v) => v }, { k: 'pR', label: role === 'bat' ? 'PA vs R' : 'TBF vs R', get: (r) => r.pR, fmt: (v) => v },
    { k: 'rawL', label: 'wOBA vs L', get: (r) => r.rawL, fmt: w3 }, { k: 'rawR', label: 'wOBA vs R', get: (r) => r.rawR, fmt: w3 },
    { k: 'gap', label: 'Gap (L−R, + = better vs L)', title: 'Regressed difference between the two splits, relative to the league', get: (r) => r.gap, sort: (r) => (side === 'abs' ? r.ag : r.gap), fmt: (v) => (v >= 0 ? '+' : '−') + w3(Math.abs(v)), tint: (r) => 50 + (r.gap / mx) * 50 }];
  return (
    <>
      <Controls role={role} setRole={setRole} season={season} setSeason={setSeason} seasons={seasons} extra={<>
        <label className="small">Min {role === 'bat' ? 'PA' : 'TBF'} per side <input type="number" style={{ width: 64 }} value={min} onChange={(e) => setMin(+e.target.value)} /></label>
        <Seg value={side} onChange={setSide} options={[['abs', 'Biggest gaps'], ['L', role === 'bat' ? "Better vs LHP" : "Worse vs LHB"], ['R', role === 'bat' ? 'Better vs RHP' : 'Worse vs RHB']]} /></>} />
      <div className="muted small">Each side’s wOBA is regressed toward the league mean for that side (220 PA of prior), then the two are differenced. {role === 'pit' ? 'For pitchers, wOBA is wOBA allowed, so a positive gap means worse against lefties.' : ''}</div>
      {loading ? <div className="muted pad">Loading…</div> : <Table rows={shown} cols={cols} role={role} sortKey="gap" setSortKey={() => {}} dir={-1} />}
    </>
  );
}

/* ---------- scatter ---------- */
function ScatterTool({ seasons, role, setRole }) {
  const nav = useNavigate();
  const [season, setSeason] = usePref('lab:season', seasons.at(-1));
  const [min, setMin] = usePref(`lab:min:${role}`, role === 'bat' ? 200 : 60);
  const [xk, setXk] = usePref(`lab:x:${role}`, role === 'bat' ? 'K%' : 'K%');
  const [yk, setYk] = usePref(`lab:y:${role}`, role === 'bat' ? 'wRC+' : 'ERA');
  const [q, setQ] = useState('');
  const { rows: all, loading } = useLoad(role, seasons, season, season);
  const rows = useMemo(() => seasonFile(all, season).filter((r) => (role === 'bat' ? (ovr(r, 'PA') ?? 0) : (ovr(r, 'IP') ?? 0)) >= min), [all, season, role, min]);
  const keys = useMemo(() => statKeys(rows.slice(0, 300)), [rows]);
  const pts = rows.map((r) => ({ key: r.id, x: ovr(r, xk), y: ovr(r, yk), label: `${r.name} (${r.team})`, id: r.id, hot: !!q && r.name.toLowerCase().includes(q.toLowerCase()) })).filter((p) => typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y));
  const sel = (v, set) => <select value={v} onChange={(e) => set(e.target.value)}>{keys.map((k) => <option key={k} value={k}>{statDef(k, role).label}</option>)}</select>;
  return (
    <>
      <Controls role={role} setRole={setRole} season={season} setSeason={setSeason} seasons={seasons} min={min} setMin={setMin} extra={<>
        <label className="small">X {sel(xk, setXk)}</label><label className="small">Y {sel(yk, setYk)}</label>
        <input placeholder="Highlight a player…" value={q} onChange={(e) => setQ(e.target.value)} /></>} />
      {loading ? <div className="muted pad">Loading…</div> : <Scatter points={pts} fx={f(xk, role)} fy={f(yk, role)} xLabel={statDef(xk, role).label} yLabel={statDef(yk, role).label} onPick={(p) => nav(`/player/${role}/${p.id}?season=${season}`)} />}
      <div className="muted small">Click a dot to open the player. The dashed line is the least-squares fit.</div>
    </>
  );
}

/* ---------- aging ---------- */
function Aging({ seasons, role, setRole }) {
  const [stat, setStat] = usePref(`lab:aging:${role}`, role === 'bat' ? 'WAR' : 'WAR');
  const [min, setMin] = usePref(`lab:agemin:${role}`, role === 'bat' ? 300 : 80);
  const { rows: all, loading, loaded, total } = useLoad(role, seasons, seasons[0], seasons.at(-1));
  const keys = useMemo(() => statKeys(all.slice(0, 400)), [all]);
  const deltas = useMemo(() => agingDeltas(all.filter((r) => (role === 'bat' ? (ovr(r, 'PA') ?? 0) : (ovr(r, 'IP') ?? 0)) >= min).map((r) => ({ id: r.id, season: r.season, age: ovr(r, 'Age'), v: ovr(r, stat) })), 12), [all, role, min, stat]);
  const fm = f(stat, role); const d = statDef(stat, role);
  return (
    <>
      <Controls role={role} setRole={setRole} min={min} setMin={setMin} extra={<label className="small">Stat <select value={stat} onChange={(e) => setStat(e.target.value)}>{keys.map((k) => <option key={k} value={k}>{statDef(k, role).label}</option>)}</select></label>} />
      <div className="muted small">For every player with two qualifying consecutive seasons ({seasons[0]}–{seasons.at(-1)}), the change from age <i>a</i> to <i>a</i>+1, averaged. Survivor bias applies: players who decline sharply often stop qualifying.</div>
      {loading ? <div className="muted pad">Loading {loaded}/{total} seasons…</div> : !deltas.length ? <div className="muted pad">Not enough data.</div> : (
        <div className="box-grid">
          <div><h4>Average change at each age</h4><LineChart series={[{ label: `${d.label} change`, points: deltas.map((x) => ({ x: x.age, y: x.delta })) }]} fmt={(v) => (v >= 0 ? '+' : '') + (Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1))} /></div>
          <div><h4>Cumulative curve (from the youngest age)</h4><LineChart series={[{ label: d.label, points: cumulative(deltas).map((x) => ({ x: x.age, y: x.v })) }]} fmt={(v) => v.toFixed(Math.abs(v) < 1 ? 3 : 1)} /></div>
        </div>)}
      {deltas.length > 0 && <div className="scroll" style={{ maxWidth: 520 }}><table className="t sm"><thead><tr><th>Age → +1</th><th>Players</th><th>Avg change in {d.label}</th></tr></thead>
        <tbody>{deltas.map((x) => <tr key={x.age}><td>{x.age}</td><td>{x.n}</td><td className="mono" style={tint(50 + (x.delta / Math.max(...deltas.map((z) => Math.abs(z.delta)))) * 50 * (d.dir || 1), 40)}>{x.delta >= 0 ? '+' : ''}{Math.abs(x.delta) < 1 ? x.delta.toFixed(3) : x.delta.toFixed(2)}</td></tr>)}</tbody></table></div>}
    </>
  );
}

/* ---------- similar players ---------- */
const SIM_DEFAULT = { bat: ['K%', 'BB%', 'ISO', 'BABIP', 'Barrel%', 'HardHit%', 'EV', 'Spd', 'GB%', 'Pull%'], pit: ['K%', 'BB%', 'GB%', 'HR/9', 'FBv', 'SwStr%', 'CSW%', 'O-Swing%'] };
function Similar({ seasons, role, setRole }) {
  const [qs, setQs] = useSearchParams();
  const pid = Number(qs.get('p')) || null; const psn = Number(qs.get('s')) || null; const prole = qs.get('r') || role;
  const [stats, setStats] = usePref(`lab:sim:${role}`, SIM_DEFAULT[role]);
  const [min, setMin] = usePref(`lab:min:${role}`, role === 'bat' ? 200 : 60);
  const [edit, setEdit] = useState(false);
  const [file, setFile] = useState(null);
  const { rows: all, loading, loaded, total } = useLoad(role, seasons, seasons[0], seasons.at(-1));
  useEffect(() => { setFile(null); if (pid) load(`players/${prole}/${pid}.json`).then(setFile, () => setFile(null)); }, [pid, prole]);
  const pool = useMemo(() => all.filter((r) => (role === 'bat' ? (ovr(r, 'PA') ?? 0) : (ovr(r, 'IP') ?? 0)) >= min).map((r) => ({ ...r, flat: r.splits.all || {} })), [all, role, min]);
  const keys = useMemo(() => statKeys(all.slice(0, 400)), [all]);
  const flatKeys = stats.filter((k) => keys.includes(k));
  const z = useMemo(() => zStats(pool.map((r) => r.flat), flatKeys), [pool, flatKeys.join()]); // eslint-disable-line
  const me = file && psn ? file.seasons[psn]?.splits?.all : null;
  const hits = useMemo(() => (me ? pool.filter((r) => !(r.id === pid && r.season === psn)).map((r) => ({ r, d: zDistance(me, r.flat, z) })).filter((x) => x.d != null).sort((a, b) => a.d - b.d).slice(0, 15) : []), [pool, me, z, pid, psn]);
  const myYears = file ? Object.keys(file.seasons).map(Number).sort((a, b) => b - a) : [];
  return (
    <>
      <Controls role={role} setRole={(r) => { setRole(r); setQs({ tool: 'similar' }); }} min={min} setMin={setMin} extra={<button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `Compare on ${flatKeys.length} stats`}</button>} />
      <div className="row"><PlayerSearch role={role} placeholder={`Find a ${role === 'bat' ? 'hitter' : 'pitcher'}…`} onPick={(p) => { const s = p.last || seasons.at(-1); setQs({ tool: 'similar', p: p.id, r: role, s }); }} />
        {file && <><b>{file.name}</b><select value={psn || ''} onChange={(e) => setQs({ tool: 'similar', p: pid, r: prole, s: e.target.value })}>{myYears.map((y) => <option key={y}>{y}</option>)}</select></>}</div>
      {edit && <StatPicker keys={keys} role={role} value={stats} onChange={setStats} />}
      <div className="muted small">Distance is the RMS z-score difference across the chosen stats among {role === 'bat' ? 'hitters' : 'pitchers'} with at least {min} {role === 'bat' ? 'PA' : 'IP'}; 100 = identical. It measures style, not value.</div>
      {loading && <div className="muted pad">Loading {loaded}/{total} seasons…</div>}
      {!loading && !me && <div className="muted pad">Search for a player to see their closest matches across every season.</div>}
      {hits.length > 0 && (
        <div className="scroll"><table className="t sticky-first"><thead><tr><th className="l">Player</th><th>Season</th><th className="l">Team</th><th>Match</th>{flatKeys.slice(0, 8).map((k) => <th key={k}>{statDef(k, role).label}</th>)}</tr></thead>
          <tbody>
            <tr className="sel"><td className="l"><b>{file?.name}</b></td><td>{psn}</td><td className="l">{file.seasons[psn].team}</td><td>—</td>{flatKeys.slice(0, 8).map((k) => <td key={k} className="mono">{f(k, role)(me[k])}</td>)}</tr>
            {hits.map(({ r, d }) => <tr key={r.id + ':' + r.season}><td className="l"><Link to={`/player/${role}/${r.id}?season=${r.season}`}>{r.name}</Link></td><td>{r.season}</td><td className="l">{r.team}</td><td className="mono" style={tint(similarity(d), 40)}>{similarity(d)}</td>{flatKeys.slice(0, 8).map((k) => <td key={k} className="mono">{f(k, role)(r.flat[k])}</td>)}</tr>)}</tbody></table></div>)}
    </>
  );
}

export default function Lab({ index }) {
  const [qs, setQs] = useSearchParams();
  const tool = TOOLS.some((t) => t[0] === qs.get('tool')) ? qs.get('tool') : 'luck';
  const [role, setRole] = usePref('lab:role', 'bat');
  const seasons = index.seasons;
  const T = { luck: Luck, platoon: Platoon, scatter: ScatterTool, aging: Aging, similar: Similar }[tool];
  const info = TOOLS.find((t) => t[0] === tool);
  return (
    <>
      <section className="panel"><h2 style={{ margin: 0 }}>Sabermetrics lab</h2><div className="muted small">Tools built on the same season and split data as the rest of the app.</div></section>
      <div className="tabs">{TOOLS.map(([id, label]) => <button type="button" key={id} className={id === tool ? 'on' : ''} onClick={() => setQs({ tool: id })}>{label}</button>)}</div>
      <section className="panel"><h3>{info[1]} <span className="muted small">{info[2]}</span></h3><T key={tool + role} seasons={seasons} role={role} setRole={setRole} /></section>
    </>
  );
}
