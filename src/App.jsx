import { NavLink, Route, Routes, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useData } from './lib/data.js';
import { PlayerSearch } from './components/ui.jsx';
import Games from './pages/Games.jsx';
import Game from './pages/Game.jsx';
import Standings from './pages/Standings.jsx';
import Teams from './pages/Teams.jsx';
import Team from './pages/Team.jsx';
import Tools from './components/Tools.jsx';
import Appearance, { useAppearance } from './components/Appearance.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Player from './pages/Player.jsx';
import Compare from './pages/Compare.jsx';

const OldPlayer = () => { const { season, role, id } = useParams(); return <Navigate replace to={`/player/${role}/${id}?season=${season}`} />; };

export default function App() {
  const { data: index, error } = useData('index.json');
  const [ui, setUi] = useAppearance();
  const nav = useNavigate();
  return (
    <>
      {index?.synthetic && <div className="banner">Showing synthetic sample data (not real players). Run the data pipeline to load real stats.</div>}
      <header className="nav">
        <NavLink to="/" className="brand"><span className="logo">⚾</span> MLB Stats</NavLink>
        <nav>
          <NavLink to="/games">Games</NavLink>
          <NavLink to="/standings">Standings</NavLink>
          <NavLink to="/teams">Teams</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/compare">Compare</NavLink>
        </nav>
        <PlayerSearch className="nav-search" placeholder="Search any player…" onPick={(p) => nav(`/player/${p.roles[0]}/${p.id}`)} />
        <Appearance ui={ui} setUi={setUi} />
      </header>
      <main>
        {error && <div className="panel">Couldn’t load data/index.json. Run <code>npm run sample</code> or the pipeline.</div>}
        {index && (
          <Routes>
            <Route path="/" element={<Home index={index} />} />
            <Route path="/leaderboard" element={<Leaderboard index={index} />} />
            <Route path="/compare" element={<Compare index={index} />} />
            <Route path="/games" element={<Games />} />
            <Route path="/game/:pk" element={<Game />} />
            <Route path="/standings" element={<Standings index={index} />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/team/:abbr" element={<Team index={index} />} />
            <Route path="/player/:role/:id" element={<Player index={index} />} />
            <Route path="/player/:season/:role/:id" element={<OldPlayer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>)}
      </main>
      <Tools />
      <footer className="foot muted small">Data: FanGraphs and Baseball Savant, plus Statcast stats calculated from pitch-level data. For personal use.</footer>
    </>
  );
}
