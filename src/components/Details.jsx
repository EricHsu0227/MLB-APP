import ApiError from './ApiError.jsx';
import { useApi } from '../lib/mlbapi.js';

export const personPath = (id) => `/people/${id}?hydrate=currentTeam,draft`;
const dt = (s) => (s ? new Date(s + 'T12:00:00').toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : null);
const money = (v) => (v ? `$${Number(v).toLocaleString()}` : null);

/** Player details: bio and draft (MLB Stats API) plus outside links. */
export default function Details({ id, file, person }) {
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
    </div>
  );
}
