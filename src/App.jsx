import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useData } from './lib/data.js';
import Leaderboard from './pages/Leaderboard.jsx';
import Player from './pages/Player.jsx';
import Compare from './pages/Compare.jsx';

export default function App() {
  const { data: index, error } = useData('index.json');
  return (
    <>
      {index?.synthetic && <div className="banner">Showing synthetic sample data (not real players). Run the data pipeline to load real stats.</div>}
      <nav><b>MLB Stats</b><NavLink to="/leaderboard">Leaderboard</NavLink><NavLink to="/compare">Compare</NavLink></nav>
      <main>
        {error && <div className="panel">Couldn’t load data/index.json. Run <code>npm run sample</code> or the pipeline.</div>}
        {index && (
          <Routes>
            <Route path="/leaderboard" element={<Leaderboard index={index} />} />
            <Route path="/compare" element={<Compare index={index} />} />
            <Route path="/player/:season/:role/:id" element={<Player index={index} />} />
            <Route path="*" element={<Navigate to="/leaderboard" replace />} />
          </Routes>
        )}
      </main>
    </>
  );
}
