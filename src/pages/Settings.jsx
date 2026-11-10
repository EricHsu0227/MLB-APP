import { useMemo, useState } from 'react';
import { useSeason, usePref } from '../lib/data.js';
import { statDef, statKeys } from '../lib/catalog.js';
import { DEFAULT_FAVS, MY_GROUPS, useFavs, useGroup } from '../lib/favs.js';
import { sectionLabel } from '../lib/sections.js';
import { StatPicker } from '../components/ui.jsx';
import AppearanceSettings from '../components/Appearance.jsx';

function ListEditor({ role, title, note, keys, value, onChange, reset, startOpen, bare }) {
  const [open, setOpen] = useState(!!startOpen);
  const move = (i, d) => { const a = [...value]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <div className="list-editor">
      {title && <h4>{title}</h4>}
      {note && <div className="muted small" style={{ marginBottom: 6 }}>{note}</div>}
      <div className="fav-list">
        {value.map((k, i) => (
          <span className="fav" key={k} title={statDef(k, role).desc}><b>{i + 1}</b> {statDef(k, role).label}
            <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)}>‹</button><button type="button" aria-label="Move later" onClick={() => move(i, 1)}>›</button><button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== k))}>✕</button></span>))}
        {!value.length && <span className="muted">Nothing picked yet.</span>}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {!bare && <button type="button" className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Done' : '+ Add or remove stats'}</button>}
        <button type="button" className="btn sm" onClick={reset}>Reset to default</button>
      </div>
      {(open || bare) && <StatPicker keys={keys} role={role} value={value} onChange={onChange} max={60} />}
    </div>
  );
}

/** One "My stats" list: 'favs' (the main list) or a group id (playerValue / realAbility). */
export function MyStatsEditor({ role, season, group = 'favs', bare }) {
  const { data } = useSeason(season, role);
  const keys = useMemo(() => (data ? statKeys(data.players.slice(0, 3000)) : []), [data]);
  const [favs, setFavs] = useFavs(role);
  const [gk, setG, resetG] = useGroup(role, group === 'favs' ? MY_GROUPS[0] : group);
  const isFav = group === 'favs';
  const note = bare ? (isFav ? 'Your main stats. Reorder with ‹ ›, remove with ✕, or add more. They are also the defaults on player pages and Compare.' : `Stats in ${sectionLabel(role, group)}. The player page uses the same list.`) : null;
  return <ListEditor role={role} keys={keys} note={note} bare={bare} value={isFav ? favs : gk} onChange={isFav ? setFavs : setG} reset={isFav ? () => setFavs(DEFAULT_FAVS[role]) : resetG} />;
}

function MyStats({ role, season }) {
  return (
    <section className="panel card">
      <h3>My stats: {role === 'bat' ? 'hitters' : 'pitchers'}</h3>
      <h4>Main list</h4>
      <MyStatsEditor role={role} season={season} />
      {MY_GROUPS.map((g) => <div key={g} style={{ marginTop: 14 }}><h4>{sectionLabel(role, g)}</h4><MyStatsEditor role={role} season={season} group={g} /></div>)}
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
        <p className="muted" style={{ margin: '4px 0 0' }}>My stats are the default columns on the leaderboard, a player’s Overview and Compare. Player value and Real ability are two more lists you can edit; they show up as their own tabs.</p>
      </section>
      <div className="grid" style={{ '--cols': 2 }}>
        <MyStats role="bat" season={season} />
        <MyStats role="pit" season={season} />
        <section className="panel card">
          <h3>Appearance</h3>
          <AppearanceSettings />
        </section>
        <section className="panel card">
          <h3>Tables</h3>
          <Toggle k="lb:shade" init label="Percentile shading" hint="leaderboard" />
          <Toggle k="lb:lr" init={false} label="L/R splits under each number" hint="leaderboard" />
          <Toggle k="tools:heat" init label="Color coding" hint="player and compare tables" />
          <Toggle k="table:rev" init={false} label="Oldest season first" hint="player tables" />
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
