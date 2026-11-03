import { usePref } from '../lib/data.js';
import { DIVISIONS, teamByAbbr } from '../lib/teams.js';
import { Seg } from './ui.jsx';

// Extra leaderboard filters. Position / bats / throws come from the MLB Stats API (player_meta.py); rows without them
// pass through until the data has them.
export const EMPTY = { lg: '', div: '', pos: [], role: '', hand: '', ageMin: '', ageMax: '', qual: false, maxQ: '' };
const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'TWP'];
const GROUPS = { IF: ['1B', '2B', '3B', 'SS'], OF: ['LF', 'CF', 'RF', 'OF'] };

export const useLbFilters = () => usePref('lb:f2', EMPTY);
export const activeCount = (f) => ['lg', 'div', 'role', 'hand', 'ageMin', 'ageMax', 'maxQ'].filter((k) => f[k] !== '' && f[k] != null).length + (f.pos?.length ? 1 : 0) + (f.qual ? 1 : 0);

/** Team games for the qualifying line: 60 in 2020, else the most any hitter (or 5x the most starts) has played so far, at most 162. */
export function teamGames(rows, role) {
  const by = new Map();
  for (const r of rows) {
    const s = r.splits.all || {};
    const g = role === 'pit' ? (s.GS || 0) * 5 : (s.G || 0);
    by.set(r.season, Math.max(by.get(r.season) || 0, g));
  }
  for (const [y, g] of by) by.set(y, y === 2020 ? 60 : Math.min(162, Math.max(g, 1)));
  return by;
}

/** Row predicate for the filters; `games` from teamGames. */
export function makeFilter(f, role, split, games) {
  const posSet = new Set((f.pos || []).flatMap((p) => GROUPS[p] || [p]));
  return (r) => {
    const t = teamByAbbr(r.team);
    if (f.lg && t?.lg !== f.lg) return false;
    if (f.div && (!t || `${t.lg} ${t.div}` !== f.div)) return false;
    const s = r.splits[split] || {};
    const all = r.splits.all || {};
    const age = all.Age ?? s.Age;
    if (f.ageMin !== '' && !(age >= +f.ageMin)) return false;
    if (f.ageMax !== '' && !(age <= +f.ageMax)) return false;
    if (role === 'bat') {
      if (posSet.size && r.pos && !posSet.has(r.pos)) return false;
      if (f.hand && r.bats && r.bats !== f.hand) return false;
      const pa = s.PA ?? s.sc_PA ?? 0;
      if (f.qual && split === 'all' && pa < 3.1 * (games.get(r.season) || 162)) return false;
      if (f.maxQ !== '' && pa > +f.maxQ) return false;
    } else {
      const sp = (all.GS || 0) / (all.G || 1) >= 0.5;
      if (f.role === 'SP' && !sp) return false;
      if (f.role === 'RP' && sp) return false;
      if (f.hand && r.throws && r.throws !== f.hand) return false;
      const ip = s.IP ?? 0;
      if (f.qual && split === 'all' && ip < (games.get(r.season) || 162)) return false;
      if (f.maxQ !== '' && ip > +f.maxQ) return false;
    }
    return true;
  };
}

export default function LbFilters({ role, value: f, onChange, rraa }) {
  const set = (patch) => onChange({ ...f, ...patch });
  const togglePos = (p) => set({ pos: f.pos.includes(p) ? f.pos.filter((x) => x !== p) : [...f.pos, p] });
  const bat = role === 'bat';
  return (
    <div className="lb-filters">
      <div className="row">
        <Seg small value={f.lg} onChange={(v) => set({ lg: v, div: '' })} options={[['', 'MLB'], ['AL', 'AL'], ['NL', 'NL']]} />
        <select value={f.div} onChange={(e) => set({ div: e.target.value })}><option value="">All divisions</option>{DIVISIONS.filter((d) => !f.lg || d.startsWith(f.lg)).map((d) => <option key={d}>{d}</option>)}</select>
        <label className="small row">Age <input type="number" placeholder="min" style={{ width: 58 }} value={f.ageMin} onChange={(e) => set({ ageMin: e.target.value })} />–<input type="number" placeholder="max" style={{ width: 58 }} value={f.ageMax} onChange={(e) => set({ ageMax: e.target.value })} /></label>
        {!rraa && <span className="row small">{bat ? 'Bats' : 'Throws'} <Seg small value={f.hand} onChange={(v) => set({ hand: v })} options={bat ? [['', 'All'], ['L', 'L'], ['R', 'R'], ['S', 'Switch']] : [['', 'All'], ['L', 'LHP'], ['R', 'RHP']]} /></span>}
        {!rraa && !bat && <Seg small value={f.role} onChange={(v) => set({ role: v })} options={[['', 'SP + RP'], ['SP', 'Starters'], ['RP', 'Relievers']]} />}
        {!rraa && <label className="small row"><input type="checkbox" checked={f.qual} onChange={(e) => set({ qual: e.target.checked })} /> Qualified only</label>}
        {!rraa && <label className="small row">Max {bat ? 'PA' : 'IP'} <input type="number" style={{ width: 70 }} value={f.maxQ} onChange={(e) => set({ maxQ: e.target.value })} /></label>}
      </div>
      {!rraa && bat && (
        <div className="row chips">
          <span className="small muted">Position</span>
          {['IF', 'OF', ...POS].map((p) => <button type="button" key={p} className={'chip' + (f.pos.includes(p) ? ' on' : '')} onClick={() => togglePos(p)}>{p}</button>)}
        </div>)}
      {activeCount(f) > 0 && <button type="button" className="btn sm" onClick={() => onChange(EMPTY)}>Clear filters</button>}
    </div>
  );
}
