import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { feedPath, useApi, winProbPath } from '../lib/mlbapi.js';
import { TeamLink } from '../components/team.jsx';
import { Diamond, Linescore } from '../components/game.jsx';
import { LineChart } from '../components/charts.jsx';
import { Seg } from '../components/ui.jsx';
import { tint } from '../lib/themes.js';
import { usePref } from '../lib/data.js';

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—');
const fmt3 = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x.toFixed(3).replace(/^0/, '') : '—'; };
const PCOLOR = { FF: 'var(--c2)', FA: 'var(--c2)', SI: 'var(--c4)', FT: 'var(--c4)', FC: 'var(--c5)', SL: 'var(--c1)', ST: 'var(--c1)', SV: 'var(--c1)', CU: 'var(--c3)', KC: 'var(--c3)', CS: 'var(--c3)', CH: 'var(--c6)', FS: 'var(--c6)', FO: 'var(--c6)', KN: 'var(--muted)' };
const pcolor = (code) => PCOLOR[code] || 'var(--muted)';
const SWING = new Set(['S', 'W', 'T', 'F', 'L', 'M', 'Q', 'X', 'D', 'E']); // swinging/foul/in play codes
const WHIFF = new Set(['S', 'W', 'T', 'M', 'Q']);
const CALLED = new Set(['C']);

/** Flatten pitches out of the feed: [{...pitch, play}] */
function pitchesOf(feed) {
  const out = [];
  for (const play of feed?.liveData?.plays?.allPlays || []) {
    for (const ev of play.playEvents || []) {
      if (!ev.isPitch) continue;
      out.push({ ev, play, code: ev.details?.type?.code || '??', name: ev.details?.type?.description || 'Unknown', call: ev.details?.call?.code, pd: ev.pitchData || {}, batter: play.matchup?.batter, pitcher: play.matchup?.pitcher, side: play.matchup?.batSide?.code, half: play.about?.halfInning });
    }
  }
  return out;
}
function ballsInPlay(feed) {
  const out = [];
  for (const play of feed?.liveData?.plays?.allPlays || []) {
    const ev = [...(play.playEvents || [])].reverse().find((e) => e.hitData);
    if (!ev) continue;
    out.push({ play, hit: ev.hitData, batter: play.matchup?.batter, pitcher: play.matchup?.pitcher, result: play.result?.event, desc: play.result?.description, inning: play.about?.inning, half: play.about?.halfInning });
  }
  return out;
}

/* ---------- box score ---------- */
function TeamBox({ side, box, label }) {
  const t = box?.teams?.[side]; if (!t) return null;
  const pl = (id) => t.players?.[`ID${id}`];
  const bats = (t.batters || []).map(pl).filter((p) => p?.battingOrder);
  const pit = (t.pitchers || []).map(pl).filter(Boolean);
  const tb = t.teamStats?.batting || {}, tp = t.teamStats?.pitching || {};
  const notes = (t.info || []).flatMap((i) => (i.fieldList || []).map((f) => ({ title: i.title, ...f })));
  return (
    <div className="panel card">
      <h3>{label}</h3>
      <div className="scroll"><table className="t sm sticky-first"><thead><tr><th className="l">Batters</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>HR</th><th>LOB</th><th title="Season">AVG</th><th title="Season">OPS</th></tr></thead>
        <tbody>{bats.map((p) => { const b = p.stats?.batting || {}; const s = p.seasonStats?.batting || {}; const sub = +p.battingOrder % 100 !== 0; return (
          <tr key={p.person.id} className={sub ? 'subrow' : ''}><td className="l">{sub ? '  ' : ''}<Link to={`/player/bat/${p.person.id}`}>{p.person.fullName}</Link> <span className="muted small">{p.position?.abbreviation}</span></td>
            {[b.atBats, b.runs, b.hits, b.rbi, b.baseOnBalls, b.strikeOuts, b.homeRuns, b.leftOnBase].map((v, i) => <td key={i} className="mono" style={i === 2 && b.hits >= 2 ? tint(85, 35) : i === 6 && b.homeRuns ? tint(95, 45) : undefined}>{v ?? 0}</td>)}
            <td className="mono muted">{fmt3(s.avg)}</td><td className="mono muted">{fmt3(s.ops)}</td></tr>); })}
          <tr className="sel"><td className="l"><b>Totals</b></td>{[tb.atBats, tb.runs, tb.hits, tb.rbi, tb.baseOnBalls, tb.strikeOuts, tb.homeRuns, tb.leftOnBase].map((v, i) => <td key={i} className="mono"><b>{v ?? 0}</b></td>)}<td /><td /></tr></tbody></table></div>
      {notes.length > 0 && <div className="small" style={{ margin: '8px 0' }}>{['BATTING', 'BASERUNNING', 'FIELDING'].map((tt) => { const ns = notes.filter((n) => n.title === tt); return ns.length ? <div key={tt}><b>{tt[0] + tt.slice(1).toLowerCase()}:</b> {ns.map((n) => `${n.label}: ${n.value}`).join(' · ')}</div> : null; })}</div>}
      <div className="scroll"><table className="t sm sticky-first"><thead><tr><th className="l">Pitchers</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>HR</th><th title="Pitches-strikes">P-S</th><th title="Season">ERA</th></tr></thead>
        <tbody>{pit.map((p) => { const s = p.stats?.pitching || {}; return (
          <tr key={p.person.id}><td className="l"><Link to={`/player/pit/${p.person.id}`}>{p.person.fullName}</Link> {s.note && <span className="muted small">{s.note}</span>}</td>
            {[s.inningsPitched, s.hits, s.runs, s.earnedRuns, s.baseOnBalls, s.strikeOuts, s.homeRuns].map((v, i) => <td key={i} className="mono">{v ?? 0}</td>)}<td className="mono">{s.numberOfPitches ?? '—'}-{s.strikes ?? '—'}</td><td className="mono muted">{p.seasonStats?.pitching?.era ?? '—'}</td></tr>); })}
          <tr className="sel"><td className="l"><b>Totals</b></td>{[tp.inningsPitched, tp.hits, tp.runs, tp.earnedRuns, tp.baseOnBalls, tp.strikeOuts, tp.homeRuns].map((v, i) => <td key={i} className="mono"><b>{v ?? 0}</b></td>)}<td className="mono"><b>{tp.numberOfPitches ?? '—'}-{tp.strikes ?? '—'}</b></td><td /></tr></tbody></table></div>
    </div>
  );
}
function BoxTab({ feed, names }) {
  const box = feed?.liveData?.boxscore;
  return (
    <>
      <TeamBox side="away" box={box} label={names.away} />
      <TeamBox side="home" box={box} label={names.home} />
      {(box?.note || []).length > 0 && <div className="muted small">{box.note.map((n) => `${n.label}: ${n.value}`).join(' · ')}</div>}
    </>
  );
}

/* ---------- play by play ---------- */
function PlayCard({ play }) {
  const pit = (play.playEvents || []).filter((e) => e.isPitch);
  const hit = [...(play.playEvents || [])].reverse().find((e) => e.hitData)?.hitData;
  const hr = play.result?.event === 'Home Run';
  return (
    <div className={'play' + (play.about?.isScoringPlay ? ' scoring' : '') + (hr ? ' hr' : '')}>
      <div><span className="who">{play.matchup?.batter?.fullName}</span> <span className="muted small">vs {play.matchup?.pitcher?.fullName} · {play.count?.outs ?? '?'} out after</span></div>
      <div>{play.result?.description || play.result?.event}</div>
      {play.about?.isScoringPlay && <div className="small"><b>{play.result?.awayScore}-{play.result?.homeScore}</b></div>}
      {pit.length > 0 && <div className="pitches">{pit.map((e, i) => { const k = e.details?.call?.code; const cls = e.details?.isInPlay ? 'inplay' : e.details?.isBall ? 'ball' : e.details?.isStrike ? 'strike' : ''; return <span key={i} className={'pchip ' + cls} title={e.details?.description}>{e.pitchNumber ?? i + 1}. {e.details?.type?.code || ''} {e.pitchData?.startSpeed ? Math.round(e.pitchData.startSpeed) : ''} {e.details?.call?.description || k || ''}</span>; })}</div>}
      {hit && <div className="small muted">{hit.launchSpeed ? `Exit velo ${num(hit.launchSpeed, 1)} mph` : ''}{hit.launchAngle != null ? ` · LA ${num(hit.launchAngle)}°` : ''}{hit.totalDistance ? ` · ${num(hit.totalDistance)} ft` : ''}{hit.trajectory ? ` · ${hit.trajectory.replace(/_/g, ' ')}` : ''}</div>}
    </div>
  );
}
function PbpTab({ feed, names }) {
  const [f, setF] = useState('all');
  const plays = feed?.liveData?.plays?.allPlays || [];
  const groups = [];
  for (const p of plays) {
    if (f === 'scoring' && !p.about?.isScoringPlay) continue;
    if (f === 'bip' && !(p.playEvents || []).some((e) => e.hitData)) continue;
    const key = `${p.about?.halfInning}${p.about?.inning}`;
    let g = groups.at(-1); if (!g || g.key !== key) { g = { key, inning: p.about?.inning, half: p.about?.halfInning, plays: [] }; groups.push(g); }
    g.plays.push(p);
  }
  return (
    <>
      <div className="row"><Seg value={f} onChange={setF} options={[['all', 'All plays'], ['scoring', 'Scoring plays'], ['bip', 'Batted balls']]} /><span className="muted small">{plays.length} plate appearances</span></div>
      {!groups.length && <div className="muted pad">No plays to show yet.</div>}
      {groups.map((g) => <div key={g.key}><div className="inn-h">{g.half === 'top' ? 'Top' : 'Bottom'} {g.inning} · {g.half === 'top' ? names.away : names.home} batting</div>{g.plays.map((p, i) => <PlayCard key={i} play={p} />)}</div>)}
    </>
  );
}

/* ---------- win probability ---------- */
function WinTab({ pk, names }) {
  const { data, error, loading } = useApi(winProbPath(pk), { ttl: 20000 });
  const rows = Array.isArray(data) ? data : [];
  if (loading && !data) return <div className="muted pad">Loading win probability…</div>;
  if (error && !data) return <div className="muted pad">Win probability unavailable ({String(error.message)}).</div>;
  if (!rows.length) return <div className="muted pad">No win probability data for this game.</div>;
  const pts = [{ x: 0, y: 50 }, ...rows.map((r, i) => ({ x: i + 1, y: r.homeTeamWinProbability }))];
  const top = [...rows].filter((r) => typeof r.homeTeamWinProbabilityAdded === 'number').sort((a, b) => Math.abs(b.homeTeamWinProbabilityAdded) - Math.abs(a.homeTeamWinProbabilityAdded)).slice(0, 10);
  return (
    <>
      <div className="wp-key"><span><i style={{ background: 'var(--c1)' }} />{names.home} win probability (100% = home win)</span></div>
      <LineChart series={[{ label: `${names.home} win %`, points: pts }]} fmt={(v) => `${Math.round(v)}%`} height={240} xTicks={[]} />
      <div className="muted small">x-axis: plate appearances in order. The line starts at 50%.</div>
      <h4>Biggest swings</h4>
      <div className="scroll"><table className="t sm"><thead><tr><th className="l">Play</th><th>Inning</th><th>Home WPA</th><th>Home WP after</th><th>LI</th></tr></thead>
        <tbody>{top.map((r, i) => <tr key={i}><td className="l" style={{ whiteSpace: 'normal', maxWidth: 480 }}>{r.result?.description || r.result?.event}</td><td>{r.about?.halfInning === 'top' ? '▲' : '▼'}{r.about?.inning}</td>
          <td className="mono" style={tint(50 + (r.homeTeamWinProbabilityAdded / 50) * 50, 45)}>{r.homeTeamWinProbabilityAdded > 0 ? '+' : ''}{num(r.homeTeamWinProbabilityAdded, 1)}%</td><td className="mono">{num(r.homeTeamWinProbability, 0)}%</td><td className="mono">{r.leverageIndex != null ? num(r.leverageIndex, 2) : '—'}</td></tr>)}</tbody></table></div>
    </>
  );
}

/* ---------- pitches ---------- */
function PitchTab({ feed, names }) {
  const all = useMemo(() => pitchesOf(feed), [feed]);
  const pitchers = useMemo(() => { const m = new Map(); for (const p of all) if (p.pitcher) m.set(p.pitcher.id, p.pitcher.fullName); return [...m.entries()]; }, [all]);
  const [pid, setPid] = useState('all');
  const [hand, setHand] = useState('all');
  const sel = all.filter((p) => (pid === 'all' || p.pitcher?.id === +pid) && (hand === 'all' || p.side === hand) && typeof p.pd.coordinates?.pX === 'number');
  const rows = all.filter((p) => pid === 'all' || p.pitcher?.id === +pid).filter((p) => hand === 'all' || p.side === hand);
  const types = useMemo(() => {
    const m = new Map();
    for (const p of rows) { const t = m.get(p.code) || { code: p.code, name: p.name, n: 0, v: [], spin: [], ivb: [], hb: [], sw: 0, wh: 0, cs: 0 }; t.n++; if (p.pd.startSpeed) t.v.push(p.pd.startSpeed); if (p.pd.breaks?.spinRate) t.spin.push(p.pd.breaks.spinRate); if (p.pd.breaks?.breakVerticalInduced != null) t.ivb.push(p.pd.breaks.breakVerticalInduced); if (p.pd.breaks?.breakHorizontal != null) t.hb.push(p.pd.breaks.breakHorizontal); if (SWING.has(p.call) && p.call !== 'F' && p.call !== 'L') t.sw++; if (WHIFF.has(p.call)) t.wh++; if (CALLED.has(p.call)) t.cs++; m.set(p.code, t); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [rows]);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const top = avg(sel.map((p) => p.pd.strikeZoneTop).filter(Boolean)) ?? 3.5, bot = avg(sel.map((p) => p.pd.strikeZoneBottom).filter(Boolean)) ?? 1.6;
  const W = 330, H = 400, X = (x) => W / 2 + x * 66, Y = (z) => H - 20 - z * 66;
  const [hov, setHov] = useState(null);
  if (!all.length) return <div className="muted pad">No pitch data for this game yet.</div>;
  return (
    <>
      <div className="row"><select value={pid} onChange={(e) => setPid(e.target.value)}><option value="all">All pitchers</option>{pitchers.map(([id, nm]) => <option key={id} value={id}>{nm}</option>)}</select>
        <Seg value={hand} onChange={setHand} options={[['all', 'All batters'], ['L', 'vs LHB'], ['R', 'vs RHB']]} /></div>
      <div className="zone-wrap">
        <div className="zone"><svg viewBox={`0 0 ${W} ${H}`} width={W} onMouseLeave={() => setHov(null)}>
          <rect x={X(-0.83)} y={Y(top)} width={X(0.83) - X(-0.83)} height={Y(bot) - Y(top)} className="zonebox" />
          <path d={`M${X(-0.7)},${Y(0.1)} L${X(0.7)},${Y(0.1)} L${X(0.7)},${Y(0.3)} L${X(0)},${Y(0.5)} L${X(-0.7)},${Y(0.3)} Z`} fill="none" stroke="var(--muted)" />
          {sel.map((p, i) => <circle key={i} cx={X(p.pd.coordinates.pX)} cy={Y(p.pd.coordinates.pZ)} r={hov === p ? 7 : 4.6} fill={pcolor(p.code)} className="pdot" onMouseEnter={() => setHov(p)} />)}
          {hov && <g pointerEvents="none"><rect x="6" y="6" width="230" height="38" rx="6" className="tipbox" /><text x="14" y="22" className="tiptext b">{hov.name} {hov.pd.startSpeed ? `${num(hov.pd.startSpeed, 1)} mph` : ''}</text><text x="14" y="37" className="tiptext">{hov.batter?.fullName} · {hov.ev.details?.call?.description}</text></g>}
        </svg><div className="muted small">Catcher’s view. Box is the average strike zone.</div></div>
        <div className="grow scroll"><table className="t sm"><thead><tr><th className="l">Pitch</th><th>#</th><th>Usage</th><th>Avg mph</th><th>Max</th><th>Spin</th><th title="Induced vertical break">IVB</th><th title="Horizontal break">HB</th><th>Whiffs</th><th>Called K</th><th>CSW%</th></tr></thead>
          <tbody>{types.map((t) => <tr key={t.code}><td className="l"><i className="dotkey" style={{ background: pcolor(t.code) }} />{t.name}</td><td>{t.n}</td><td className="mono">{num((t.n / rows.length) * 100, 0)}%</td><td className="mono">{num(avg(t.v), 1)}</td><td className="mono">{num(t.v.length ? Math.max(...t.v) : null, 1)}</td><td className="mono">{num(avg(t.spin), 0)}</td><td className="mono">{num(avg(t.ivb), 1)}</td><td className="mono">{num(avg(t.hb), 1)}</td><td>{t.wh}</td><td>{t.cs}</td><td className="mono">{num(((t.wh + t.cs) / t.n) * 100, 0)}%</td></tr>)}</tbody></table>
          <div className="muted small">Breaks are in inches. {names.away} and {names.home} pitchers are both listed.</div></div>
      </div>
    </>
  );
}

/* ---------- batted balls ---------- */
const BIP_COLOR = (r) => (r === 'Home Run' ? 'var(--c2)' : /Single|Double|Triple/.test(r || '') ? 'var(--c3)' : 'var(--muted)');
function BipTab({ feed }) {
  const bips = useMemo(() => ballsInPlay(feed), [feed]);
  const [hov, setHov] = useState(null);
  if (!bips.length) return <div className="muted pad">No batted-ball data yet.</div>;
  const spray = bips.filter((b) => b.hit.coordinates?.coordX != null);
  const mx = Math.max(1, ...bips.map((b) => b.hit.launchSpeed || 0));
  return (
    <div className="zone-wrap">
      <div className="zone"><svg viewBox="0 0 250 230" width={330} className="field" onMouseLeave={() => setHov(null)}>
        <path d="M125,200 L10,85 A150,150 0 0 1 240,85 Z" /><path d="M125,200 L85,160 L125,120 L165,160 Z" />
        {spray.map((b, i) => <circle key={i} cx={b.hit.coordinates.coordX} cy={b.hit.coordinates.coordY} r={hov === b ? 6 : 3.8} fill={BIP_COLOR(b.result)} className="bb-dot" onMouseEnter={() => setHov(b)} />)}
        {hov && <g pointerEvents="none"><rect x="4" y="4" width="200" height="34" rx="6" className="tipbox" /><text x="10" y="19" className="tiptext b">{hov.batter?.fullName} · {hov.result}</text><text x="10" y="32" className="tiptext">{num(hov.hit.launchSpeed, 1)} mph · {num(hov.hit.launchAngle)}° · {num(hov.hit.totalDistance)} ft</text></g>}
      </svg><div className="muted small">Spray chart. Green-ish = hit, red = home run, grey = out.</div></div>
      <div className="grow scroll tall"><table className="t sm"><thead><tr><th className="l">Batter</th><th className="l">Pitcher</th><th>Inn</th><th className="l">Result</th><th>EV</th><th>LA</th><th>Dist</th><th className="l">Type</th></tr></thead>
        <tbody>{[...bips].sort((a, b) => (b.hit.launchSpeed || 0) - (a.hit.launchSpeed || 0)).map((b, i) => <tr key={i} onMouseEnter={() => setHov(b)}><td className="l">{b.batter?.fullName}</td><td className="l">{b.pitcher?.fullName}</td><td>{b.half === 'top' ? '▲' : '▼'}{b.inning}</td><td className="l">{b.result}</td>
          <td className="mono" style={tint((b.hit.launchSpeed || 0) / mx * 100, 40)}>{num(b.hit.launchSpeed, 1)}</td><td className="mono">{num(b.hit.launchAngle)}°</td><td className="mono">{num(b.hit.totalDistance)}</td><td className="l">{(b.hit.trajectory || '').replace(/_/g, ' ')}</td></tr>)}</tbody></table></div>
    </div>
  );
}

/* ---------- info ---------- */
function InfoTab({ feed }) {
  const gd = feed?.gameData || {}; const box = feed?.liveData?.boxscore; const dec = feed?.liveData?.decisions;
  const rows = [
    ['Venue', [gd.venue?.name, gd.venue?.location?.city].filter(Boolean).join(', ')],
    ['First pitch', gd.datetime?.dateTime ? new Date(gd.datetime.dateTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''],
    ['Weather', [gd.weather?.condition, gd.weather?.temp ? `${gd.weather.temp}°F` : '', gd.weather?.wind ? `wind ${gd.weather.wind}` : ''].filter(Boolean).join(', ')],
    ['Attendance', gd.gameInfo?.attendance?.toLocaleString?.() || ''], ['Duration', gd.gameInfo?.gameDurationMinutes ? `${Math.floor(gd.gameInfo.gameDurationMinutes / 60)}:${String(gd.gameInfo.gameDurationMinutes % 60).padStart(2, '0')}` : ''],
    ['Decisions', [dec?.winner && `W: ${dec.winner.fullName}`, dec?.loser && `L: ${dec.loser.fullName}`, dec?.save && `SV: ${dec.save.fullName}`].filter(Boolean).join(' · ')],
    ['Umpires', (box?.officials || []).map((o) => `${o.officialType}: ${o.official?.fullName}`).join(' · ')],
    ...((box?.info || []).map((i) => [i.label, i.value])),
  ].filter((r) => r[1]);
  return <table className="t sm"><tbody>{rows.map(([k, v], i) => <tr key={i}><td className="l"><b>{k}</b></td><td className="l" style={{ whiteSpace: 'normal' }}>{v}</td></tr>)}</tbody></table>;
}

export default function Game() {
  const { pk } = useParams();
  const [tab, setTab] = usePref('game:tab', 'box');
  const { data: feed, error, loading } = useApi(feedPath(pk), { refresh: 20000, ttl: 10000 });
  const gd = feed?.gameData, ld = feed?.liveData;
  const status = gd?.status?.abstractGameState; const live = status === 'Live';
  const away = gd?.teams?.away, home = gd?.teams?.home;
  const names = { away: away?.name || 'Away', home: home?.name || 'Home' };
  const ls = ld?.linescore;
  const rs = (s) => ls?.teams?.[s]?.runs;
  const TABS = [['box', 'Box score'], ['pbp', 'Play by play'], ['wp', 'Win probability'], ['pitch', 'Pitches'], ['bip', 'Batted balls'], ['info', 'Game info']];
  if (loading && !feed) return <div className="muted pad">Loading game…</div>;
  if (error && !feed) return <div className="panel">Couldn’t load this game from the MLB Stats API ({String(error.message)}). <Link to="/games">Back to games</Link></div>;
  return (
    <>
      <section className="panel">
        <div className="muted small"><Link to="/games">‹ All games</Link> · {gd?.datetime?.officialDate} · {gd?.venue?.name}</div>
        <div className="gtitle">
          {['away', 'home'].map((s) => { const t = s === 'away' ? away : home; const win = status === 'Final' && rs(s) > rs(s === 'away' ? 'home' : 'away'); return (
            <div key={s} className={'gside' + (status === 'Final' && !win ? ' lose' : '')} style={{ order: s === 'away' ? 0 : 2 }}>
              <TeamLink id={t?.id} size={52} full /><span className="bigscore">{rs(s) ?? ''}</span></div>); })}
          <div className="gmid" style={{ order: 1 }}><b className={live ? 'status live' : ''}>{live ? `● ${ls?.inningState || ''} ${ls?.currentInningOrdinal || ''}` : gd?.status?.detailedState}</b>
            {live && <div><Diamond runners={{ first: ls?.offense?.first, second: ls?.offense?.second, third: ls?.offense?.third }} outs={ls?.outs || 0} /></div>}
            {live && <div className="small muted">{ls?.balls}-{ls?.strikes} · {ld?.plays?.currentPlay?.matchup?.batter?.fullName} vs {ld?.plays?.currentPlay?.matchup?.pitcher?.fullName}</div>}</div>
        </div>
        <Linescore ls={ls} away={away} home={home} />
        {live && <div className="muted small">Live: refreshing every 20 seconds.</div>}
      </section>
      <div className="tabs game-tabs">{TABS.map(([id, l]) => <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}</div>
      {tab === 'box' && <BoxTab feed={feed} names={names} />}
      {tab !== 'box' && <section className="panel">
        {tab === 'pbp' && <PbpTab feed={feed} names={names} />}
        {tab === 'wp' && <WinTab pk={pk} names={names} />}
        {tab === 'pitch' && <PitchTab feed={feed} names={names} />}
        {tab === 'bip' && <BipTab feed={feed} />}
        {tab === 'info' && <InfoTab feed={feed} />}
      </section>}
    </>
  );
}
