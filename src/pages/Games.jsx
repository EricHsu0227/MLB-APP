import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, gameStatus, gamesOf, schedulePath, useApi, ymd } from '../lib/mlbapi.js';
import { Diamond, Linescore, TeamLink } from '../components/game.jsx';
import { usePref } from '../lib/data.js';

function GameCard({ g }) {
  const st = gameStatus(g);
  const sides = ['away', 'home'].map((s) => g.teams[s]);
  const started = st.kind === 'final' || st.kind === 'live';
  const dec = g.decisions;
  const ls = g.linescore;
  return (
    <div className={'panel game ' + st.kind}>
      <div className="game-row">
        <div className="game-teams">
          {sides.map((t, i) => (
            <div className={'gt' + (t.isWinner ? ' win' : st.kind === 'final' ? ' lose' : '')} key={i}>
              <TeamLink id={t.team.id} size={30} full /><span className="muted small">{t.leagueRecord ? `${t.leagueRecord.wins}-${t.leagueRecord.losses}` : ''}</span>
              {st.kind === 'pre' && t.probablePitcher && <span className="muted small">{t.probablePitcher.fullName}</span>}
              <b className="score">{started ? t.score : ''}</b>
            </div>))}
        </div>
        <div className="game-meta">
          <span className={'status ' + st.kind}>{st.kind === 'live' && '● '}{st.text}</span>
          {st.kind === 'live' && <Diamond runners={ls?.offense || {}} outs={ls?.outs || 0} size={30} />}
          <span className="muted small">{g.venue?.name}</span>
          {st.kind === 'pre' && !sides.some((t) => t.probablePitcher) && <span className="muted small">Pitchers TBD</span>}
          {st.kind === 'final' && dec?.winner && <span className="muted small">W {dec.winner.fullName}{dec.loser ? ` · L ${dec.loser.fullName}` : ''}{dec.save ? ` · SV ${dec.save.fullName}` : ''}</span>}
          <Link className="btn sm" to={`/game/${g.gamePk}`}>{started ? 'Box score & play-by-play →' : 'Game preview →'}</Link>
        </div>
      </div>
      {started && <Linescore ls={ls} away={sides[0].team} home={sides[1].team} />}
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
