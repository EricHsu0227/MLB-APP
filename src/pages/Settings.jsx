import { useMemo, useState } from 'react';
import { useSeason, usePref } from '../lib/data.js';
import { statDef, statKeys } from '../lib/catalog.js';
import { DEFAULT_FAVS, useFavs } from '../lib/favs.js';
import { StatPicker } from '../components/ui.jsx';

function Favs({ role, season }) {
  const [favs, setFavs] = useFavs(role);
  const { data } = useSeason(season, role);
  const keys = useMemo(() => (data ? statKeys(data.players.slice(0, 3000)) : []), [data]);
  const [open, setOpen] = useState(false);
  const move = (i, d) => { const a = [...favs]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setFavs(a); };
  return (
    <section className="panel card">
      <h3>{role === 'bat' ? 'Hitter' : 'Pitcher'} stats that matter most</h3>
      <div className="fav-list">
        {favs.map((k, i) => (
          <span className="fav" key={k} title={statDef(k, role).desc}><b>{i + 1}</b> {statDef(k, role).label}
            <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)}>‹</button><button type="button" aria-label="Move later" onClick={() => move(i, 1)}>›</button><button type="button" aria-label="Remove" onClick={() => setFavs(favs.filter((x) => x !== k))}>✕</button></span>))}
        {!favs.length && <span className="muted">No favorites yet. Pick some below.</span>}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Done' : '+ Add or remove stats'}</button>
        <button type="button" className="btn sm" onClick={() => setFavs(DEFAULT_FAVS[role])}>Reset to default</button>
      </div>
      {open && <StatPicker keys={keys} role={role} value={favs} onChange={setFavs} max={40} />}
    </section>
  );
}

const Toggle = ({ k, init, label, hint }) => { const [v, set] = usePref(k, init); return <label className="tool-row"><span><b>{label}</b> <span className="muted small">{hint}</span></span><input type="checkbox" role="switch" checked={!!v} onChange={(e) => set(e.target.checked)} /></label>; };

export default function Settings({ index }) {
  const season = index.seasons.at(-1);
  const [armed, setArmed] = useState(false);
  const reset = () => { try { Object.keys(localStorage).filter((k) => k.startsWith('mlb:')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } window.location.reload(); };
  return (
    <>
      <section className="panel">
        <h2 style={{ margin: 0 }}>Settings</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>Pick the stats you care about most and the app leans toward them: they become the default columns on the leaderboard, the stats on a player’s Overview, Trends and Compare, and they sort first in every stat table, with the sections that contain the most of them listed first.</p>
      </section>
      <div className="grid" style={{ '--cols': 2 }}>
        <Favs role="bat" season={season} />
        <Favs role="pit" season={season} />
        <section className="panel card">
          <h3>Display</h3>
          <Toggle k="tools:splits" init label="L/R splits" hint="inline in tables" />
          <Toggle k="tools:heat" init label="Color coding" hint="player and compare tables" />
          <Toggle k="tools:shade" init label="Percentile shading" hint="leaderboard" />
          <Toggle k="table:rev" init={false} label="Oldest season first" hint="player tables" />
          <div className="muted small" style={{ marginTop: 8 }}>Theme, fonts and card style are under 🎨 Theme in the top bar.</div>
        </section>
        <section className="panel card">
          <h3>Reset</h3>
          <div className="muted small">Clears every saved choice on this device (favorites, layouts, themes) and reloads.</div>
          <div className="row" style={{ marginTop: 8 }}>{!armed ? <button type="button" className="btn sm" onClick={() => setArmed(true)}>Reset everything…</button> : <><button type="button" className="btn sm primary" onClick={reset}>Yes, reset</button><button type="button" className="btn sm" onClick={() => setArmed(false)}>Cancel</button></>}</div>
        </section>
      </div>
    </>
  );
}
