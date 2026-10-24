import { Link } from 'react-router-dom';
import { DIVISIONS, TEAMS, divisionOf } from '../lib/teams.js';
import { TeamLogo } from '../components/team.jsx';

export default function Teams() {
  return (
    <>
      <section className="panel"><h2 style={{ margin: 0 }}>Teams</h2><div className="muted small">Roster, depth chart, platoon lineups and splits for every club.</div></section>
      <div className="grid" style={{ '--cols': 3 }}>
        {DIVISIONS.map((d) => (
          <section className="panel card" key={d}><h3>{d}</h3>
            {TEAMS.filter((t) => divisionOf(t) === d).map((t) => <Link key={t.id} to={`/team/${t.abbr}`} className="team-tile"><TeamLogo id={t.id} size={34} /><b>{t.name}</b></Link>)}
          </section>))}
      </div>
    </>
  );
}
