import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData, usePlayerFile, usePref, useSeason } from '../lib/data.js';
import { SPLITS, direction, keysOfSeasons, splitLabel, statDef } from '../lib/catalog.js';
import { SECTIONS, sectionIds, sectionKeys, sectionLabel } from '../lib/sections.js';
import { peerPool, percentile } from '../lib/stats.js';
import { Bubble, Headshot, Seg, SeasonSelect, SplitSeg, StatPicker } from '../components/ui.jsx';
import { LineChart, Spark, seriesColor } from '../components/charts.jsx';
import { pctColor } from '../lib/themes.js';

const SPECIAL = { summary: 'Key stats', percentiles: 'Percentile rankings', trend: 'Trends', splits: 'Left / right splits' };
const label = (role, id) => SPECIAL[id] || sectionLabel(role, id);
const defaultOrder = (role) => ['summary', 'percentiles', 'trend', 'splits', ...sectionIds(role)];
const DEFAULT_LAYOUT = { hidden: ['all'], wide: [], cols: 2, custom: {}, tableSplit: {} };
const WIDE = new Set(['dashboard', 'standard', 'advanced', 'battedBall', 'discipline', 'statcast', 'batTracking', 'pitchInfo', 'pitchValues', 'stuff', 'winProb', 'value', 'all']);
const SUMMARY = { bat: ['PA', 'AVG', 'OBP', 'SLG', 'wOBA', 'xwOBA', 'wRC+', 'HR', 'SB', 'WAR'], pit: ['IP', 'ERA', 'FIP', 'xFIP', 'K%', 'BB%', 'WHIP', 'sc_xwOBA', 'WAR'] };
const PCT_DEFAULT = { bat: ['xwOBA', 'xAVG', 'xSLG', 'EV', 'maxEV', 'Barrel%', 'HardHit%', 'K%', 'BB%', 'Spd', 'SwStr%', 'O-Swing%', 'AvgBatSpeed'], pit: ['xERA', 'FIP', 'K%', 'BB%', 'SwStr%', 'CStr%', 'GB%', 'Barrel%', 'HardHit%', 'EV', 'FBv', 'sp_stuff'] };

export default function Player({ index }) {
  const { role, id: idp } = useParams();
  const id = Number(idp);
  const [qs, setQs] = useSearchParams();
  const { data: file, error } = usePlayerFile(role, id);
  const { data: pindex } = useData('players-index.json');
  const [layout, setLayout] = usePref(`player:layout:${role}`, DEFAULT_LAYOUT);
  const L = { ...DEFAULT_LAYOUT, ...layout, order: layout.order || defaultOrder(role) };
  const order = [...L.order.filter((s) => defaultOrder(role).includes(s)), ...defaultOrder(role).filter((s) => !L.order.includes(s))];
  const [cfg, setCfg] = useState(false);

  const seasons = useMemo(() => (file ? Object.keys(file.seasons).map(Number).sort((a, b) => a - b) : []), [file]);
  const season = Number(qs.get('season')) || seasons.at(-1);
  const split = qs.get('split') || 'all';
  const setParam = (k, v) => setQs((q) => { const n = new URLSearchParams(q); if (v == null || v === 'all' && k === 'split') n.delete(k); else n.set(k, v); return n; }, { replace: true });
  const allKeys = useMemo(() => (file ? [...keysOfSeasons(file.seasons)].sort((a, b) => a.localeCompare(b)) : []), [file]);
  const keySet = useMemo(() => new Set(allKeys), [allKeys]);
  const { data: seasonFile } = useSeason(season, role);
  const cur = file?.seasons?.[season];

  useEffect(() => { document.title = file ? `${file.name} · MLB Stats` : 'MLB Stats'; }, [file]);
  if (error) return <div className="panel">No {role === 'bat' ? 'hitter' : 'pitcher'} found with id {id}. <Link to="/">Back</Link></div>;
  if (!file) return <div className="muted pad">Loading…</div>;
  if (!cur) return <div className="panel">No {season} data for {file.name}.</div>;

  const set = (patch) => setLayout({ ...L, ...patch });
  const move = (k, d) => { const o = [...order]; const i = o.indexOf(k), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; set({ order: o }); };
  const toggle = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const visible = order.filter((s) => !L.hidden.includes(s));
  const otherRole = pindex?.find((p) => p.id === id)?.r.find((r) => r !== role);
  const line = cur.splits[split] || {};
  const age = cur.splits.all?.Age;

  const ctx = { role, file, seasons, season, split, cur, allKeys, keySet, seasonFile, L, set, setSeason: (y) => setParam('season', y) };
  const renderSection = (s) => {
    if (s === 'summary') return <Summary {...ctx} />;
    if (s === 'percentiles') return <Percentiles {...ctx} />;
    if (s === 'trend') return <Trend {...ctx} />;
    if (s === 'splits') return <SplitsCard {...ctx} />;
    return <DataSection {...ctx} id={s} />;
  };

  return (
    <>
      <section className="hero-card panel">
        <Headshot id={id} size={104} className="big" />
        <div className="grow">
          <h1 style={{ margin: 0 }}>{file.name}</h1>
          <div className="muted">{cur.team} · {season}{age ? ` · Age ${age}` : ''} · {role === 'bat' ? 'Hitter' : 'Pitcher'}{otherRole && <> · <Link to={`/player/${otherRole}/${id}`}>{otherRole === 'bat' ? 'Hitting' : 'Pitching'} page</Link></>}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <SeasonSelect seasons={seasons} value={season} onChange={(y) => setParam('season', y)} />
            <SplitSeg role={role} value={split} onChange={(v) => setParam('split', v)} />
            <Link className="btn" to={`/compare?p=${role}:${id}:${season}`}>Compare</Link>
            <button type="button" className="btn" onClick={() => setCfg(!cfg)}>{cfg ? 'Close layout' : '⚙ Customize page'}</button>
          </div>
        </div>
        <div className="hero-tiles">
          {SUMMARY[role].slice(0, 5).map((k) => { const d = statDef(k, role); return <div className="tile" key={k}><div className="k">{d.label}</div><div className="v">{d.f(line[k])}</div></div>; })}
        </div>
      </section>

      {cfg && (
        <section className="panel">
          <div className="row between"><b>Page sections</b>
            <span className="row"><button type="button" className="btn sm" onClick={() => set({ hidden: [] })}>Show all</button>
              <button type="button" className="btn sm" onClick={() => set({ hidden: order })}>Hide all</button>
              <button type="button" className="btn sm" onClick={() => setLayout(DEFAULT_LAYOUT)}>Reset</button></span></div>
          <div className="cfg-grid">
            {order.map((k) => (
              <div className="cfg-row" key={k}>
                <label><input type="checkbox" checked={!L.hidden.includes(k)} onChange={() => set({ hidden: toggle(L.hidden, k) })} /> {label(role, k)}</label>
                <span className="row"><label className="small muted"><input type="checkbox" checked={L.wide.includes(k) || WIDE.has(k)} disabled={WIDE.has(k)} onChange={() => set({ wide: toggle(L.wide, k) })} /> full width</label>
                  <button type="button" className="btn sm" onClick={() => move(k, -1)}>↑</button><button type="button" className="btn sm" onClick={() => move(k, 1)}>↓</button></span>
              </div>))}
          </div>
          <div className="row" style={{ marginTop: 8 }}><label>Columns for tiles <select value={L.cols} onChange={(e) => set({ cols: +e.target.value })}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>
            <span className="muted small">Colors, fonts and themes are under 🎨 Theme in the top bar. Each section also has “Choose stats”.</span></div>
        </section>)}

      <div className="jump">{visible.map((s) => <a key={s} href={`#sec-${s}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label(role, s)}</a>)}</div>

      <div className="grid" style={{ '--cols': L.cols }}>
        {visible.map((s) => (
          <section id={`sec-${s}`} key={s} className={'panel card' + (L.wide.includes(s) || WIDE.has(s) ? ' span' : '')}>
            <h3>{label(role, s)}</h3>{renderSection(s)}
          </section>))}
      </div>
    </>
  );
}

/* ---------- key stat tiles ---------- */
function Summary({ role, seasons, season, split, file, allKeys, setSeason }) {
  const [sel, setSel] = usePref(`summary:${role}`, SUMMARY[role]);
  const [edit, setEdit] = useState(false);
  const si = seasons.indexOf(season);
  return (
    <>
      <div className="tiles">
        {sel.map((k) => {
          const d = statDef(k, role);
          const v = file.seasons[season]?.splits[split]?.[k];
          const prev = si > 0 ? file.seasons[seasons[si - 1]]?.splits[split]?.[k] : null;
          const delta = typeof v === 'number' && typeof prev === 'number' ? v - prev : null;
          const trend = seasons.slice(Math.max(0, si - 7), si + 1).map((y) => file.seasons[y]?.splits[split]?.[k] ?? null);
          const good = delta == null || !d.dir ? '' : (delta * d.dir > 0 ? 'up' : delta * d.dir < 0 ? 'down' : '');
          return (
            <div className="tile big" key={k} title={d.desc}>
              <div className="k">{d.label}</div><div className="v">{d.f(v)}</div>
              <div className="row between"><span className={'delta ' + good}>{delta == null ? '' : `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''} ${d.f(Math.abs(delta))}`}</span><Spark values={trend} /></div>
            </div>);
        })}
      </div>
      <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button>
      {edit && <StatPicker keys={allKeys} role={role} value={sel} onChange={setSel} max={30} />}
    </>
  );
}

/* ---------- Savant-style percentile rankings ---------- */
function Percentiles({ role, season, split, cur, allKeys, seasonFile }) {
  const [sel, setSel] = usePref(`pct:${role}`, PCT_DEFAULT[role]);
  const [minQ, setMinQ] = usePref(`pct:min:${role}`, role === 'bat' ? 100 : 30);
  const [edit, setEdit] = useState(false);
  const scale = split === 'all' ? 1 : 0.4;
  const pool = useMemo(() => (seasonFile ? peerPool(seasonFile.players, split, role === 'bat' ? { minPA: minQ * scale } : { minIP: minQ * scale }) : []), [seasonFile, split, minQ, role, scale]);
  const line = cur.splits[split];
  return (
    <>
      <div className="row between"><span className="muted small">{season} · vs {pool.length || '…'} {role === 'bat' ? 'hitters' : 'pitchers'} ({splitLabel(split, role)}, min {Math.round(minQ * scale)} {role === 'bat' ? 'PA' : 'IP'})</span>
        <span className="row"><label className="small">Min <input type="number" style={{ width: 64 }} value={minQ} onChange={(e) => setMinQ(+e.target.value)} /></label>
          <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Customize'}</button></span></div>
      {edit && <StatPicker keys={allKeys} role={role} value={sel} onChange={setSel} max={40} />}
      {!line && <div className="muted">No data for this split.</div>}
      {line && sel.map((k) => {
        const d = statDef(k, role); const v = line[k];
        const p = d.dir ? percentile(pool.map((r) => r.splits[split]?.[k]), v, d.dir < 0) : null;
        return (
          <div className="pct" key={k} title={d.desc}>
            <span>{d.label}</span>
            <div className="bar">{p != null && <><i style={{ width: p + '%', background: pctColor(p) }} /><b style={{ left: `clamp(13px, ${p}%, calc(100% - 13px))`, background: pctColor(p) }}>{p}</b></>}</div>
            <span className="mono val">{d.f(v)}</span>
          </div>);
      })}
    </>
  );
}

/* ---------- trend chart ---------- */
function Trend({ role, seasons, file, allKeys, split }) {
  const [key, setKey] = usePref(`trend:${role}`, role === 'bat' ? 'wRC+' : 'ERA');
  const [mode, setMode] = usePref('trend:mode', 'page');
  const d = statDef(key, role);
  const splits = mode === 'all3' ? SPLITS.map((s) => s[0]) : [split];
  const series = splits.map((sp) => ({ label: `${d.label} · ${splitLabel(sp, role)}`, points: seasons.map((y) => ({ x: y, y: file.seasons[y]?.splits[sp]?.[key] ?? null })) }));
  return (
    <>
      <div className="row">
        <select value={key} onChange={(e) => setKey(e.target.value)}>{allKeys.map((k) => <option key={k} value={k}>{statDef(k, role).label}</option>)}</select>
        <Seg small value={mode} onChange={setMode} options={[['page', 'Selected split'], ['all3', 'All / L / R']]} />
      </div>
      <LineChart series={series} fmt={d.f} />
      {mode === 'all3' && <div className="legend">{series.map((s, i) => <span key={i}><i style={{ background: seriesColor(i) }} />{s.label}</span>)}</div>}
    </>
  );
}

/* ---------- this-season all / L / R ---------- */
function SplitsCard({ role, cur, allKeys, keySet, L, set }) {
  const [secId, setSecId] = usePref(`splitsec:${role}`, 'standard');
  const avail = new Set(Object.values(cur.splits).flatMap((s) => Object.keys(s)));
  const custom = L.custom[`splits:${secId}`];
  const keys = custom || sectionKeys(role, secId, avail);
  const [edit, setEdit] = useState(false);
  return (
    <>
      <div className="row"><select value={secId} onChange={(e) => setSecId(e.target.value)}>{sectionIds(role).map((s) => <option key={s} value={s}>{sectionLabel(role, s)}</option>)}</select>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button></div>
      {edit && <StatPicker keys={allKeys} role={role} value={keys} onChange={(v) => set({ custom: { ...L.custom, [`splits:${secId}`]: v } })} />}
      <div className="scroll"><table className="t"><thead><tr><th className="l">Stat</th>{SPLITS.map(([s]) => <th key={s}>{splitLabel(s, role)}</th>)}</tr></thead>
        <tbody>{keys.map((k) => { const d = statDef(k, role); return <tr key={k}><td className="l" title={d.desc}>{d.label}</td>{SPLITS.map(([s]) => <td key={s} className="mono">{d.f(cur.splits[s]?.[k])}</td>)}</tr>; })}</tbody></table></div>
      <div className="muted small">Not every stat has an L/R split; missing ones show “—”.</div>
    </>
  );
}

/* ---------- season-by-season section tables (FanGraphs / Savant sections) ---------- */
function DataSection({ role, id, seasons, season, split, file, allKeys, keySet, L, set, setSeason }) {
  const secSplit = L.tableSplit[id] || 'page';
  const sp = secSplit === 'page' ? split : secSplit;
  const keys = L.custom[id] || sectionKeys(role, id, keySet);
  const [edit, setEdit] = useState(false);
  const [rev, setRev] = usePref('table:rev', false);
  const ys = rev ? [...seasons].reverse() : seasons;
  if (!keys.length && !edit) return <div className="muted">No {sectionLabel(role, id)} stats in this player’s data. <button type="button" className="btn sm" onClick={() => setEdit(true)}>Choose stats</button></div>;
  return (
    <>
      <div className="row">
        <select value={secSplit} onChange={(e) => set({ tableSplit: { ...L.tableSplit, [id]: e.target.value } })} title="Split for this table">
          <option value="page">Split: page ({splitLabel(split, role)})</option>{SPLITS.map(([s]) => <option key={s} value={s}>{splitLabel(s, role)}</option>)}
        </select>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `Choose stats (${keys.length})`}</button>
        <button type="button" className="btn sm" onClick={() => setRev(!rev)}>{rev ? 'Newest first' : 'Oldest first'}</button>
        {L.custom[id] && <button type="button" className="btn sm" onClick={() => { const c = { ...L.custom }; delete c[id]; set({ custom: c }); }}>Reset stats</button>}
      </div>
      {edit && <StatPicker keys={allKeys} role={role} value={keys} onChange={(v) => set({ custom: { ...L.custom, [id]: v } })} />}
      <div className="scroll"><table className="t sticky-first"><thead><tr><th className="l">Season</th><th className="l">Team</th>{keys.map((k) => <th key={k} title={statDef(k, role).desc}>{statDef(k, role).label}</th>)}</tr></thead>
        <tbody>{ys.map((y) => { const e = file.seasons[y]; return (
          <tr key={y} className={y === season ? 'sel' : ''} onClick={() => setSeason(y)}><td className="l"><b>{y}</b></td><td className="l">{e.team}</td>
            {keys.map((k) => <td key={k} className="mono">{statDef(k, role).f(e.splits[sp]?.[k])}</td>)}</tr>); })}</tbody></table></div>
      <div className="muted small">Click a row to make that the selected season. {sp !== 'all' && 'Splits cover a subset of stats; others show “—”.'}</div>
    </>
  );
}
