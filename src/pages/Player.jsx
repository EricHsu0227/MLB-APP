import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData, usePlayerFile, usePref, useSeason } from '../lib/data.js';
import { keysOfSeasons, splitLabel, statDef } from '../lib/catalog.js';
import { useFavs } from '../lib/favs.js';
import { peerPool, percentile, pctFromRef } from '../lib/stats.js';
import { Bubble, Headshot, Seg, SeasonSelect, SplitSeg, StatPicker } from '../components/ui.jsx';
import { pctColor, tint } from '../lib/themes.js';
import { useApi } from '../lib/mlbapi.js';
import { teamByAbbr, teamById, teamVars } from '../lib/teams.js';
import { TeamLogo } from '../components/team.jsx';
import StatTable, { COLOR_MODES, cellScore, useColorMode } from '../components/StatTable.jsx';
import GameLog from '../components/GameLog.jsx';
import RecentGames from '../components/RecentGames.jsx';
import Details, { personPath } from '../components/Details.jsx';

const TABS = [['overview', 'Overview'], ['percentiles', 'Percentile ranking'], ['stats', 'Stats'], ['games', 'Game logs'], ['details', 'Player details']];
const hasDir = (k, role) => !!statDef(k, role).dir;

export default function Player() {
  const { role, id: idp } = useParams();
  const id = Number(idp);
  const [qs, setQs] = useSearchParams();
  const { data: file, error } = usePlayerFile(role, id);
  const { data: pindex } = useData('players-index.json');
  const { data: league } = useData(`league-${role}.json`);
  const [favs] = useFavs(role);
  const [ui] = usePref('ui3', {});
  const { data: person } = useApi(personPath(id), { ttl: 3600000, pick: (x) => x?.people?.[0] });

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
  const age = cur.splits.all?.Age;
  // multi-team seasons come as "- - -"; fall back to the team he is on now
  const team = teamByAbbr(cur.team) || (season === seasons.at(-1) ? teamById(person?.currentTeam?.id) : null);
  const colors = ui.teamColors !== false && team ? teamVars(team.abbr) : null;
  const ctx = { id, role, file, seasons, season, split, cur, allKeys, keySet, seasonFile, favs, league, setSeason: (y) => setParam('season', y), goto: (t) => setParam('tab', t) };
  const facts = [
    person?.primaryNumber && `#${person.primaryNumber}`, person?.primaryPosition?.abbreviation,
    person && `B/T ${person.batSide?.code || '?'}/${person.pitchHand?.code || '?'}`, age && `Age ${age}`,
    person?.height && `${person.height}, ${person.weight} lb`,
  ].filter(Boolean);

  return (
    <div className={'player-page' + (colors ? ' team-painted' : '')} style={colors || undefined}>
      <section className="hero-card panel">
        <Headshot id={id} size={72} className="big" />
        <div className="grow">
          <h1>{file.name}</h1>
          <div className="hero-facts">
            {team && <span className="row"><TeamLogo id={team.id} size={18} /> {team.name}</span>}
            {!team && <span>{cur.team}</span>}
            {facts.map((f) => <span key={f}>{f}</span>)}
            {otherRole && <Link to={`/player/${otherRole}/${id}`}>{otherRole === 'bat' ? 'Hitting' : 'Pitching'} page →</Link>}
          </div>
        </div>
        <div className="hero-ctrls row">
          <SeasonSelect seasons={seasons} value={season} onChange={(y) => setParam('season', y)} />
          <SplitSeg role={role} value={split} onChange={(v) => setParam('split', v)} />
          <Link className="btn" to={`/compare?p=${role}:${id}:${season}`}>Compare</Link>
        </div>
      </section>

      <div className="tabs ptabs" role="tablist">
        {TABS.map(([t, l]) => <button type="button" role="tab" aria-selected={tab === t} key={t} className={tab === t ? 'on' : ''} onClick={() => setParam('tab', t)}>{l}</button>)}
      </div>

      {tab === 'overview' && <Overview {...ctx} />}
      {tab === 'percentiles' && <PercentileTab {...ctx} />}
      {tab === 'stats' && <StatTable {...ctx} />}
      {tab === 'games' && <section className="panel card"><h3>Game logs</h3><GameLog {...ctx} /></section>}
      {tab === 'details' && <Details {...ctx} person={person} />}
    </div>
  );
}

/* ---------- shared percentile bars (one season, exact pool) ---------- */
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

/* ---------- overview: selected stats, percentile ranking, recent games ---------- */
const OV_DEFAULT = { tiles: null, pct: null, games: 8, show: { tiles: true, pct: true, recent: true } };
function Overview(ctx) {
  const { role, season, split, cur, allKeys, keySet, seasonFile, favs, goto, id, league, file, seasons } = ctx;
  const [ov, setOv] = usePref(`ov2:${role}`, OV_DEFAULT);
  const O = { ...OV_DEFAULT, ...ov, show: { ...OV_DEFAULT.show, ...ov.show } };
  const [edit, setEdit] = useState(false);
  const [mode] = useColorMode();
  const tileKeys = (O.tiles || favs).filter((k) => keySet.has(k)).slice(0, 16);
  const pctKeys = (O.pct || favs.filter((k) => hasDir(k, role))).filter((k) => keySet.has(k)).slice(0, 18);
  const pool = usePool(seasonFile, split, role, role === 'bat' ? 100 : 30);
  const set = (patch) => setOv({ ...O, ...patch });
  const line = cur.splits[split] || {};
  const lg = league?.[season]?.[split] || {};
  return (
    <>
      <div className="row between ov-bar">
        <span className="muted small">{season} · {splitLabel(split, role)} · colored {COLOR_MODES.find((m) => m[0] === mode)?.[1]}</span>
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : '⚙ Customize'}</button>
      </div>
      {edit && (
        <section className="panel">
          <div className="row">
            {[['tiles', 'Stats'], ['pct', 'Percentile ranking'], ['recent', 'Recent games']].map(([k, l]) => <label key={k} className="small row"><input type="checkbox" checked={O.show[k]} onChange={(e) => set({ show: { ...O.show, [k]: e.target.checked } })} /> {l}</label>)}
            <label className="small">Recent games <select value={O.games} onChange={(e) => set({ games: +e.target.value })}>{[5, 8, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
            <button type="button" className="btn sm" onClick={() => setOv(OV_DEFAULT)}>Back to my stats</button>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Stats ({tileKeys.length})</div>
          <StatPicker keys={allKeys} role={role} value={tileKeys} onChange={(v) => set({ tiles: v })} max={16} />
          <div className="muted small" style={{ marginTop: 8 }}>Percentile bars ({pctKeys.length})</div>
          <StatPicker keys={allKeys.filter((k) => hasDir(k, role))} role={role} value={pctKeys} onChange={(v) => set({ pct: v })} max={24} />
        </section>)}
      {O.show.tiles && (
        <section className="panel card">
          <div className="tiles ov-tiles">
            {tileKeys.map((k) => {
              const d = statDef(k, role); const v = line[k]; const ref = lg[k];
              const sc = cellScore(mode, { ref, v, dir: d.dir, own: seasons.map((y) => file.seasons[y].splits[split]?.[k]) });
              return (
                <div className="tile big" key={k} title={d.desc} style={tint(sc, 30)}>
                  <div className="k">{d.label}</div><div className="v">{d.f(v)}</div>
                  <div className="lg">{ref ? `Lg ${d.f(ref[0])}` : ' '}{mode === 'league' && sc != null ? ` · ${sc}th` : ''}</div>
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
            <button type="button" className="btn sm" onClick={() => goto('percentiles')}>Every season →</button></section>}
          {O.show.recent && <section className="panel card"><h3>Recent games · {season}</h3><RecentGames id={id} role={role} season={season} n={O.games} onMore={() => goto('games')} /></section>}
        </div>)}
    </>
  );
}

/* ---------- percentile ranking: every season at once, or one season in detail ---------- */
function PercentileTab({ role, season, split, cur, allKeys, seasonFile, favs, file, seasons, league, setSeason }) {
  const [sel, setSel] = usePref(`pct2:${role}`, null);
  const [view, setView] = usePref('pct:view', 'all');
  const [minQ, setMinQ] = usePref(`pct:min:${role}`, role === 'bat' ? 100 : 30);
  const [edit, setEdit] = useState(false);
  const keys = (sel || favs.filter((k) => hasDir(k, role))).filter((k) => hasDir(k, role));
  const pool = usePool(seasonFile, split, role, minQ);
  const ys = [...seasons].reverse();
  const qual = (y) => { const s = file.seasons[y].splits[split] || {}; return role === 'bat' ? (s.PA ?? s.sc_PA ?? 0) >= (split === 'all' ? 100 : 40) : split === 'all' ? (s.IP ?? 0) >= 20 : (s.TBF ?? s.PA ?? 0) >= 60; };
  return (
    <section className="panel card">
      <h3>Percentile ranking</h3>
      <div className="row between">
        <Seg small value={view} onChange={setView} options={[['all', 'Every season'], ['one', `${season} in detail`]]} />
        <span className="row">
          {view === 'one' && <label className="small">Min {role === 'bat' ? 'PA' : 'IP'} <input type="number" style={{ width: 64 }} value={minQ} onChange={(e) => setMinQ(+e.target.value)} /></label>}
          {sel && <button type="button" className="btn sm" onClick={() => setSel(null)}>My stats</button>}
          <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button></span>
      </div>
      {edit && <StatPicker keys={allKeys.filter((k) => hasDir(k, role))} role={role} value={keys} onChange={setSel} max={60} />}
      {view === 'one' ? (
        <>
          <div className="muted small">{season} · vs {pool.length || '…'} {role === 'bat' ? 'hitters' : 'pitchers'} ({splitLabel(split, role)})</div>
          <PctBars role={role} split={split} line={cur.splits[split]} pool={pool} keys={keys} />
        </>) : (
        <>
          <div className="scroll tall"><table className="t sticky-first pct-years"><thead><tr><th className="l">Stat</th>{ys.map((y) => <th key={y} className={y === season ? 'active' : ''} onClick={() => setSeason(y)} style={{ cursor: 'pointer' }}>{y}</th>)}</tr></thead>
            <tbody>{keys.map((k) => { const d = statDef(k, role); return (
              <tr key={k}><td className="l" title={d.desc}>{d.label}</td>
                {ys.map((y) => { const v = file.seasons[y].splits[split]?.[k]; const p = pctFromRef(league?.[y]?.[split]?.[k], v, d.dir); return (
                  <td key={y} className={qual(y) ? '' : 'unq'} title={`${y}: ${d.f(v)}${p != null ? ` · ${p}th percentile` : ''}${qual(y) ? '' : ' (below the qualifying line)'}`}>{v == null ? '' : <Bubble p={p} size={26} />}</td>); })}</tr>); })}</tbody></table></div>
          <div className="muted small">Each bubble ranks that season against the league’s regulars ({role === 'bat' ? '100+ PA' : '20+ IP'}; {splitLabel(split, role)}). Faded seasons are below that line. Hover for the value.</div>
        </>)}
    </section>
  );
}
