import { NavLink, Route, Routes, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useData } from './lib/data.js';
import { PlayerSearch } from './components/ui.jsx';
import { useAppearance } from './components/Appearance.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Player from './pages/Player.jsx';
import Compare from './pages/Compare.jsx';
import Settings from './pages/Settings.jsx';

const OldPlayer = () => { const { season, role, id } = useParams(); return <Navigate replace to={`/player/${role}/${id}?season=${season}`} />; };

export default function App() {
  const { data: index, error } = useData('index.json');
  useAppearance();
  const nav = useNavigate();
  return (
    <>
      {index?.synthetic && <div className="banner">Showing synthetic sample data (not real players). Run the data pipeline to load real stats.</div>}
      <header className="nav">
        <div className="nav-in">
          <NavLink to="/" className="brand">MLB Stats</NavLink>
          <nav>
            <NavLink to="/leaderboard">Leaderboards</NavLink>
            <NavLink to="/compare">Compare</NavLink>
            <a href="/team-sheet/">Team sheet</a>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <PlayerSearch className="nav-search" placeholder="Search players" onPick={(p) => nav(`/player/${p.roles[0]}/${p.id}`)} />
        </div>
      </header>
      <main>
        {error && <div className="panel">Couldn’t load data/index.json. Run <code>npm run sample</code> or the pipeline.</div>}
        {index && (
          <Routes>
            <Route path="/" element={<Navigate replace to="/leaderboard" />} />
            <Route path="/leaderboard" element={<Leaderboard index={index} />} />
            <Route path="/compare" element={<Compare index={index} />} />
            <Route path="/settings" element={<Settings index={index} />} />
            <Route path="/player/:role/:id" element={<Player index={index} />} />
            <Route path="/player/:season/:role/:id" element={<OldPlayer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>)}
      </main>
      <footer className="foot muted small">Data from FanGraphs, Baseball Savant and MLB. Stats they don’t publish (such as RRAA and L/R Statcast splits) are calculated from pitch-level data.<div className="build">Version {__BUILD__}</div></footer>
    </>
  );
}
