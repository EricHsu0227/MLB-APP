import { useNavigate, Link } from 'react-router-dom';
import { useData, usePref } from '../lib/data.js';
import { Headshot, PlayerLink, PlayerSearch, RoleSeg, SeasonSelect } from '../components/ui.jsx';
import { statDef } from '../lib/catalog.js';

export default function Home({ index }) {
  const nav = useNavigate();
  const { data: leaders } = useData('leaders.json');
  const [season, setSeason] = usePref('home:season', index.seasons.at(-1));
  const [role, setRole] = usePref('home:role', 'bat');
  const rows = leaders?.[season]?.[role] || [];
  const a = role === 'bat' ? 'wRC+' : 'ERA', b = role === 'bat' ? 'HR' : 'SO';
  return (
    <>
      <section className="hero">
        <h1>Every MLB season, every split, every stat.</h1>
        <p className="muted">FanGraphs and Baseball Savant data for {index.seasons[0]}–{index.seasons.at(-1)}, with lefty/righty splits and self-calculated Statcast numbers.</p>
        <PlayerSearch className="hero-search" autoFocus placeholder="Search a player — try “Judge” or “Skenes”" onPick={(p) => nav(`/player/${p.roles[0]}/${p.id}`)} />
        <div className="row center" style={{ marginTop: 14 }}>
          <Link className="btn primary" to="/leaderboard">Open leaderboard</Link>
          <Link className="btn" to="/compare">Compare players</Link>
        </div>
      </section>
      <section className="panel">
        <div className="row between"><h2 style={{ margin: 0 }}>WAR leaders</h2>
          <div className="row"><RoleSeg value={role} onChange={setRole} /><SeasonSelect seasons={index.seasons} value={season} onChange={setSeason} /></div></div>
        <div className="leader-grid">
          {rows.slice(0, 12).map((p, i) => (
            <PlayerLink key={p.id} role={role} id={p.id} season={season}>
              <div className="leader"><span className="rank">{i + 1}</span><Headshot id={p.id} size={44} />
                <div className="grow"><div className="name">{p.name}</div><div className="muted small">{p.team} · {statDef(a, role).label} {statDef(a, role).f(p.a)} · {statDef(b, role).label} {statDef(b, role).f(p.b)}</div></div>
                <div className="war">{p.WAR.toFixed(1)}<span className="muted small"> WAR</span></div></div>
            </PlayerLink>))}
        </div>
      </section>
    </>
  );
}
