import { useMemo } from 'react';
import ApiError from './ApiError.jsx';
import { useApi } from '../lib/mlbapi.js';
import { gameScore, sumHitting } from '../lib/saber.js';
import { heat } from '../lib/stats.js';
import { tint } from '../lib/themes.js';
import { TeamLogo } from './team.jsx';
import { teamById } from '../lib/teams.js';

const d = (s) => new Date(s + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });

/** Last n games for the Overview tab (MLB Stats API game log). */
export default function RecentGames({ id, role, season, n = 8, onMore }) {
  const group = role === 'bat' ? 'hitting' : 'pitching';
  const { data, error, loading, retry } = useApi(`/people/${id}/stats?stats=gameLog&group=${group}&season=${season}&gameType=R`, { ttl: 300000, pick: (x) => x?.stats?.[0]?.splits || [] });
  const rows = useMemo(() => [...(data || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n), [data, n]);
  const val = (g) => (role === 'bat' ? (g.stat.atBats || g.stat.baseOnBalls ? sumHitting([g.stat]).ops : null) : gameScore(g.stat));
  const vals = rows.map(val);
  if (loading && !data) return <div className="muted pad">Loading recent games…</div>;
  if (error && !data) return <ApiError inline what="recent games" error={error} retry={retry} />;
  if (!rows.length) return <div className="muted">No regular-season games logged for {season}.</div>;
  return (
    <>
      <div className="scroll"><table className="t sm"><thead><tr><th className="l">Date</th><th className="l">Opp</th>
        {role === 'bat' ? ['AB', 'H', 'HR', 'RBI', 'BB', 'SO', 'OPS'].map((h) => <th key={h}>{h}</th>) : ['IP', 'H', 'ER', 'BB', 'SO', 'NP', 'GSc'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((g, i) => { const s = g.stat; const v = vals[i]; const cells = role === 'bat' ? [s.atBats, s.hits, s.homeRuns, s.rbi, s.baseOnBalls, s.strikeOuts] : [s.inningsPitched, s.hits, s.earnedRuns, s.baseOnBalls, s.strikeOuts, s.numberOfPitches]; return (
          <tr key={i}><td className="l">{g.game?.gamePk ? <a href={`https://www.mlb.com/gameday/${g.game.gamePk}`} target="_blank" rel="noreferrer">{d(g.date)}</a> : d(g.date)}</td>
            <td className="l">{g.isHome ? 'vs' : '@'} <TeamLogo id={g.opponent?.id} size={14} /> {teamById(g.opponent?.id)?.abbr}</td>
            {cells.map((c, j) => <td key={j} className="mono">{c ?? 0}</td>)}
            <td className="mono" style={typeof v === 'number' ? tint(heat(vals, v, 1), 40) : undefined}>{v == null ? '—' : role === 'bat' ? v.toFixed(3).replace(/^0/, '') : Math.round(v)}</td></tr>); })}</tbody></table></div>
      {onMore && <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={onMore}>All game logs →</button>}
    </>
  );
}
