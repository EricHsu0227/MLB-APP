import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useSeason, usePref } from '../lib/data.js';
import { statDef } from '../lib/catalog.js';
import { bestLineup, battingOrder } from '../lib/saber.js';
import { gameStatus, gamesOf, rosterPath, standingsMap, standingsPath, teamSchedulePath, useApi, addDays, ymd } from '../lib/mlbapi.js';
import { teamByAbbr, divisionOf } from '../lib/teams.js';
import { TeamLogo, TeamLink } from '../components/team.jsx';
import { Headshot, SeasonSelect, SubSplits } from '../components/ui.jsx';
import { tint } from '../lib/themes.js';
import { heat } from '../lib/stats.js';

const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'OF', 'IF'];
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3).replace(/^0/, '') : '—');
const num = (v, d = 0) => (typeof v === 'number' ? v.toFixed(d) : '—');
const sum = (xs) => xs.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

function Name({ p, role }) {
  return <span className="player-cell"><Headshot id={p.id} size={24} /><Link to={`/player/${role}/${p.id}`}>{p.name}</Link></span>;
}

function Lineup({ title, split, hitters, pos, blocked, setBlocked, minPA }) {
  const nine = useMemo(() => battingOrder(bestLineup(hitters.map((p) => ({ id: p.id, name: p.name, all: p.splits.all, vs: p.splits[split] })), { blocked, minPA })), [hitters, split, blocked, minPA]);
  const scores = nine.map((p) => p.score);
  return (
    <div>
      <h4>{title}</h4>
      <table className="t sm"><thead><tr><th>#</th><th className="l">Hitter</th><th>Pos</th><th title="Split wOBA, regressed toward the hitter's overall wOBA">xwOBA-ish</th><th>Raw</th><th>PA</th><th /></tr></thead>
        <tbody>{nine.map((p, i) => (
          <tr key={p.id}><td className="muted">{i + 1}</td><td className="l"><Name p={p} role="bat" /></td><td>{pos[p.id] || ''}</td>
            <td className="mono" style={tint(heat(scores, p.score, 1), 40)}>{f3(p.score)}</td><td className="mono muted">{f3(p.vs?.wOBA)}</td><td className="muted">{p.vs?.PA ?? 0}</td>
            <td><button type="button" className="btn sm" title="Rest this player" onClick={() => setBlocked(new Set([...blocked, p.id]))}>✕</button></td></tr>))}</tbody></table>
    </div>
  );
}

export default function Team({ index }) {
  const { abbr } = useParams();
  const t = teamByAbbr(abbr);
  const [qs, setQs] = useSearchParams();
  const season = Number(qs.get('season')) || index.seasons.at(-1);
  const { data: bat } = useSeason(season, 'bat');
  const { data: pit } = useSeason(season, 'pit');
  const [blocked, setBlocked] = useState(new Set());
  const [minPA, setMinPA] = usePref('team:minpa', 100);
  const { data: roster } = useApi(t ? rosterPath(t.id) : null, { ttl: 300000 });
  const { data: stand } = useApi(t ? standingsPath(season) : null, { ttl: 300000 });
  const today = ymd(new Date());
  const { data: sched } = useApi(t ? teamSchedulePath(t.id, addDays(today, -7), addDays(today, 7)) : null, { ttl: 60000 });
  const rec = useMemo(() => standingsMap(stand).get(t?.id), [stand, t]);

  const hitters = useMemo(() => (bat?.players || []).filter((p) => p.team === abbr && (p.splits.all?.PA ?? 0) > 0).sort((a, b) => (b.splits.all.PA ?? 0) - (a.splits.all.PA ?? 0)), [bat, abbr]);
  const pitchers = useMemo(() => (pit?.players || []).filter((p) => p.team === abbr && (p.splits.all?.IP ?? 0) > 0), [pit, abbr]);
  const starters = pitchers.filter((p) => (p.splits.all.GS ?? 0) >= Math.max(3, (p.splits.all.G ?? 0) * 0.5)).sort((a, b) => b.splits.all.GS - a.splits.all.GS);
  const pen = pitchers.filter((p) => !starters.includes(p)).sort((a, b) => (b.splits.all.SV ?? 0) - (a.splits.all.SV ?? 0) || (b.splits.all.G ?? 0) - (a.splits.all.G ?? 0));
  const pos = useMemo(() => Object.fromEntries((roster?.roster || []).map((r) => [r.person.id, r.position?.abbreviation])), [roster]);
  const jersey = useMemo(() => Object.fromEntries((roster?.roster || []).map((r) => [r.person.id, r.jerseyNumber])), [roster]);
  const onActive = (id) => (roster ? id in pos : true);

  if (!t) return <Navigate to="/teams" replace />;
  const war = (ps) => sum(ps.map((p) => p.splits.all.WAR));
  const paSum = sum(hitters.map((p) => p.splits.all.PA));
  const wrc = paSum ? sum(hitters.map((p) => (p.splits.all['wRC+'] ?? 0) * p.splits.all.PA)) / paSum : null;
  const ipSum = sum(pitchers.map((p) => p.splits.all.IP));
  const era = ipSum ? sum(pitchers.map((p) => (p.splits.all.ERA ?? 0) * p.splits.all.IP)) / ipSum : null;
  const fip = ipSum ? sum(pitchers.map((p) => (p.splits.all.FIP ?? 0) * p.splits.all.IP)) / ipSum : null;
  const tiles = [['Hitter WAR', num(war(hitters), 1)], ['Pitcher WAR', num(war(pitchers), 1)], ['Total WAR', num(war(hitters) + war(pitchers), 1)], ['wRC+', num(wrc)], ['ERA', num(era, 2)], ['FIP', num(fip, 2)]];

  // depth chart: group the active roster by position when the API is reachable, else by role
  const depth = [];
  if (roster) {
    for (const p of POS_ORDER) { const list = hitters.filter((h) => pos[h.id] === p); if (list.length) depth.push([p, list.map((h) => ({ ...h, role: 'bat' }))]); }
    const other = hitters.filter((h) => !POS_ORDER.includes(pos[h.id]) && pos[h.id]); if (other.length) depth.push(['Other', other.map((h) => ({ ...h, role: 'bat' }))]);
  } else if (hitters.length) depth.push(['Hitters (by PA)', hitters.map((h) => ({ ...h, role: 'bat' }))]);
  depth.push(['Rotation', starters.map((h) => ({ ...h, role: 'pit' }))], ['Bullpen', pen.map((h) => ({ ...h, role: 'pit' }))]);

  const hBlock = hitters.filter((h) => onActive(h.id));
  const games = gamesOf(sched);

  const bd = (p, role) => { const s = p.splits; const d = (k) => statDef(k, role); return role === 'bat'
    ? [s.all.PA, f3(s.all.AVG), f3(s.all.OBP), f3(s.all.SLG), num(s.all['wRC+']), num(s.all.WAR, 1)]
    : [num(s.all.IP, 1), num(s.all.ERA, 2), num(s.all.FIP, 2), d('K%').f(s.all['K%']), num(s.all.WAR, 1)]; };

  return (
    <>
      <section className="hero-card panel">
        <TeamLogo id={t.id} size={96} />
        <div className="grow"><h1 style={{ margin: 0 }}>{t.name}</h1>
          <div className="muted">{divisionOf(t)} · {season}{rec ? ` · ${rec.w}-${rec.l} (${rec.pct.toFixed(3).replace(/^0/, '')}) · RS ${rec.rs} / RA ${rec.ra}` : ''}</div>
          <div className="row" style={{ marginTop: 10 }}><SeasonSelect seasons={index.seasons} value={season} onChange={(y) => setQs({ season: y })} />
            <Link className="btn" to="/standings">Standings</Link><Link className="btn" to="/teams">All teams</Link></div></div>
        <div className="hero-tiles">{tiles.map(([k, v]) => <div className="tile" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
      </section>

      <section className="panel card"><h3>Platoon lineups</h3>
        <div className="row"><label className="small">Min PA <input type="number" style={{ width: 70 }} value={minPA} onChange={(e) => setMinPA(+e.target.value)} /></label>
          {blocked.size > 0 && <button type="button" className="btn sm" onClick={() => setBlocked(new Set())}>Reset rested ({blocked.size})</button>}
          <span className="muted small">Best nine by wOBA against each hand, with small splits regressed toward each hitter’s overall wOBA. Order is a heuristic, not a simulation. {roster ? 'Active-roster positions shown from the MLB Stats API.' : 'Positions need the MLB Stats API.'}</span></div>
        {!hitters.length ? <div className="muted pad">No {t.abbr} hitters found in the {season} data.</div> : (
          <div className="box-grid"><Lineup title="vs right-handed pitchers" split="vsR" hitters={hBlock} pos={pos} blocked={blocked} setBlocked={setBlocked} minPA={minPA} />
            <Lineup title="vs left-handed pitchers" split="vsL" hitters={hBlock} pos={pos} blocked={blocked} setBlocked={setBlocked} minPA={minPA} /></div>)}
        {roster && <div className="muted small">Hitters not on the current active roster are left out of the lineups.</div>}
      </section>

      <section className="panel card"><h3>Depth chart</h3>
        <div className="depth">{depth.map(([label, list]) => list.length > 0 && (
          <div className="depth-col" key={label}><div className="depth-h">{label}</div>
            {list.map((p, i) => <div className={'depth-row' + (i === 0 ? ' first' : '')} key={p.id + p.role}><Headshot id={p.id} size={22} /><Link to={`/player/${p.role}/${p.id}`}>{p.name}</Link>
              <span className="muted small">{jersey[p.id] ? `#${jersey[p.id]} ` : ''}{p.role === 'bat' ? `${num(p.splits.all['wRC+'])} wRC+` : `${num(p.splits.all.ERA, 2)} ERA`} · {num(p.splits.all.WAR, 1)} WAR</span></div>)}</div>))}</div>
      </section>

      {[['Hitters', hitters, 'bat', ['PA', 'AVG', 'OBP', 'SLG', 'wRC+', 'WAR']], ['Pitchers', pitchers, 'pit', ['IP', 'ERA', 'FIP', 'K%', 'WAR']]].map(([title, list, role, cols]) => (
        <section className="panel nopad" key={title}><div className="pad"><h3 style={{ margin: 0 }}>{title} <span className="muted small">{season}, with vs {role === 'bat' ? 'LHP / RHP' : 'LHB / RHB'} under each value</span></h3></div>
          <div className="scroll"><table className="t sticky-first"><thead><tr><th className="l">Player</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{[...list].sort((a, b) => (b.splits.all.WAR ?? 0) - (a.splits.all.WAR ?? 0)).map((p) => (
              <tr key={p.id}><td className="l"><Name p={p} role={role} /></td>{cols.map((c, i) => { const d = statDef(c, role); const v = p.splits.all[c]; return <td key={c} className="mono">{bd(p, role)[i]}{['AVG', 'OBP', 'SLG', 'wRC+', 'ERA', 'FIP', 'K%'].includes(c) && <SubSplits line={p.splits} k={c} d={d} main={v} role={role} />}</td>; })}</tr>))}</tbody></table></div></section>))}

      {games.length > 0 && (
        <section className="panel card"><h3>Recent and upcoming games</h3>
          <table className="t sm"><tbody>{games.map((g) => { const st = gameStatus(g); const home = g.teams.home.team.id === t.id; const opp = home ? g.teams.away : g.teams.home; const me = home ? g.teams.home : g.teams.away;
            return <tr key={g.gamePk}><td className="l muted">{g.officialDate}</td><td className="l">{home ? 'vs' : '@'} <TeamLink id={opp.team.id} size={18} full /></td>
              <td className="l">{st.kind === 'final' ? <b className={me.isWinner ? 'upc' : 'dnc'}>{me.isWinner ? 'W' : 'L'} {me.score}-{opp.score}</b> : st.text}</td></tr>; })}</tbody></table></section>)}
    </>
  );
}
