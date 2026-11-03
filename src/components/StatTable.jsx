import { useMemo, useState } from 'react';
import { usePref } from '../lib/data.js';
import { SPLITS, splitLabel, statDef } from '../lib/catalog.js';
import { SECTIONS, sectionKeys, sectionLabel } from '../lib/sections.js';
import { favFirst } from '../lib/favs.js';
import { pctFromRef, vsOwn } from '../lib/stats.js';
import { tint } from '../lib/themes.js';
import { Seg, StatPicker } from './ui.jsx';

// Order of the selections in the picker. "custom" holds the person's own saved layouts.
const ORDER = {
  bat: ['custom', 'playerValue', 'realAbility', 'standard', 'advanced', 'statcast', 'battedBall', 'discipline', 'batTracking', 'value', 'rraa', 'fielding', 'plus', 'winProb', 'pitchType', 'velocity', 'movement', 'pitchValues', 'dashboard', 'all'],
  pit: ['custom', 'playerValue', 'realAbility', 'standard', 'advanced', 'statcast', 'battedBall', 'discipline', 'stuff', 'pitchType', 'velocity', 'movement', 'pitchValues', 'value', 'rraa', 'plus', 'winProb', 'dashboard', 'all'],
};
export const COLOR_MODES = [['league', 'vs league avg'], ['own', 'vs his career'], ['off', 'Off']];

/** Shared color-mode preference ("league" | "own" | "off"). */
export const useColorMode = () => usePref('p3:color', 'league');

/** Score (0-100) used to color one cell. */
export function cellScore(mode, { ref, v, dir, own }) {
  if (mode === 'league') return pctFromRef(ref, v, dir);
  if (mode === 'own') return vsOwn(own, v, dir);
  return null;
}

/** One season-by-season table whose columns come from a selection (Custom layouts, Player value, Standard, ...). */
export default function StatTable({ role, file, seasons, season, split, keySet, allKeys, favs, league, setSeason }) {
  const [sel, setSel] = usePref(`p3:sel:${role}`, 'playerValue');
  const [edits, setEdits] = usePref(`p3:edits:${role}`, {});
  const [layouts, setLayouts] = usePref(`p3:layouts:${role}`, [{ name: 'My stats', keys: null }]);
  const [li, setLi] = usePref(`p3:layout:${role}`, 0);
  const [mode, setMode] = useColorMode();
  const [withSplits, setWithSplits] = usePref('tools:splits', false);
  const [rev, setRev] = usePref('table:rev', false);
  const [edit, setEdit] = useState(false);
  const [naming, setNaming] = useState(null);

  const ids = ORDER[role].filter((s) => s === 'custom' || SECTIONS[role][s]);
  const active = ids.includes(sel) ? sel : 'playerValue';
  const lay = layouts[Math.min(li, layouts.length - 1)] || layouts[0];
  const keys = useMemo(() => {
    if (active === 'custom') return (lay?.keys || favs).filter((k) => keySet.has(k));
    if (edits[active]) return edits[active].filter((k) => keySet.has(k));
    const base = sectionKeys(role, active, keySet);
    return SECTIONS[role][active]?.editable ? base : favFirst(base, favs);
  }, [active, lay, favs, keySet, edits, role]);
  const setKeys = (v) => {
    if (active === 'custom') setLayouts(layouts.map((l, i) => (l === lay ? { ...l, keys: v } : l)));
    else setEdits({ ...edits, [active]: v });
  };
  const resetKeys = () => { const e = { ...edits }; delete e[active]; setEdits(e); };
  const addLayout = () => { const n = [...layouts, { name: `Layout ${layouts.length + 1}`, keys: keys.slice() }]; setLayouts(n); setLi(n.length - 1); setSel('custom'); setEdit(true); };
  const delLayout = () => { if (layouts.length < 2) return; const n = layouts.filter((l) => l !== lay); setLayouts(n); setLi(0); };
  const rename = (name) => { setLayouts(layouts.map((l) => (l === lay ? { ...l, name: name || l.name } : l))); setNaming(null); };

  const ys = rev ? seasons : [...seasons].reverse();
  const rowSplits = [split, ...(withSplits ? SPLITS.map(([x]) => x).filter((x) => x !== split) : [])];
  const own = (sx, k) => seasons.map((y) => file.seasons[y].splits[sx]?.[k]);
  const refOf = (y, sx, k) => league?.[y]?.[sx]?.[k];
  const lgRow = league?.[season]?.[split];

  return (
    <section className="panel card stat-table">
      <div className="selbar" role="tablist" aria-label="Stat selections">
        {ids.map((s) => <button type="button" role="tab" key={s} aria-selected={active === s} className={active === s ? 'on' : ''} onClick={() => { setSel(s); setEdit(false); }}>{s === 'custom' ? '★ Custom' : sectionLabel(role, s)}</button>)}
      </div>
      {active === 'custom' && (
        <div className="row layouts">
          {layouts.map((l, i) => (naming === i
            ? <input key={i} autoFocus defaultValue={l.name} onBlur={(e) => rename(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') rename(e.target.value.trim()); if (e.key === 'Escape') setNaming(null); }} />
            : <button type="button" key={i} className={'chip' + (l === lay ? ' on' : '')} onClick={() => setLi(i)} onDoubleClick={() => setNaming(i)} title="Double-click to rename">{l.name}</button>))}
          <button type="button" className="btn sm" onClick={addLayout}>+ New layout</button>
          <button type="button" className="btn sm" onClick={() => setNaming(layouts.indexOf(lay))}>Rename</button>
          {layouts.length > 1 && <button type="button" className="btn sm" onClick={delLayout}>Delete</button>}
        </div>)}
      <div className="row ctrls">
        <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `✎ Choose stats (${keys.length})`}</button>
        {active !== 'custom' && edits[active] && <button type="button" className="btn sm" onClick={resetKeys}>Default stats</button>}
        <label className="small row">Color <Seg small value={mode} onChange={setMode} options={COLOR_MODES} /></label>
        <label className="small row"><input type="checkbox" checked={!!withSplits} onChange={(e) => setWithSplits(e.target.checked)} /> L/R rows</label>
        <button type="button" className="btn sm" onClick={() => setRev(!rev)}>{rev ? 'Oldest first' : 'Newest first'}</button>
      </div>
      {edit && <StatPicker keys={allKeys} role={role} value={keys} onChange={setKeys} />}
      {!keys.length ? <div className="muted pad">No {active === 'custom' ? 'stats in this layout yet' : `${sectionLabel(role, active)} stats in this player’s data`}. Use “Choose stats”.</div> : (
        <div className="scroll tall"><table className="t sticky-first"><thead><tr><th className="l">Season</th><th className="l">Team</th>{withSplits && <th className="l">Split</th>}
          {keys.map((k) => <th key={k} className={favs.includes(k) ? 'favcol' : ''} title={statDef(k, role).desc || k}>{statDef(k, role).label}</th>)}</tr></thead>
          <tbody>
            {ys.map((y) => { const e = file.seasons[y]; return rowSplits.map((sx, ri) => (
              <tr key={`${y}${sx}`} className={(y === season ? 'sel' : '') + (ri ? ' subrow' : ' toprow')} onClick={() => setSeason(y)}>
                <td className="l">{ri === 0 && <b>{y}</b>}</td><td className="l">{ri === 0 && e.team}</td>
                {withSplits && <td className="l"><span className={`splitpill ${sx}`}>{splitLabel(sx, role)}</span></td>}
                {keys.map((k) => {
                  const d = statDef(k, role); const v = e.splits[sx]?.[k]; const ref = refOf(y, sx, k);
                  const sc = cellScore(mode, { ref, v, dir: d.dir, own: own(sx, k) });
                  return <td key={k} className="mono" style={tint(sc)} title={ref ? `${y} league avg ${d.f(ref[0])}${mode === 'league' && sc != null ? ` · ${sc}th percentile` : ''}` : undefined}>{d.f(v)}</td>;
                })}</tr>)); })}
            {mode === 'league' && lgRow && <tr className="lgrow"><td className="l"><b>Lg avg</b></td><td className="l muted">{season}</td>{withSplits && <td className="l" />}
              {keys.map((k) => <td key={k} className="mono">{lgRow[k] ? statDef(k, role).f(lgRow[k][0]) : ''}</td>)}</tr>}
          </tbody></table></div>)}
      <div className="muted small">{mode === 'league' ? 'Red = better than the league average that season, blue = worse (regulars only). ' : mode === 'own' ? 'Red = better than his own average across these seasons, blue = worse. ' : ''}Tap a row to select that season.</div>
    </section>
  );
}
