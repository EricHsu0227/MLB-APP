import { useMemo, useState } from 'react';
import ApiError from '../components/ApiError.jsx';
import { standingsMap, standingsPath, useApi } from '../lib/mlbapi.js';
import { DIVISIONS, TEAMS, divisionOf } from '../lib/teams.js';
import { pythag } from '../lib/saber.js';
import { TeamLink } from '../components/team.jsx';
import { Seg, SeasonSelect } from '../components/ui.jsx';
import { usePref } from '../lib/data.js';
import { tint } from '../lib/themes.js';

export default function Standings({ index }) {
  const seasons = index.seasons;
  const [season, setSeason] = usePref('standings:season', seasons.at(-1));
  const [view, setView] = usePref('standings:view', 'division');
  const { data, error, loading, retry } = useApi(standingsPath(season), { ttl: 120000 });
  const map = useMemo(() => standingsMap(data), [data]);
  const rows = useMemo(() => TEAMS.map((t) => {
    const s = map.get(t.id); if (!s) return null;
    const px = pythag(s.rs, s.ra, s.g); const xw = px == null ? null : Math.round(px * s.g);
    return { ...t, ...s, xw, xl: xw == null ? null : s.g - xw, lucky: xw == null ? null : s.w - xw };
  }).filter(Boolean), [map]);
  const maxLuck = Math.max(1, ...rows.map((r) => Math.abs(r.lucky ?? 0)));
  const groups = view === 'division' ? DIVISIONS.map((d) => [d, rows.filter((r) => divisionOf(r) === d)]) : ['AL', 'NL'].map((l) => [l, rows.filter((r) => r.lg === l)]);
  const Table = ({ title, list }) => {
    const sorted = [...list].sort((a, b) => b.pct - a.pct || b.diff - a.diff);
    return (
      <section className="panel nopad"><div className="pad"><h3 style={{ margin: 0 }}>{title}</h3></div>
        <div className="scroll"><table className="t sticky-first" data-cust="standings" data-title="Standings"><thead><tr><th className="l">Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>RS</th><th>RA</th><th>Diff</th><th title="Pythagenpat expected record">xW-xL</th><th title="Wins minus expected wins">Luck</th><th>Home</th><th>Away</th><th>L10</th><th>Strk</th></tr></thead>
          <tbody>{sorted.map((r) => (
            <tr key={r.id}><td className="l"><TeamLink id={r.id} full />{r.clinch ? <span className="muted small"> {r.clinch}</span> : ''}</td><td>{r.w}</td><td>{r.l}</td><td className="mono">{r.pct.toFixed(3).replace(/^0/, '')}</td><td>{r.gb}</td><td>{r.rs}</td><td>{r.ra}</td>
              <td className="mono" style={tint(50 + (r.diff / Math.max(1, ...rows.map((x) => Math.abs(x.diff)))) * 50, 40)}>{r.diff > 0 ? '+' : ''}{r.diff}</td>
              <td className="mono">{r.xw}-{r.xl}</td><td className="mono" style={tint(50 + (r.lucky / maxLuck) * 50, 40)}>{r.lucky > 0 ? '+' : ''}{r.lucky}</td><td>{r.home}</td><td>{r.away}</td><td>{r.l10}</td><td>{r.streak}</td></tr>))}</tbody></table></div></section>
    );
  };
  return (
    <>
      <section className="panel"><div className="row between"><h2 style={{ margin: 0 }}>Standings</h2>
        <div className="row"><SeasonSelect seasons={seasons} value={season} onChange={setSeason} /><Seg value={view} onChange={setView} options={[['division', 'Division'], ['league', 'League']]} /></div></div>
        <div className="muted small" style={{ marginTop: 6 }}>xW-xL is the Pythagenpat expected record from runs scored and allowed. Luck = actual wins minus expected wins (positive = outperforming the run differential). Source: MLB Stats API.</div></section>
      {loading && !data && <div className="muted pad">Loading standings…</div>}
      {error && !data && <ApiError what="standings" error={error} retry={retry} />}
      {groups.map(([t, list]) => list.length > 0 && <Table key={t} title={t} list={list} />)}
    </>
  );
}
