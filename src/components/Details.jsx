import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ApiError from './ApiError.jsx';
import { useApi } from '../lib/mlbapi.js';
import { Headshot } from './ui.jsx';
import { similarPlayers } from './Savant.jsx';

export const personPath = (id) => `/people/${id}?hydrate=currentTeam,draft`;
const dt = (s) => (s ? new Date(s + 'T12:00:00').toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : null);
const money = (v) => (v ? `$${Number(v).toLocaleString()}` : null);

/** Player details: bio and draft (MLB Stats API) plus outside links. */
export default function Details({ id, file, person, role, season, seasonFile }) {
  const { data: fetched, error, retry } = useApi(person ? null : personPath(id), { ttl: 3600000, pick: (x) => x?.people?.[0] });
  const data = person || fetched;
  const draft = data?.drafts?.find((d) => d.isDrafted !== false && d.team) || data?.drafts?.[0];
  const bio = data ? [
    ['Full name', data.fullName], ['Nickname', data.nickName], ['Born', [dt(data.birthDate), [data.birthCity, data.birthStateProvince, data.birthCountry].filter(Boolean).join(', ')].filter(Boolean).join(' · ')],
    ['Age', data.currentAge], ['Height / weight', data.height && `${data.height} · ${data.weight || '—'} lb`], ['Bats / throws', `${data.batSide?.description || '—'} / ${data.pitchHand?.description || '—'}`],
    ['Position', data.primaryPosition?.name], ['Team', data.currentTeam?.name], ['Jersey', data.primaryNumber && `#${data.primaryNumber}`],
    ['MLB debut', dt(data.mlbDebutDate)], ['Last played', dt(data.lastPlayedDate)], ['Status', data.active === false ? 'Inactive' : 'Active'],
  ].filter(([, v]) => v != null && v !== '') : [];
  const draftRows = draft ? [
    ['Drafted', `${draft.year} · Round ${draft.pickRound}${draft.roundPickNumber ? `, pick ${draft.roundPickNumber}` : ''}${draft.pickNumber ? ` (#${draft.pickNumber} overall)` : ''}`],
    ['By', draft.team?.name], ['From', draft.school?.name && `${draft.school.name}${draft.school.state ? `, ${draft.school.state}` : ''}`],
    ['Signing bonus', money(draft.signingBonus)], ['Pick value', money(draft.pickValue)],
  ].filter(([, v]) => v) : [];
  const Kv = ({ rows }) => <table className="t sm kv"><tbody>{rows.map(([k, v]) => <tr key={k}><td className="l muted">{k}</td><td className="l">{v}</td></tr>)}</tbody></table>;
  return (
    <div className="grid" style={{ '--cols': 2 }}>
      <section className="panel card">
        <h3>Bio</h3>
        {!data && !error && <div className="muted">Loading…</div>}
        {error && !data && <ApiError inline what="the bio" error={error} retry={retry} />}
        {data && <Kv rows={bio} />}
      </section>
      <section className="panel card">
        <h3>Draft</h3>
        {data && (draftRows.length ? <Kv rows={draftRows} /> : <div className="muted">Not drafted (signed as an international or undrafted free agent).</div>)}
        <h3 style={{ marginTop: 12 }}>Elsewhere</h3>
        <div className="row">
          <a className="btn sm" href={`https://baseballsavant.mlb.com/savant-player/${id}`} target="_blank" rel="noreferrer">Baseball Savant ↗</a>
          <a className="btn sm" href={`https://www.fangraphs.com/search?q=${encodeURIComponent(file.name)}`} target="_blank" rel="noreferrer">FanGraphs ↗</a>
          <a className="btn sm" href={`https://www.mlb.com/player/${id}`} target="_blank" rel="noreferrer">MLB.com ↗</a>
        </div>
      </section>
      <Awards id={id} />
      <Similar id={id} role={role} season={season} seasonFile={seasonFile} />
      <MinorLeagues id={id} role={role} />
      <Transactions id={id} />
    </div>
  );
}

function Awards({ id }) {
  const { data, error, retry } = useApi(`/people/${id}?hydrate=awards`, { ttl: 86400000, pick: (x) => x?.people?.[0]?.awards || [] });
  const rows = useMemo(() => {
    const by = new Map();
    for (const a of data || []) { const k = a.name || a.id; const g = by.get(k) || { name: k, seasons: [] }; if (a.season && !g.seasons.includes(a.season)) g.seasons.push(a.season); by.set(k, g); }
    return [...by.values()].sort((a, b) => Math.max(...b.seasons.map(Number), 0) - Math.max(...a.seasons.map(Number), 0));
  }, [data]);
  return (
    <section className="panel card">
      <h3>Awards</h3>
      {error && !data && <ApiError inline what="awards" error={error} retry={retry} />}
      {!data && !error && <div className="muted">Loading…</div>}
      {data && (rows.length ? <table className="t sm kv"><tbody>{rows.map((r) => <tr key={r.name}><td className="l">{r.name}{r.seasons.length > 1 && <b> ×{r.seasons.length}</b>}</td><td className="l muted">{r.seasons.sort().join(', ')}</td></tr>)}</tbody></table> : <div className="muted">No awards on record.</div>)}
    </section>
  );
}

function Similar({ id, role, season, seasonFile }) {
  const list = useMemo(() => similarPlayers(seasonFile, role, id, 8), [seasonFile, role, id]);
  return (
    <section className="panel card">
      <h3>Similar players · {season}</h3>
      <div className="muted small">Closest profiles among regulars by Statcast quality of contact, discipline and {role === 'bat' ? 'speed' : 'velocity and ground balls'}.</div>
      {!seasonFile ? <div className="muted">Loading…</div> : list.length ? (
        <table className="t sm"><tbody>{list.map((p) => <tr key={p.id}><td className="l"><Link className="row" to={`/player/${role}/${p.id}?season=${season}`}><Headshot id={p.id} size={24} /> {p.name}</Link></td><td className="muted">{p.team}</td><td className="mono">{p.sim}</td></tr>)}</tbody></table>
      ) : <div className="muted">Not enough playing time this season to compare.</div>}
    </section>
  );
}

const MILB_COLS = {
  hitting: [['gamesPlayed', 'G'], ['plateAppearances', 'PA'], ['homeRuns', 'HR'], ['stolenBases', 'SB'], ['avg', 'AVG'], ['obp', 'OBP'], ['slg', 'SLG'], ['ops', 'OPS']],
  pitching: [['gamesPlayed', 'G'], ['gamesStarted', 'GS'], ['inningsPitched', 'IP'], ['era', 'ERA'], ['whip', 'WHIP'], ['strikeoutsPer9Inn', 'K/9'], ['walksPer9Inn', 'BB/9']],
};
function MinorLeagues({ id, role }) {
  const group = role === 'bat' ? 'hitting' : 'pitching';
  const { data, error, retry } = useApi(`/people/${id}/stats?stats=yearByYear&group=${group}&leagueListId=milb_all&hydrate=team`, { ttl: 86400000, pick: (x) => x?.stats?.[0]?.splits || [] });
  const cols = MILB_COLS[group];
  return (
    <section className="panel card">
      <h3>Minor league stats</h3>
      {error && !data && <ApiError inline what="minor league stats" error={error} retry={retry} />}
      {!data && !error && <div className="muted">Loading…</div>}
      {data && (data.length ? (
        <div className="scroll"><table className="t sm sticky-first"><thead><tr><th className="l">Year</th><th className="l">Team</th><th>Lvl</th>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{data.map((r, i) => <tr key={i}><td className="l">{r.season}</td><td className="l">{r.team?.name || '—'}</td><td>{r.sport?.abbreviation || r.league?.abbreviation || ''}</td>{cols.map(([k, h]) => <td key={h} className="mono">{r.stat?.[k] ?? '—'}</td>)}</tr>)}</tbody></table></div>
      ) : <div className="muted">No minor league stats on record.</div>)}
    </section>
  );
}

function Transactions({ id }) {
  const [all, setAll] = useState(false);
  const { data, error, retry } = useApi(`/transactions?playerId=${id}`, { ttl: 3600000, pick: (x) => (x?.transactions || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')) });
  const rows = all ? data : data?.slice(0, 12);
  return (
    <section className="panel card">
      <h3>Transactions</h3>
      {error && !data && <ApiError inline what="transactions" error={error} retry={retry} />}
      {!data && !error && <div className="muted">Loading…</div>}
      {data && (data.length ? <>
        <table className="t sm kv"><tbody>{rows.map((t, i) => <tr key={t.id || i}><td className="l muted">{dt(t.date)}</td><td className="l">{t.description || t.typeDesc}</td></tr>)}</tbody></table>
        {data.length > 12 && <button type="button" className="btn sm" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${data.length}`}</button>}
      </> : <div className="muted">No transactions on record.</div>)}
    </section>
  );
}
