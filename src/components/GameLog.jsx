import { useMemo, useState } from 'react';
import ApiError from '../components/ApiError.jsx';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/mlbapi.js';
import { gameScore, sumHitting, sumPitching } from '../lib/saber.js';
import { heat } from '../lib/stats.js';
import { tint } from '../lib/themes.js';
import { Seg } from './ui.jsx';
import { LineChart } from './charts.jsx';
import { TeamLink } from './team.jsx';
import { usePref } from '../lib/data.js';

const r3 = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-'));
const r2 = (v) => (v == null ? '—' : v.toFixed(2));
const d = (s) => new Date(s + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });

/** Per-game log from the MLB Stats API: filters, running season line, rolling chart, totals. */
export default function GameLog({ id, role, season }) {
  const group = role === 'bat' ? 'hitting' : 'pitching';
  const [gt, setGt] = usePref('gamelog:type', 'R');
  const [site, setSite] = useState('all');
  const [last, setLast] = useState('all');
  const [win, setWin] = usePref('gamelog:win', 15);
  const [metric, setMetric] = usePref(`gamelog:metric:${role}`, role === 'bat' ? 'ops' : 'era');
  const { data, error, loading, retry } = useApi(`/people/${id}/stats?stats=gameLog&group=${group}&season=${season}&gameType=${gt}`, { ttl: 300000, pick: (x) => x?.stats?.[0]?.splits || [] });
  const all = data || [];
  const rows = useMemo(() => {
    // running season line after each game, oldest first
    const sorted = [...all].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return sorted.map((g, i) => ({ ...g, run: (role === 'bat' ? sumHitting : sumPitching)(sorted.slice(0, i + 1).map((x) => x.stat)) }));
  }, [all, role]);
  const shown = useMemo(() => {
    let r = rows;
    if (site !== 'all') r = r.filter((g) => (site === 'home') === !!g.isHome);
    if (last !== 'all') r = r.slice(-last);
    return [...r].reverse();
  }, [rows, site, last]);
  const total = useMemo(() => (role === 'bat' ? sumHitting : sumPitching)(shown.map((g) => g.stat)), [shown, role]);

  const series = useMemo(() => {
    const out = []; const w = Math.max(3, +win || 15);
    for (let i = 0; i < rows.length; i++) {
      const slice = rows.slice(Math.max(0, i - w + 1), i + 1).map((g) => g.stat);
      const t = role === 'bat' ? sumHitting(slice) : sumPitching(slice);
      out.push({ x: i + 1, y: t[metric] ?? null });
    }
    return out;
  }, [rows, win, metric, role]);
  const metrics = role === 'bat' ? [['ops', 'OPS'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG']] : [['era', 'ERA'], ['whip', 'WHIP'], ['k9', 'K/9']];
  const gameVals = (g) => (role === 'bat' ? (g.stat.atBats || g.stat.baseOnBalls ? sumHitting([g.stat]).ops : null) : gameScore(g.stat));
  const vals = shown.map(gameVals);

  if (loading && !data) return <div className="muted pad">Loading game log…</div>;
  if (error && !data) return <ApiError inline what="the game log" error={error} retry={retry} />;
  return (
    <>
      <div className="row">
        <Seg value={gt} onChange={setGt} options={[['R', 'Regular season'], ['P', 'Postseason']]} />
        <Seg value={site} onChange={setSite} options={[['all', 'All'], ['home', 'Home'], ['away', 'Away']]} />
        <Seg value={last} onChange={setLast} options={[['all', 'Whole season'], [30, 'Last 30'], [10, 'Last 10'], [5, 'Last 5']]} />
      </div>
      {!rows.length ? <div className="muted pad">No {gt === 'P' ? 'postseason' : 'regular-season'} games for {season}.</div> : (
        <>
          <div className="row"><b>Rolling {win} games</b>
            <Seg value={metric} onChange={setMetric} options={metrics} />
            <select value={win} onChange={(e) => setWin(+e.target.value)}>{[5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} games</option>)}</select></div>
          <LineChart series={[{ label: `Rolling ${win}-game ${metrics.find((m) => m[0] === metric)[1]}`, points: series }]} fmt={(v) => (role === 'bat' ? r3(v) : r2(v))} height={180} xTicks={series.filter((_, i) => i % Math.ceil(series.length / 8) === 0).map((p) => p.x)} />
          <div className="muted small">x-axis is game number in the season.</div>
          <div className="scroll tall"><table className="t sticky-first" data-cust={role === 'pit' ? 'gamelog-pit' : 'gamelog-bat'} data-title="Game log"><thead><tr>
            <th className="l">Date</th><th className="l">Opp</th><th className="l">Result</th>
            {role === 'bat'
              ? ['PA', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'SB', 'OPS', 'AVG', 'OBP', 'SLG'].map((h, i) => <th key={h} title={i >= 11 ? (i === 11 ? 'OPS in this game' : 'Season to date, after this game') : undefined}>{h}</th>)
              : ['GS', 'Dec', 'IP', 'H', 'R', 'ER', 'HR', 'BB', 'SO', 'NP', 'GSc', 'ERA', 'WHIP'].map((h, i) => <th key={h} title={h === 'GSc' ? 'Bill James Game Score' : i >= 11 ? 'Season to date, after this game' : undefined}>{h}</th>)}</tr></thead>
            <tbody>
              <tr className="sel"><td className="l"><b>{shown.length} games</b></td><td className="l" /><td className="l" />
                {role === 'bat'
                  ? [total.pa, total.ab, total.r, total.h, total.d, total.t, total.hr, total.rbi, total.bb, total.so, total.sb, r3(total.ops), r3(total.avg), r3(total.obp), r3(total.slg)].map((v, i) => <td key={i} className="mono"><b>{v}</b></td>)
                  : [total.gs, `${total.w}-${total.l}${total.sv ? ` ${total.sv}SV` : ''}`, total.ip, total.h, total.r, total.er, total.hr, total.bb, total.so, total.np, '', r2(total.era), r2(total.whip)].map((v, i) => <td key={i} className="mono"><b>{v}</b></td>)}</tr>
              {shown.map((g, i) => { const s = g.stat; const pk = g.game?.gamePk; const dec = s.wins ? 'W' : s.losses ? 'L' : s.saves ? 'SV' : s.holds ? 'H' : s.blownSaves ? 'BS' : '';
                return (
                  <tr key={(pk || g.date) + i}>
                    <td className="l">{pk ? <Link to={`/game/${pk}`}>{d(g.date)}</Link> : d(g.date)}</td>
                    <td className="l">{g.isHome ? 'vs' : '@'} <TeamLink id={g.opponent?.id} size={16} /></td>
                    <td className="l"><span className={g.isWin ? 'upc' : 'dnc'}><b>{g.isWin ? 'W' : 'L'}</b></span></td>
                    {role === 'bat'
                      ? <>{[s.plateAppearances, s.atBats, s.runs, s.hits, s.doubles, s.triples, s.homeRuns, s.rbi, s.baseOnBalls, s.strikeOuts, s.stolenBases].map((v, j) => <td key={j} className="mono" style={j === 3 && s.hits >= 3 ? tint(90, 40) : j === 6 && s.homeRuns ? tint(90, 40) : undefined}>{v ?? 0}</td>)}
                        <td className="mono" style={tint(heat(vals, vals[i], 1), 40)}>{vals[i] == null ? '—' : r3(vals[i])}</td><td className="mono">{r3(g.run.avg)}</td><td className="mono">{r3(g.run.obp)}</td><td className="mono">{r3(g.run.slg)}</td></>
                      : <>{[s.gamesStarted, dec, s.inningsPitched, s.hits, s.runs, s.earnedRuns, s.homeRuns, s.baseOnBalls, s.strikeOuts, s.numberOfPitches].map((v, j) => <td key={j} className="mono">{v ?? ''}</td>)}
                        <td className="mono" style={tint(heat(vals, vals[i], 1), 40)}>{vals[i]}</td><td className="mono">{r2(g.run.era)}</td><td className="mono">{r2(g.run.whip)}</td></>}
                  </tr>); })}
            </tbody></table></div>
          <div className="muted small">Each date links to the game page. The first row totals the games shown by the filters. Source: MLB Stats API.</div>
        </>)}
    </>
  );
}
