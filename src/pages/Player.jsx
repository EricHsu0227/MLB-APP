import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData, usePlayerFile, usePref, useSeason } from '../lib/data.js';
import { SPLITS, keysOfSeasons, splitLabel, statDef } from '../lib/catalog.js';
import { sectionKeys, sectionLabel } from '../lib/sections.js';
import { favFirst, useFavs, useSectionOrder } from '../lib/favs.js';
import { heat, peerPool, percentile } from '../lib/stats.js';
import { Headshot, Seg, SeasonSelect, SplitSeg, StatPicker } from '../components/ui.jsx';
import { LineChart, Spark, seriesColor } from '../components/charts.jsx';
import { pctColor, tint } from '../lib/themes.js';
import GameLog from '../components/GameLog.jsx';
import RecentGames from '../components/RecentGames.jsx';
import Details from '../components/Details.jsx';

const TABS = [['overview', 'Overview'], ['percentiles', 'Percentile ranking'], ['stats', 'Stats'], ['games', 'Game logs'], ['trends', 'Trends'], ['details', 'Player details']];
const DEFAULT_LAYOUT = { hidden: [], custom: {}, tableSplit: {} };
const hasDir = (k, role) => !!statDef(k, role).dir;

export default function Player({ index }) {
  const { role, id: idp } = useParams();
  const id = Number(idp);
  const [qs, setQs] = useSearchParams();
  const { data: file, error } = usePlayerFile(role, id);
  const { data: pindex } = useData('players-index.json');
  const [favs] = useFavs(role);

  const seasons = useMemo(() => (file ? Object.keys(file.seasons).map(Number).sort((a, b) => a - b) : []), [file]);
  const season = Number(qs.get('season')) || seasons.at(-1);
  const split = qs.get('split') || 'all';
  const tab = TABS.some(([t]) => t === qs.get('tab')) ? qs.get('tab') : 'overview';
  const setParam = (k, v) => setQs((q) => { const n = new URLSearchParams(q); if (v == null || (v === 'all' && k === 'split') || (v === 'overview' && k === 'tab')) n.delete(k); else n.set(k, v); return n; }, { replace: true });
  const allKeys = useMemo(() => (file ? [...keysOfSeasons(file.seasons)].sort((a, b) => a.localeCompare(b)) : []), [file]);
  const keySet = useMemo(() => new Set(allKeys), [allKeys]);
  const { data: seasonFile } = useSeason(season, role);
  const cur = file?.seasons?.[season];

  useEffect(() => { document.title = file ? `${file.name} · MLB Stats` : 'MLB Stats'; }, [file]);
  if (error) return <div className="panel">No {role === 'bat' ? 'hitter' : 'pitcher'} found with id {id}. <Link to="/leaderboard">Back to the leaderboard</Link></div>;
  if (!file) return <div className="muted pad">Loading…</div>;
  if (!cur) return <div className="panel">No {season} data for {file.name}.</div>;

  const otherRole = pindex?.find((p) => p.id === id)?.r.find((r) => r !== role);
  const line = cur.splits[split] || {};
  const age = cur.splits.all?.Age;
  const ctx = { id, role, file, seasons, season, split, cur, allKeys, keySet, seasonFile, favs, setSeason: (y) => setParam('season', y), goto: (t) => setParam('tab', t) };
  const heroKeys = favs.filter((k) => keySet.has(k)).slice(0, 5);

  return (
    <>
      <section className="hero-card panel">
        <Headshot id={id} size={80} className="big" />
        <div className="grow">
          <h1 style={{ margin: 0 }}>{file.name}</h1>
          <div className="muted">{cur.team} · {season}{age ? ` · Age ${age}` : ''} · {role === 'bat' ? 'Hitter' : 'Pitcher'}{otherRole && <> · <Link to={`/player/${otherRole}/${id}`}>{otherRole === 'bat' ? 'Hitting' : 'Pitching'} page</Link></>}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <SeasonSelect seasons={seasons} value={season} onChange={(y) => setParam('season', y)} />
            <SplitSeg role={role} value={split} onChange={(v) => setParam('split', v)} />
            <Link className="btn" to={`/compare?p=${role}:${id}:${season}`}>Compare</Link>
          </div>
        </div>
        <div className="hero-tiles">
          {heroKeys.map((k) => { const d = statDef(k, role); return <div className="tile" key={k} title={d.desc}><div className="k">{d.label}</div><div className="v">{d.f(line[k])}</div></div>; })}
        </div>
      </section>

      <div className="tabs ptabs" role="tablist">
        {TABS.map(([t, l]) => <button type="button" role="tab" aria-selected={tab === t} key={t} className={tab === t ? 'on' : ''} onClick={() => setParam('tab', t)}>{l}</button>)}
      </div>

      {tab === 'overview' && <Overview {...ctx} />}
      {tab === 'percentiles' && <section className="panel card"><h3>Percentile ranking</h3><PercentileTab {...ctx} /></section>}
      {tab === 'stats' && <StatsTab {...ctx} />}
      {tab === 'games' && <section className="panel card"><h3>Game logs</h3><GameLog {...ctx} /></section>}
      {tab === 'trends' && <TrendsTab {...ctx} />}
      {tab === 'details' && <Details {...ctx} />}
    </>
  );
}

/* ---------- shared percentile bars ---------- */
function usePool(seasonFile, split, role, minQ) {
  const scale = split === 'all' ? 1 : 0.4;
  return useMemo(() => (seasonFile ? peerPool(seasonFile.players, split, role === 'bat' ? { minPA: minQ * scale } : { minIP: minQ * scale }) : []), [seasonFile, split, minQ, role, scale]);
}
function PctBars({ role, split, line, pool, keys }) {
  if (!line) return <div className="muted">No data for this split.</div>;
  return (
    <div className="pct-grid">{keys.map((k) => {
      const d = statDef(k, role); const v = line[k];
      const p = d.dir ? percentile(pool.map((r) => r.splits[split]?.[k]), v, d.dir < 0) : null;
      return (
        <div className="pct" key={k} title={d.desc}>
          <span>{d.label}</span>
          <div className="bar">{p != null && <><i style={{ width: p + '%', background: pctColor(p) }} /><b style={{ left: `clamp(13px, ${p}%, calc(100% - 13px))`, background: pctColor(p) }}>{p}</b></>}</div>
          <span className="mono val">{d.f(v)}</span>
        </div>);
    })}</div>
  );
}

/* ---------- overview ---------- */
const OV_DEFAULT = { tiles: null, pct: null, games: 8, show: { tiles: true, pct: true, recent: true } };
function Overview(ctx) {
  const { role, season, split, file, seasons, cur, allKeys, keySet, seasonFile, favs, goto, id } = ctx;
  const [ov, setOv] = usePref(`ov2:${role}`, OV_DEFAULT);
  const O = { ...OV_DEFAULT, ...ov, show: { ...OV_DEFAULT.show, ...ov.show } };
  const [edit, setEdit] = useState(false);
  const tileKeys = (O.tiles || favs).filter((k) => keySet.has(k)).slice(0, 12);
  const pctKeys = (O.pct || favs.filter((k) => hasDir(k, role))).filter((k) => keySet.has(k)).slice(0, 14);
  const pool = usePool(seasonFile, split, role, role === 'bat' ? 100 : 30);
  const si = seasons.indexOf(season);
  const set = (patch) => setOv({ ...O, ...patch });
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="muted small">Your favorite stats lead here. Change them in <Link to="/settings">Settings</Link>.</span>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : '⚙ Customize overview'}</button>
      </div>
      {edit && (
        <section className="panel">
          <div className="row">
            {[['tiles', 'Stat tiles'], ['pct', 'Percentile ranking'], ['recent', 'Recent games']].map(([k, l]) => <label key={k} className="small row"><input type="checkbox" checked={O.show[k]} onChange={(e) => set({ show: { ...O.show, [k]: e.target.checked } })} /> {l}</label>)}
            <label className="small">Recent games <select value={O.games} onChange={(e) => set({ games: +e.target.value })}>{[5, 8, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
            <button type="button" className="btn sm" onClick={() => setOv(OV_DEFAULT)}>Back to my stats</button>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Tiles ({tileKeys.length})</div>
          <StatPicker keys={allKeys} role={role} value={tileKeys} onChange={(v) => set({ tiles: v })} max={12} />
          <div className="muted small" style={{ marginTop: 8 }}>Percentile bars ({pctKeys.length})</div>
          <StatPicker keys={allKeys.filter((k) => hasDir(k, role))} role={role} value={pctKeys} onChange={(v) => set({ pct: v })} max={24} />
        </section>)}
      {O.show.tiles && (
        <section className="panel card">
          <div className="tiles">
            {tileKeys.map((k) => {
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
            {!tileKeys.length && <span className="muted">No stats selected.</span>}
          </div>
        </section>)}
      {(O.show.pct || O.show.recent) && (
        <div className="grid ov-grid" style={{ '--cols': O.show.pct && O.show.recent ? 2 : 1 }}>
          {O.show.pct && <section className="panel card"><h3>Percentile ranking</h3>
            <div className="muted small">{season} · vs {pool.length || '…'} {role === 'bat' ? 'hitters' : 'pitchers'} · {splitLabel(split, role)}</div>
            <PctBars role={role} split={split} line={cur.splits[split]} pool={pool} keys={pctKeys} />
            <button type="button" className="btn sm" onClick={() => goto('percentiles')}>Full percentile ranking →</button></section>}
          {O.show.recent && <section className="panel card"><h3>Recent games · {season}</h3><RecentGames id={id} role={role} season={season} n={O.games} onMore={() => goto('games')} /></section>}
        </div>)}
    </>
  );
}

/* ---------- percentile ranking tab ---------- */
function PercentileTab({ role, season, split, cur, allKeys, seasonFile, favs }) {
  const [sel, setSel] = usePref(`pct2:${role}`, null);
  const [minQ, setMinQ] = usePref(`pct:min:${role}`, role === 'bat' ? 100 : 30);
  const [edit, setEdit] = useState(false);
  const keys = sel || favs.filter((k) => hasDir(k, role));
  const scale = split === 'all' ? 1 : 0.4;
  const pool = usePool(seasonFile, split, role, minQ);
  return (
    <>
      <div className="row between"><span className="muted small">{season} · vs {pool.length || '…'} {role === 'bat' ? 'hitters' : 'pitchers'} ({splitLabel(split, role)}, min {Math.round(minQ * scale)} {role === 'bat' ? 'PA' : 'IP'})</span>
        <span className="row"><label className="small">Min {role === 'bat' ? 'PA' : 'IP'} <input type="number" style={{ width: 64 }} value={minQ} onChange={(e) => setMinQ(+e.target.value)} /></label>
          {sel && <button type="button" className="btn sm" onClick={() => setSel(null)}>My stats</button>}
          <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button></span></div>
      {edit && <StatPicker keys={allKeys.filter((k) => hasDir(k, role))} role={role} value={keys} onChange={setSel} max={60} />}
      <PctBars role={role} split={split} line={cur.splits[split]} pool={pool} keys={keys.filter((k) => cur.splits[split]?.[k] != null || true)} />
    </>
  );
}

/* ---------- stats tab: L/R snapshot + season-by-season FanGraphs/Savant sections ---------- */
function StatsTab(ctx) {
  const { role, keySet, favs } = ctx;
  const [layout, setLayout] = usePref(`p2:layout:${role}`, DEFAULT_LAYOUT);
  const L = { ...DEFAULT_LAYOUT, ...layout };
  const set = (patch) => setLayout({ ...L, ...patch });
  const order = useSectionOrder(role, keySet, favs);
  const visible = order.filter((s) => !L.hidden.includes(s));
  const [sec, setSec] = usePref(`stats:sec:${role}`, 'splits');
  const [edit, setEdit] = useState(false);
  const active = sec === 'splits' || visible.includes(sec) ? sec : 'splits';
  return (
    <>
      <div className="tabs sub">
        <button type="button" className={active === 'splits' ? 'on' : ''} onClick={() => setSec('splits')}>This season: All / L / R</button>
        {visible.map((s) => <button type="button" key={s} className={active === s ? 'on' : ''} onClick={() => setSec(s)}>{sectionLabel(role, s)}</button>)}
        <button type="button" className="gear" onClick={() => setEdit(!edit)} title="Show or hide sections">⚙</button>
      </div>
      {edit && <section className="panel"><div className="row">{order.map((s) => <label key={s} className="small row"><input type="checkbox" checked={!L.hidden.includes(s)} onChange={() => set({ hidden: L.hidden.includes(s) ? L.hidden.filter((x) => x !== s) : [...L.hidden, s] })} /> {sectionLabel(role, s)}</label>)}
        <button type="button" className="btn sm" onClick={() => setLayout(DEFAULT_LAYOUT)}>Reset</button></div>
        <div className="muted small">Sections are ordered by how many of your favorite stats they hold.</div></section>}
      <section className="panel card"><h3>{active === 'splits' ? 'This season: All / L / R' : sectionLabel(role, active)}</h3>
        {active === 'splits' ? <SplitsCard {...ctx} L={L} set={set} /> : <DataSection {...ctx} id={active} L={L} set={set} />}
      </section>
    </>
  );
}

function SplitsCard({ role, cur, allKeys, favs, L, set }) {
  const [secId, setSecId] = usePref(`splitsec2:${role}`, 'favs');
  const avail = new Set(Object.values(cur.splits).flatMap((s) => Object.keys(s)));
  const custom = L.custom[`splits:${secId}`];
  const keys = custom || (secId === 'favs' ? favs.filter((k) => avail.has(k)) : favFirst(sectionKeys(role, secId, avail), favs));
  const [edit, setEdit] = useState(false);
  const [heatOn] = usePref('tools:heat', true);
  const ids = useSectionOrder(role, avail, favs);
  return (
    <>
      <div className="row"><select value={secId} onChange={(e) => setSecId(e.target.value)}><option value="favs">★ My stats</option>{ids.map((s) => <option key={s} value={s}>{sectionLabel(role, s)}</option>)}</select>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button></div>
      {edit && <StatPicker keys={allKeys} role={role} value={keys} onChange={(v) => set({ custom: { ...L.custom, [`splits:${secId}`]: v } })} />}
      <div className="scroll"><table className="t"><thead><tr><th className="l">Stat</th>{SPLITS.map(([s]) => <th key={s}>{splitLabel(s, role)}</th>)}</tr></thead>
        <tbody>{keys.map((k) => { const d = statDef(k, role); return <tr key={k}><td className="l" title={d.desc}>{d.label}</td>{SPLITS.map(([s]) => <td key={s} className="mono" style={heatOn ? tint(heat(SPLITS.map(([x]) => cur.splits[x]?.[k]), cur.splits[s]?.[k], d.dir)) : undefined}>{d.f(cur.splits[s]?.[k])}</td>)}</tr>; })}</tbody></table></div>
      <div className="muted small">Not every stat has an L/R split; missing ones show “—”.</div>
    </>
  );
}

function DataSection({ role, id, seasons, season, split, file, allKeys, keySet, favs, L, set, setSeason }) {
  const secSplit = L.tableSplit[id] || 'page';
  const sp = secSplit === 'page' ? split : secSplit;
  const keys = L.custom[id] || favFirst(sectionKeys(role, id, keySet), favs);
  const [edit, setEdit] = useState(false);
  const [rev, setRev] = usePref('table:rev', false);
  const [withSplits, setWithSplits] = usePref('tools:splits', true);
  const [heatOn, setHeatOn] = usePref('tools:heat', true);
  const ys = rev ? [...seasons].reverse() : seasons;
  const rowSplits = [sp, ...(withSplits ? SPLITS.map(([x]) => x).filter((x) => x !== sp) : [])];
  const colVals = (sx, k) => seasons.map((y) => file.seasons[y].splits[sx]?.[k]);
  if (!keys.length && !edit) return <div className="muted">No {sectionLabel(role, id)} stats in this player’s data. <button type="button" className="btn sm" onClick={() => setEdit(true)}>Choose stats</button></div>;
  return (
    <>
      <div className="row">
        <select value={secSplit} onChange={(e) => set({ tableSplit: { ...L.tableSplit, [id]: e.target.value } })} title="Split for this table">
          <option value="page">Split: page ({splitLabel(split, role)})</option>{SPLITS.map(([s]) => <option key={s} value={s}>{splitLabel(s, role)}</option>)}
        </select>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `Choose stats (${keys.length})`}</button>
        <button type="button" className="btn sm" onClick={() => setRev(!rev)}>{rev ? 'Newest first' : 'Oldest first'}</button>
        <label className="small row"><input type="checkbox" checked={withSplits} onChange={(e) => setWithSplits(e.target.checked)} /> L/R splits</label>
        <label className="small row"><input type="checkbox" checked={heatOn} onChange={(e) => setHeatOn(e.target.checked)} /> Color</label>
        {L.custom[id] && <button type="button" className="btn sm" onClick={() => { const c = { ...L.custom }; delete c[id]; set({ custom: c }); }}>Reset stats</button>}
      </div>
      {edit && <StatPicker keys={allKeys} role={role} value={keys} onChange={(v) => set({ custom: { ...L.custom, [id]: v } })} />}
      <div className="scroll"><table className="t sticky-first"><thead><tr><th className="l">Season</th><th className="l">Team</th>{withSplits && <th className="l">Split</th>}{keys.map((k) => <th key={k} className={favs.includes(k) ? 'fav' : ''} title={statDef(k, role).desc}>{statDef(k, role).label}</th>)}</tr></thead>
        <tbody>{ys.map((y) => { const e = file.seasons[y]; return rowSplits.map((sx, ri) => (
          <tr key={`${y}${sx}`} className={(y === season ? 'sel' : '') + (ri ? ' subrow' : ' toprow')} onClick={() => setSeason(y)}>
            <td className="l">{ri === 0 && <b>{y}</b>}</td><td className="l">{ri === 0 && e.team}</td>
            {withSplits && <td className="l"><span className={`splitpill ${sx}`}>{splitLabel(sx, role)}</span></td>}
            {keys.map((k) => { const d = statDef(k, role); const v = e.splits[sx]?.[k]; return <td key={k} className="mono" style={heatOn ? tint(heat(colVals(sx, k), v, d.dir)) : undefined}>{d.f(v)}</td>; })}</tr>)); })}</tbody></table></div>
      <div className="muted small">Click a row to select that season. Favorite stats are listed first.</div>
    </>
  );
}

/* ---------- trends: one small chart per stat ---------- */
function TrendsTab({ role, seasons, file, allKeys, split, favs, keySet }) {
  const [sel, setSel] = usePref(`trend2:${role}`, null);
  const [cols, setCols] = usePref('trend2:cols', 3);
  const [mode, setMode] = usePref('trend:mode', 'page');
  const [edit, setEdit] = useState(false);
  const keys = (sel || favs).filter((k) => keySet.has(k)).slice(0, 24);
  const splits = mode === 'all3' ? SPLITS.map((s) => s[0]) : [split];
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="row"><Seg small value={mode} onChange={setMode} options={[['page', 'Selected split'], ['all3', 'All / L / R']]} />
          <label className="small">Columns <select value={cols} onChange={(e) => setCols(+e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label></span>
        <span className="row">{sel && <button type="button" className="btn sm" onClick={() => setSel(null)}>My stats</button>}<button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : '⚙ Choose stats'}</button></span>
      </div>
      {edit && <section className="panel"><StatPicker keys={allKeys} role={role} value={keys} onChange={setSel} max={24} /></section>}
      <div className="grid" style={{ '--cols': cols }}>
        {keys.map((k) => {
          const d = statDef(k, role);
          const series = splits.map((sp) => ({ label: splitLabel(sp, role), points: seasons.map((y) => ({ x: y, y: file.seasons[y]?.splits[sp]?.[k] ?? null })) }));
          return (
            <section className="panel card" key={k}>
              <h3 title={d.desc}>{d.label}</h3>
              <LineChart series={series} fmt={d.f} height={cols > 2 ? 150 : 190} />
              {mode === 'all3' && <div className="legend">{series.map((s, i) => <span key={i}><i style={{ background: seriesColor(i) }} />{s.label}</span>)}</div>}
            </section>);
        })}
        {!keys.length && <div className="panel muted">No stats selected.</div>}
      </div>
    </>
  );
}
