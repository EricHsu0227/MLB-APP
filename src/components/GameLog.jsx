import { useEffect, useMemo, useState } from 'react';
import ApiError from './ApiError.jsx';
import { useApi } from '../lib/mlbapi.js';
import { gameScore, ipToOuts, outsToIp, sumHitting, sumPitching } from '../lib/saber.js';
import { heat } from '../lib/stats.js';
import { tint } from '../lib/themes.js';
import { Seg } from './ui.jsx';
import { LineChart } from './charts.jsx';
import { TeamLogo } from './team.jsx';
import { teamById } from '../lib/teams.js';
import { usePref } from '../lib/data.js';

const r3 = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'));
const r2 = (v) => (v == null ? '—' : v.toFixed(2));
const pc = (v) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`);
const day = (s) => new Date(s + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
const MONTHS = ['Mar/Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep/Oct'];
const monthOf = (date) => { const m = +date.slice(5, 7); return m <= 4 ? 0 : m >= 9 ? 5 : m - 4; };
const n = (v) => +v || 0;
const sum = (rows, f) => rows.reduce((a, g) => a + n(f(g.stat)), 0);

// [key, header, value(stat, game), format, total(rows) | null, title, heat direction]
const HIT = [
  ['PA', 'PA', (s) => s.plateAppearances, String, (r) => sum(r, (s) => s.plateAppearances)],
  ['AB', 'AB', (s) => s.atBats, String, (r) => sum(r, (s) => s.atBats)],
  ['R', 'R', (s) => s.runs, String, (r) => sum(r, (s) => s.runs)],
  ['H', 'H', (s) => s.hits, String, (r) => sum(r, (s) => s.hits)],
  ['2B', '2B', (s) => s.doubles, String, (r) => sum(r, (s) => s.doubles)],
  ['3B', '3B', (s) => s.triples, String, (r) => sum(r, (s) => s.triples)],
  ['HR', 'HR', (s) => s.homeRuns, String, (r) => sum(r, (s) => s.homeRuns)],
  ['RBI', 'RBI', (s) => s.rbi, String, (r) => sum(r, (s) => s.rbi)],
  ['BB', 'BB', (s) => s.baseOnBalls, String, (r) => sum(r, (s) => s.baseOnBalls)],
  ['IBB', 'IBB', (s) => s.intentionalWalks, String, (r) => sum(r, (s) => s.intentionalWalks)],
  ['SO', 'SO', (s) => s.strikeOuts, String, (r) => sum(r, (s) => s.strikeOuts)],
  ['HBP', 'HBP', (s) => s.hitByPitch, String, (r) => sum(r, (s) => s.hitByPitch)],
  ['SB', 'SB', (s) => s.stolenBases, String, (r) => sum(r, (s) => s.stolenBases)],
  ['CS', 'CS', (s) => s.caughtStealing, String, (r) => sum(r, (s) => s.caughtStealing)],
  ['TB', 'TB', (s) => s.totalBases, String, (r) => sum(r, (s) => s.totalBases)],
  ['LOB', 'LOB', (s) => s.leftOnBase, String, (r) => sum(r, (s) => s.leftOnBase)],
  ['GIDP', 'GIDP', (s) => s.groundIntoDoublePlay, String, (r) => sum(r, (s) => s.groundIntoDoublePlay)],
  ['NP', 'Pitches', (s) => s.numberOfPitches, String, (r) => sum(r, (s) => s.numberOfPitches), 'Pitches seen'],
  ['gOPS', 'OPS', (s) => (s.atBats || s.baseOnBalls || s.hitByPitch ? sumHitting([s]).ops : null), r3, (r) => sumHitting(r.map((g) => g.stat)).ops, 'OPS in this game (total row: OPS over the games shown)', 1],
  ['tAVG', 'AVG', null, r3, null, 'Season to date, after this game'],
  ['tOBP', 'OBP', null, r3, null, 'Season to date, after this game'],
  ['tSLG', 'SLG', null, r3, null, 'Season to date, after this game'],
  ['tOPS', 'sOPS', null, r3, null, 'Season-to-date OPS, after this game'],
];
const PIT = [
  ['GS', 'GS', (s) => s.gamesStarted, String, (r) => sum(r, (s) => s.gamesStarted)],
  ['Dec', 'Dec', (s) => (s.wins ? 'W' : s.losses ? 'L' : s.saves ? 'SV' : s.holds ? 'H' : s.blownSaves ? 'BS' : ''), String, (r) => { const t = sumPitching(r.map((g) => g.stat)); return `${t.w}-${t.l}${t.sv ? ` ${t.sv}SV` : ''}`; }],
  ['IP', 'IP', (s) => s.inningsPitched, String, (r) => outsToIp(r.reduce((a, g) => a + ipToOuts(g.stat.inningsPitched), 0))],
  ['H', 'H', (s) => s.hits, String, (r) => sum(r, (s) => s.hits)],
  ['R', 'R', (s) => s.runs, String, (r) => sum(r, (s) => s.runs)],
  ['ER', 'ER', (s) => s.earnedRuns, String, (r) => sum(r, (s) => s.earnedRuns), '', -1],
  ['HR', 'HR', (s) => s.homeRuns, String, (r) => sum(r, (s) => s.homeRuns)],
  ['BB', 'BB', (s) => s.baseOnBalls, String, (r) => sum(r, (s) => s.baseOnBalls)],
  ['SO', 'SO', (s) => s.strikeOuts, String, (r) => sum(r, (s) => s.strikeOuts), '', 1],
  ['HBP', 'HBP', (s) => s.hitBatsmen, String, (r) => sum(r, (s) => s.hitBatsmen)],
  ['BF', 'BF', (s) => s.battersFaced, String, (r) => sum(r, (s) => s.battersFaced)],
  ['NP', 'NP', (s) => s.numberOfPitches, String, (r) => sum(r, (s) => s.numberOfPitches)],
  ['Str%', 'Str%', (s) => (s.numberOfPitches ? n(s.strikes) / s.numberOfPitches : null), pc, (r) => { const p = sum(r, (s) => s.numberOfPitches); return p ? sum(r, (s) => s.strikes) / p : null; }, 'Strike rate'],
  ['GO', 'GO', (s) => s.groundOuts, String, (r) => sum(r, (s) => s.groundOuts)],
  ['AO', 'AO', (s) => s.airOuts, String, (r) => sum(r, (s) => s.airOuts)],
  ['WP', 'WP', (s) => s.wildPitches, String, (r) => sum(r, (s) => s.wildPitches)],
  ['GSc', 'GSc', (s) => gameScore(s), String, null, 'Bill James Game Score', 1],
  ['gERA', 'ERA', (s) => { const o = ipToOuts(s.inningsPitched); return o ? (n(s.earnedRuns) * 27) / o : null; }, r2, (r) => sumPitching(r.map((g) => g.stat)).era, 'ERA in this game (total row: over the games shown)'],
  ['tERA', 'sERA', null, r2, null, 'Season-to-date ERA, after this game'],
  ['tWHIP', 'sWHIP', null, r2, null, 'Season-to-date WHIP, after this game'],
];
const DEFAULT_COLS = { bat: ['PA', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'SB', 'gOPS', 'tAVG', 'tOBP', 'tSLG', 'tOPS'], pit: ['GS', 'Dec', 'IP', 'H', 'R', 'ER', 'HR', 'BB', 'SO', 'NP', 'Str%', 'GSc', 'tERA', 'tWHIP'] };

/** Per-game log from the MLB Stats API: filters, sortable columns you can choose, monthly subtotals, rolling chart. */
export default function GameLog({ id, role, season: pageSeason, seasons }) {
  const group = role === 'bat' ? 'hitting' : 'pitching';
  const DEFS = role === 'bat' ? HIT : PIT;
  const season = pageSeason; // the season picker above the tabs drives the game log too
  const [gt, setGt] = usePref('gamelog:type', 'R');
  const [site, setSite] = useState('all');
  const [month, setMonth] = useState('all');
  const [opp, setOpp] = useState('all');
  const [res, setRes] = useState('all');
  const [kind, setKind] = useState('all');
  const [last, setLast] = useState('all');
  const [sort, setSort] = useState(null);
  const [cols, setCols] = usePref(`gamelog:cols:${role}`, DEFAULT_COLS[role]);
  const [byMonth, setByMonth] = usePref('gamelog:bymonth', false);
  const [chart, setChart] = usePref('gamelog:chart', true);
  const [pick, setPick] = useState(false);
  const [win, setWin] = usePref('gamelog:win', 15);
  const [metric, setMetric] = usePref(`gamelog:metric:${role}`, role === 'bat' ? 'ops' : 'era');
  const { data, error, loading, retry } = useApi(`/people/${id}/stats?stats=gameLog&group=${group}&season=${season}&gameType=${gt}`, { ttl: 300000, pick: (x) => x?.stats?.[0]?.splits || [] });

  const rows = useMemo(() => {
    const sorted = [...(data || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const sumF = role === 'bat' ? sumHitting : sumPitching;
    return sorted.map((g, i) => { const run = sumF(sorted.slice(0, i + 1).map((x) => x.stat)); return { ...g, n: i + 1, run }; });
  }, [data, role]);
  const runVal = (g, k) => ({ tAVG: g.run.avg, tOBP: g.run.obp, tSLG: g.run.slg, tOPS: g.run.ops, tERA: g.run.era, tWHIP: g.run.whip })[k];
  const val = (g, def) => (def[2] ? def[2](g.stat, g) : runVal(g, def[0]));
  const opps = useMemo(() => [...new Set(rows.map((g) => g.opponent?.id))].map((x) => teamById(x)).filter(Boolean).sort((a, b) => a.abbr.localeCompare(b.abbr)), [rows]);

  const shown = useMemo(() => {
    let r = rows;
    if (site !== 'all') r = r.filter((g) => (site === 'home') === !!g.isHome);
    if (month !== 'all') r = r.filter((g) => monthOf(g.date) === +month);
    if (opp !== 'all') r = r.filter((g) => g.opponent?.id === +opp);
    if (res !== 'all') r = r.filter((g) => (res === 'W') === !!g.isWin);
    if (kind !== 'all') r = r.filter((g) => (kind === 'start') === !!n(g.stat.gamesStarted));
    if (last !== 'all') r = r.slice(-last);
    r = [...r].reverse();
    if (sort) { const def = DEFS.find((x) => x[0] === sort.k); if (def) r.sort((a, b) => { const x = val(a, def), y = val(b, def); const nx = typeof x === 'number' ? x : parseFloat(x); const ny = typeof y === 'number' ? y : parseFloat(y); if (Number.isNaN(nx) && Number.isNaN(ny)) return 0; if (Number.isNaN(nx)) return 1; if (Number.isNaN(ny)) return -1; return (nx - ny) * sort.d; }); }
    return r;
  }, [rows, site, month, opp, res, kind, last, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = useMemo(() => {
    const out = []; const w = Math.max(3, +win || 15);
    for (let i = 0; i < rows.length; i++) {
      const slice = rows.slice(Math.max(0, i - w + 1), i + 1).map((g) => g.stat);
      const t = role === 'bat' ? sumHitting(slice) : sumPitching(slice);
      out.push({ x: i + 1, y: t[metric] ?? null });
    }
    return out;
  }, [rows, win, metric, role]);

  const defs = cols.map((k) => DEFS.find((d) => d[0] === k)).filter(Boolean);
  const heats = Object.fromEntries(defs.filter((d) => d[6]).map((d) => [d[0], shown.map((g) => val(g, d))]));
  const metrics = role === 'bat' ? [['ops', 'OPS'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG']] : [['era', 'ERA'], ['whip', 'WHIP'], ['k9', 'K/9']];
  const flag = (g) => { const s = g.stat; if (role === 'bat') return s.homeRuns ? 'HR' : n(s.hits) >= 3 ? '3H' : ''; return n(s.gamesStarted) && ipToOuts(s.inningsPitched) >= 18 && n(s.earnedRuns) <= 3 ? 'QS' : ''; };
  const totalRow = (list, label, cls) => (
    <tr className={cls} key={label}><td className="l"><b>{label}</b></td><td className="l muted small">{list.length} G</td><td className="l" />
      {defs.map((d) => <td key={d[0]} className="mono"><b>{d[4] ? d[3](d[4](list)) : ''}</b></td>)}</tr>);
  const sortBy = (k) => setSort((s) => (s?.k !== k ? { k, d: -1 } : s.d === -1 ? { k, d: 1 } : null));

  const grouped = byMonth && !sort ? MONTHS.map((m, i) => [m, shown.filter((g) => monthOf(g.date) === i)]).filter(([, l]) => l.length) : [[null, shown]];

  return (
    <>
      <div className="row gl-filters">
        <Seg small value={gt} onChange={setGt} options={[['R', 'Regular'], ['P', 'Postseason']]} />
        <Seg small value={site} onChange={setSite} options={[['all', 'All'], ['home', 'Home'], ['away', 'Away']]} />
        <select value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">Every month</option>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
        <select value={opp} onChange={(e) => setOpp(e.target.value)}><option value="all">Every opponent</option>{opps.map((t) => <option key={t.id} value={t.id}>{t.abbr}</option>)}</select>
        <select value={res} onChange={(e) => setRes(e.target.value)}><option value="all">Wins and losses</option><option value="W">Team wins</option><option value="L">Team losses</option></select>
        {role === 'pit' && <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Starts and relief</option><option value="start">Starts</option><option value="relief">Relief</option></select>}
        <select value={last} onChange={(e) => setLast(e.target.value === 'all' ? 'all' : +e.target.value)}><option value="all">Whole season</option>{[30, 15, 10, 5].map((x) => <option key={x} value={x}>Last {x}</option>)}</select>
      </div>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => setPick(!pick)}>{pick ? 'Done' : `Columns (${defs.length})`}</button>
        <label className="small row"><input type="checkbox" checked={!!byMonth} onChange={(e) => setByMonth(e.target.checked)} /> Monthly subtotals</label>
        <label className="small row"><input type="checkbox" checked={!!chart} onChange={(e) => setChart(e.target.checked)} /> Rolling chart</label>
        {sort && <button type="button" className="btn sm" onClick={() => setSort(null)}>Date order</button>}
      </div>
      {pick && <div className="picker"><div className="chips">{DEFS.map((d) => <span key={d[0]} title={d[5] || d[1]} className={'chip' + (cols.includes(d[0]) ? ' on' : '')} onClick={() => setCols(cols.includes(d[0]) ? cols.filter((x) => x !== d[0]) : DEFS.map((x) => x[0]).filter((x) => x === d[0] || cols.includes(x)))}>{d[1]}{d[0].startsWith('t') ? ' (season)' : ''}</span>)}</div>
        <button type="button" className="btn sm" onClick={() => setCols(DEFAULT_COLS[role])}>Default columns</button></div>}
      {loading && !data ? <div className="muted pad">Loading game log…</div> : error && !data ? <ApiError inline what="the game log" error={error} retry={retry} /> : !rows.length ? <div className="muted pad">No {gt === 'P' ? 'postseason' : 'regular-season'} games for {season}.</div> : (
        <>
          {chart && <div className="gl-chart"><div className="row"><b>Rolling {win} games</b><Seg small value={metric} onChange={setMetric} options={metrics} />
            <select value={win} onChange={(e) => setWin(+e.target.value)}>{[5, 10, 15, 30].map((x) => <option key={x} value={x}>{x} games</option>)}</select></div>
            <LineChart series={[{ label: `Rolling ${win}-game ${metrics.find((m) => m[0] === metric)?.[1]}`, points: series }]} fmt={(v) => (role === 'bat' ? r3(v) : r2(v))} height={150} xTicks={series.filter((_, i) => i % Math.ceil(series.length / 8) === 0).map((p) => p.x)} /></div>}
          <div className="scroll tall"><table className="t sticky-first gamelog"><thead><tr>
            <th className="l">Date</th><th className="l">Opp</th><th className="l">Res</th>
            {defs.map((d) => <th key={d[0]} title={d[5] || undefined} className={sort?.k === d[0] ? 'active' : ''} style={{ cursor: 'pointer' }} onClick={() => sortBy(d[0])}>{d[1]}{sort?.k === d[0] ? (sort.d < 0 ? ' ▼' : ' ▲') : ''}</th>)}</tr></thead>
            <tbody>
              {totalRow(shown, 'Total', 'sel')}
              {grouped.map(([m, list]) => [
                ...list.map((g) => { const pk = g.game?.gamePk; const f = flag(g); return (
                  <tr key={(pk || g.date) + '-' + g.n} className={f ? 'big-game' : ''}>
                    <td className="l">{pk ? <a href={`https://www.mlb.com/gameday/${pk}/final/box`} target="_blank" rel="noreferrer" title="Box score on MLB.com">{day(g.date)}</a> : day(g.date)}{f && <span className="gflag">{f}</span>}</td>
                    <td className="l">{g.isHome ? 'vs' : '@'} <TeamLogo id={g.opponent?.id} size={14} /> {teamById(g.opponent?.id)?.abbr || g.opponent?.name}</td>
                    <td className="l"><span className={g.isWin ? 'upc' : 'dnc'}><b>{g.isWin ? 'W' : 'L'}</b></span></td>
                    {defs.map((d) => { const v = val(g, d); return <td key={d[0]} className="mono" style={d[6] && typeof v === 'number' ? tint(heat(heats[d[0]], v, d[6]), 40) : undefined}>{v == null || v === '' ? (d[3] === String && d[0] !== 'Dec' ? '0' : d[0] === 'Dec' ? '' : '—') : d[3](v)}</td>; })}
                  </tr>); }),
                m ? totalRow(list, m, 'subtotal') : null,
              ])}
            </tbody></table></div>
          <div className="muted small">Tap a column to sort. HR / 3H mark big hitting games and QS marks quality starts. Dates open the box score. Source: MLB Stats API.</div>
        </>)}
    </>
  );
}
