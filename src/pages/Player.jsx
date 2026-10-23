import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { load, useData, usePref } from '../lib/data.js';
import { statDef, statKeys, SPLITS } from '../lib/catalog.js';
import { SplitSeg, SeasonSelect, StatPicker } from '../components/ui.jsx';
import Percentiles from '../components/Percentiles.jsx';

const SECTIONS = [['summary', 'Key stats'], ['pct', 'Percentile rankings'], ['splits', 'L/R splits'], ['career', 'Season-by-season']];
const DEFAULT_LAYOUT = { order: SECTIONS.map((s) => s[0]), hidden: [], wide: ['career'], cols: 2, density: 12, fontSize: 14, accent: '#1f6feb', theme: 'auto', font: 'system-ui, sans-serif' };
const FONTS = { 'System': 'system-ui, sans-serif', 'Serif': 'Georgia, serif', 'Mono': 'ui-monospace, monospace' };

export default function Player({ index }) {
  const { season: s, role, id } = useParams();
  const season = Number(s);
  const { data } = useData(`${season}/${role}.json`);
  const [layout, setLayout] = usePref('player:layout', DEFAULT_LAYOUT);
  const [split, setSplit] = useState('all');
  const [cfg, setCfg] = useState(false);
  const [career, setCareer] = useState([]);
  const pid = Number(id);
  const L = { ...DEFAULT_LAYOUT, ...layout };

  useEffect(() => { // apply style prefs
    const r = document.documentElement;
    r.style.setProperty('--accent', L.accent); r.style.setProperty('--gap', L.density + 'px'); r.style.setProperty('--fs', L.fontSize + 'px'); r.style.setProperty('--font', L.font);
    if (L.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', L.theme);
    return () => ['--accent', '--gap', '--fs', '--font'].forEach((p) => r.style.removeProperty(p));
  }, [L.accent, L.density, L.fontSize, L.font, L.theme]);

  useEffect(() => {
    let on = true;
    load(`players/${role}/${pid}.json`).then((d) => on && setCareer(Object.entries(d.seasons).sort((a, b) => a[0] - b[0]).map(([y, v]) => [y, v])), () => on && setCareer([]));
    return () => { on = false; };
  }, [role, pid]);

  if (!data) return <div className="muted">Loading…</div>;
  const player = data.players.find((p) => p.id === pid);
  if (!player) return <div className="panel">Player not found in {season}.</div>;
  const keys = statKeys(data.players);
  const set = (patch) => setLayout({ ...L, ...patch });
  const move = (k, d) => { const o = [...L.order]; const i = o.indexOf(k), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; set({ order: o }); };
  const toggle = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  const body = {
    summary: <Summary role={role} keys={keys} player={player} split={split} />,
    pct: <Percentiles rows={data.players} player={player} role={role} keys={keys} />,
    splits: <SplitsTable role={role} keys={keys} player={player} />,
    career: <Career role={role} keys={keys} career={career} split={split} />,
  };
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: '4px 0' }}>{player.name} <span className="muted">{player.team} · {season}</span></h2>
        <div className="row">
          <SeasonSelect seasons={index.seasons} value={season} onChange={(y) => { location.hash = `#/player/${y}/${role}/${id}`; }} />
          <SplitSeg value={split} onChange={setSplit} />
          <button className="btn" onClick={() => setCfg(!cfg)}>{cfg ? 'Close' : 'Customize page'}</button>
        </div>
      </div>
      {cfg && (
        <div className="panel">
          <b>Sections</b>
          {L.order.map((k) => (
            <div className="row" key={k}>
              <label><input type="checkbox" checked={!L.hidden.includes(k)} onChange={() => set({ hidden: toggle(L.hidden, k) })} /> {SECTIONS.find((x) => x[0] === k)[1]}</label>
              <label><input type="checkbox" checked={L.wide.includes(k)} onChange={() => set({ wide: toggle(L.wide, k) })} /> full width</label>
              <button className="btn" onClick={() => move(k, -1)}>↑</button><button className="btn" onClick={() => move(k, 1)}>↓</button>
            </div>))}
          <b>Layout &amp; style</b>
          <div className="row">
            <label>Columns <select value={L.cols} onChange={(e) => set({ cols: +e.target.value })}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label>Spacing <input type="range" min="4" max="28" value={L.density} onChange={(e) => set({ density: +e.target.value })} /></label>
            <label>Text size <input type="range" min="11" max="19" value={L.fontSize} onChange={(e) => set({ fontSize: +e.target.value })} /></label>
            <label>Accent <input type="color" value={L.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
            <label>Theme <select value={L.theme} onChange={(e) => set({ theme: e.target.value })}><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label>Font <select value={L.font} onChange={(e) => set({ font: e.target.value })}>{Object.entries(FONTS).map(([n, v]) => <option key={n} value={v}>{n}</option>)}</select></label>
            <button className="btn" onClick={() => setLayout(DEFAULT_LAYOUT)}>Reset</button>
          </div>
        </div>
      )}
      <div className="grid" style={{ '--cols': L.cols }}>
        {L.order.filter((k) => !L.hidden.includes(k)).map((k) => (
          <section key={k} className={'panel' + (L.wide.includes(k) ? ' span2' : '')}>
            <h3 style={{ margin: '0 0 8px' }}>{SECTIONS.find((x) => x[0] === k)[1]}</h3>{body[k]}
          </section>))}
      </div>
    </>
  );
}

const SUMMARY_DEFAULT = { bat: ['PA', 'AVG', 'OBP', 'SLG', 'wOBA', 'wRC+', 'WAR', 'sc_xwOBA', 'sc_EV'], pit: ['IP', 'ERA', 'FIP', 'K%', 'BB%', 'WAR', 'sc_xwOBA'] };
function Summary({ role, keys, player, split }) {
  const [sel, setSel] = usePref(`summary:${role}`, SUMMARY_DEFAULT[role]);
  const [edit, setEdit] = useState(false);
  const line = player.splits[split] || {};
  return (
    <>
      <div className="stats">{sel.map((k) => { const d = statDef(k, role); return <div className="stat" key={k}><div className="k">{d.label}</div><div className="v mono">{d.f(line[k])}</div></div>; })}</div>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button>
      {edit && <div style={{ marginTop: 8 }}><StatPicker keys={keys} role={role} value={sel} onChange={setSel} /></div>}
    </>
  );
}
function SplitsTable({ role, keys, player }) {
  const [sel, setSel] = usePref(`splitsTbl:${role}`, SUMMARY_DEFAULT[role]);
  const [edit, setEdit] = useState(false);
  return (
    <>
      <table><thead><tr><th>Stat</th>{SPLITS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
        <tbody>{sel.map((k) => { const d = statDef(k, role); return <tr key={k}><td>{d.label}</td>{SPLITS.map(([sp]) => <td key={sp} className="mono">{d.f(player.splits[sp]?.[k])}</td>)}</tr>; })}</tbody></table>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button>
      {edit && <div style={{ marginTop: 8 }}><StatPicker keys={keys} role={role} value={sel} onChange={setSel} /></div>}
    </>
  );
}
function Career({ role, keys, career, split }) {
  const [sel, setSel] = usePref(`career:${role}`, SUMMARY_DEFAULT[role]);
  const [edit, setEdit] = useState(false);
  return (
    <>
      <div className="scroll"><table><thead><tr><th>Season</th>{sel.map((k) => <th key={k}>{statDef(k, role).label}</th>)}</tr></thead>
        <tbody>{career.map(([y, p]) => <tr key={y}><td>{y}</td>{sel.map((k) => <td key={k} className="mono">{statDef(k, role).f(p.splits[split]?.[k])}</td>)}</tr>)}</tbody></table></div>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Choose stats'}</button>
      {edit && <div style={{ marginTop: 8 }}><StatPicker keys={keys} role={role} value={sel} onChange={setSel} /></div>}
    </>
  );
}
