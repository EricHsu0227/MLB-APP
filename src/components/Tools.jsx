import { useState } from 'react';
import { usePref } from '../lib/data.js';
import { CustomizePanel, useColumnCss } from './Customize.jsx';

/** Floating tools button: global toggles that every page reads through usePref. */
export default function Tools() {
  const [open, setOpen] = useState(false);
  const [cust, setCust] = useState(false);
  useColumnCss();
  const [splits, setSplits] = usePref('tools:splits', true);
  const [heat, setHeat] = usePref('tools:heat', true);
  const [shade, setShade] = usePref('tools:shade', true);
  const [rev, setRev] = usePref('table:rev', false);
  const row = (label, hint, v, set) => (
    <label className="tool-row"><span><b>{label}</b><span className="muted small"> {hint}</span></span>
      <input type="checkbox" role="switch" checked={!!v} onChange={(e) => set(e.target.checked)} /></label>);
  return (
    <div className="tools">
      {open && (
        <div className="panel pop-tools" role="dialog" aria-label="Tools">
          <div className="pop-h"><b>Tools</b><button type="button" className="btn sm" onClick={() => setOpen(false)}>✕</button></div>
          {row('L/R splits', 'in every table', splits, setSplits)}
          {row('Color coding', 'player and compare tables', heat, setHeat)}
          {row('Percentile shading', 'leaderboard', shade, setShade)}
          {row('Oldest season first', 'player tables', rev, setRev)}
          <button type="button" className={'btn sm' + (cust ? ' primary' : '')} style={{ marginTop: 8 }} onClick={() => setCust(!cust)} aria-expanded={cust}>⚙ Customize this page {cust ? '▲' : '▼'}</button>
          {cust && <CustomizePanel />}
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>⬆ Top</button>
            <button type="button" className="btn sm" onClick={() => window.print()}>🖨 Print / PDF</button>
          </div>
        </div>)}
      <button type="button" className="tools-fab" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Tools" title="Tools">{open ? '✕' : '🛠'}</button>
    </div>
  );
}
