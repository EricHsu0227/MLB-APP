import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, boxscorePath, gameStatus, gamesOf, schedulePath, useApi, ymd } from '../lib/mlbapi.js';
import { TeamLink } from '../components/team.jsx';
import { usePref } from '../lib/data.js';

function Box({ pk }) {
  const { data, error, loading } = useApi(boxscorePath(pk), { ttl: 20000 });
  if (loading && !data) return <div className="muted pad">Loading box score…</div>;
  if (error) return <div className="muted pad">Box score unavailable ({String(error.message)}).</div>;
  return (
    <div className="box-grid">
      {['away', 'home'].map((side) => {
        const t = data?.teams?.[side]; if (!t) return null;
        const pl = (id) => t.players?.[`ID${id}`];
        const bats = (t.batters || []).map(pl).filter((p) => p?.stats?.batting && p.stats.batting.atBats != null && (p.battingOrder || p.stats.batting.plateAppearances));
        const pit = (t.pitchers || []).map(pl).filter(Boolean);
        return (
          <div key={side}>
            <h4><TeamLink id={t.team?.id} size={20} full /></h4>
            <table className="t sm"><thead><tr><th className="l">Batter</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th></tr></thead>
              <tbody>{bats.map((p) => { const b = p.stats.batting; return <tr key={p.person.id} className={p.battingOrder && +p.battingOrder % 100 ? 'subrow' : ''}><td className="l"><Link to={`/player/bat/${p.person.id}`}>{p.person.fullName}</Link> <span className="muted small">{p.position?.abbreviation}</span></td><td>{b.atBats}</td><td>{b.runs}</td><td>{b.hits}</td><td>{b.rbi}</td><td>{b.baseOnBalls}</td><td>{b.strikeOuts}</td></tr>; })}</tbody></table>
            <table className="t sm"><thead><tr><th className="l">Pitcher</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th></tr></thead>
              <tbody>{pit.map((p) => { const s = p.stats.pitching || {}; return <tr key={p.person.id}><td className="l"><Link to={`/player/pit/${p.person.id}`}>{p.person.fullName}</Link></td><td>{s.inningsPitched}</td><td>{s.hits}</td><td>{s.runs}</td><td>{s.earnedRuns}</td><td>{s.baseOnBalls}</td><td>{s.strikeOuts}</td></tr>; })}</tbody></table>
          </div>);
      })}
    </div>
  );
}

function Line({ g }) {
  const ls = g.linescore; const inns = ls?.innings || [];
  if (!inns.length) return null;
  const n = Math.max(9, inns.length);
  return (
    <div className="scroll"><table className="t sm linescore"><thead><tr><th className="l" />{Array.from({ length: n }, (_, i) => <th key={i}>{i + 1}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead>
      <tbody>{['away', 'home'].map((s) => <tr key={s}><td className="l"><b>{g.teams[s].team.abbreviation || g.teams[s].team.name}</b></td>{Array.from({ length: n }, (_, i) => <td key={i}>{inns[i]?.[s]?.runs ?? ''}</td>)}<td><b>{ls.teams?.[s]?.runs}</b></td><td>{ls.teams?.[s]?.hits}</td><td>{ls.teams?.[s]?.errors}</td></tr>)}</tbody></table></div>
  );
}

function GameCard({ g }) {
  const [open, setOpen] = useState(false);
  const st = gameStatus(g);
  const sides = ['away', 'home'].map((s) => g.teams[s]);
  const started = st.kind === 'final' || st.kind === 'live';
  const dec = g.decisions;
  return (
    <div className={'panel game ' + st.kind}>
      <div className="game-row" onClick={() => started && setOpen(!open)} role={started ? 'button' : undefined}>
        <div className="game-teams">
          {sides.map((t, i) => (
            <div className={'gt' + (t.isWinner ? ' win' : st.kind === 'final' ? ' lose' : '')} key={i}>
              <TeamLink id={t.team.id} size={30} full /><span className="muted small">{t.leagueRecord ? `${t.leagueRecord.wins}-${t.leagueRecord.losses}` : ''}</span>
              <b className="score">{started ? t.score : ''}</b>
            </div>))}
        </div>
        <div className="game-meta"><span className={'status ' + st.kind}>{st.kind === 'live' && '● '}{st.text}</span>
          <span className="muted small">{g.venue?.name}</span>
          {st.kind === 'pre' && <span className="muted small">{sides.map((t) => t.probablePitcher?.fullName || 'TBD').join(' vs ')}</span>}
          {st.kind === 'final' && dec?.winner && <span className="muted small">W {dec.winner.fullName}{dec.loser ? ` · L ${dec.loser.fullName}` : ''}{dec.save ? ` · SV ${dec.save.fullName}` : ''}</span>}
          {started && <span className="muted small">{open ? '▲ hide box' : '▼ box score'}</span>}</div>
      </div>
      {open && <><Line g={g} /><Box pk={g.gamePk} /></>}
    </div>
  );
}

export default function Games() {
  const [date, setDate] = usePref('games:date-v1', ymd(new Date()));
  const [today] = useState(ymd(new Date()));
  const { data, error, loading } = useApi(schedulePath(date), { refresh: 30000, ttl: 15000 });
  const games = gamesOf(data).filter((g) => g.teams?.home?.team && g.teams?.away?.team);
  const live = games.some((g) => g.status?.abstractGameState === 'Live');
  return (
    <>
      <section className="panel">
        <div className="row between"><h2 style={{ margin: 0 }}>Games</h2>
          <div className="row"><button type="button" className="btn sm" onClick={() => setDate(addDays(date, -1))}>‹ Prev</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button type="button" className="btn sm" onClick={() => setDate(addDays(date, 1))}>Next ›</button>
            <button type="button" className="btn sm" onClick={() => setDate(today)}>Today</button></div></div>
        <div className="muted small" style={{ marginTop: 6 }}>{loading && !data ? 'Loading…' : `${games.length} game${games.length === 1 ? '' : 's'}`}{live ? ' · live, refreshing every 30s' : ''} · Source: MLB Stats API</div>
      </section>
      {error && !data && <div className="panel">Couldn’t load games from the MLB Stats API ({String(error.message)}). Check your connection or ad blocker, then try again.</div>}
      {data && !games.length && <div className="panel muted">No games on this date. Try another day — the regular season runs from late March to late September.</div>}
      {games.map((g) => <GameCard key={g.gamePk} g={g} />)}
    </>
  );
}
