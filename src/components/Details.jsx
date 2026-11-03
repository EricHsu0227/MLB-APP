import ApiError from './ApiError.jsx';
import { useApi } from '../lib/mlbapi.js';
import { statDef } from '../lib/catalog.js';
import { useFavs } from '../lib/favs.js';

const dt = (s) => (s ? new Date(s + 'T12:00:00').toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/** Player details: live bio (MLB Stats API), outside links, and a season-by-season career table. */
export default function Details({ id, role, file, seasons, season }) {
  const { data, error, retry } = useApi(`/people/${id}?hydrate=currentTeam,draft`, { ttl: 3600000, pick: (x) => x?.people?.[0] });
  const [favs] = useFavs(role);
  const keys = ['G', role === 'bat' ? 'PA' : 'IP', ...favs.filter((k) => !['G', 'PA', 'IP'].includes(k))].filter((k) => seasons.some((y) => file.seasons[y].splits.all?.[k] != null)).slice(0, 9);
  const bio = data ? [
    ['Full name', data.fullName], ['Born', `${dt(data.birthDate)}${data.birthCity ? ` · ${[data.birthCity, data.birthStateProvince, data.birthCountry].filter(Boolean).join(', ')}` : ''}`],
    ['Age', data.currentAge], ['Height / weight', data.height ? `${data.height} · ${data.weight || '—'} lb` : '—'], ['Bats / throws', `${data.batSide?.code || '—'} / ${data.pitchHand?.code || '—'}`],
    ['Position', data.primaryPosition?.name], ['MLB debut', dt(data.mlbDebutDate)], ['Team', data.currentTeam?.name], ['Jersey', data.primaryNumber ? `#${data.primaryNumber}` : '—'], ['Draft', data.draftYear || '—'],
  ] : [];
  return (
    <div className="grid" style={{ '--cols': 2 }}>
      <section className="panel card">
        <h3>Bio</h3>
        {!data && !error && <div className="muted">Loading…</div>}
        {error && !data && <ApiError inline what="the bio" error={error} retry={retry} />}
        {data && <table className="t sm"><tbody>{bio.map(([k, v]) => <tr key={k}><td className="l muted">{k}</td><td className="l">{v ?? '—'}</td></tr>)}</tbody></table>}
        <div className="row" style={{ marginTop: 8 }}>
          <a className="btn sm" href={`https://baseballsavant.mlb.com/savant-player/${id}`} target="_blank" rel="noreferrer">Baseball Savant ↗</a>
          <a className="btn sm" href={`https://www.fangraphs.com/search?q=${encodeURIComponent(file.name)}`} target="_blank" rel="noreferrer">FanGraphs ↗</a>
          <a className="btn sm" href={`https://www.mlb.com/player/${id}`} target="_blank" rel="noreferrer">MLB.com ↗</a>
        </div>
      </section>
      <section className="panel card">
        <h3>Seasons in the data</h3>
        <div className="muted small">{file.name} · MLBAM id {id} · {seasons[0]}–{seasons.at(-1)} ({seasons.length} season{seasons.length === 1 ? '' : 's'}) · {role === 'bat' ? 'hitting' : 'pitching'}</div>
        <div className="scroll"><table className="t sm sticky-first"><thead><tr><th className="l">Season</th><th className="l">Team</th><th>Age</th>{keys.map((k) => <th key={k} title={statDef(k, role).desc}>{statDef(k, role).label}</th>)}</tr></thead>
          <tbody>{[...seasons].reverse().map((y) => { const e = file.seasons[y]; return <tr key={y} className={y === season ? 'sel' : ''}><td className="l"><b>{y}</b></td><td className="l">{e.team}</td><td className="mono">{e.splits.all?.Age ?? '—'}</td>{keys.map((k) => { const dd = statDef(k, role); return <td key={k} className="mono">{dd.f(e.splits.all?.[k])}</td>; })}</tr>; })}</tbody></table></div>
      </section>
    </div>
  );
}
