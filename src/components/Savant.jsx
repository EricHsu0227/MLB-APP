import { useState } from 'react';
import { useData, usePref } from '../lib/data.js';
import { pctColor, tint } from '../lib/themes.js';
import { Seg } from './ui.jsx';

// Savant player-page sections built by the pipeline (pipeline/savant_sections.py), one shard file per 16 players.
const SHARDS = 16;
export function useSavant(role, id, season) {
  const { data, error, loading } = useData(season ? `${season}/savant-${role}-${id % SHARDS}.json` : null);
  return { sec: data?.[String(id)] || null, error, loading };
}

export const PITCH_COLORS = { FF: '#D22D49', FA: '#D22D49', SI: '#FE9D00', FT: '#FE9D00', FC: '#933F2C', SL: '#EEE716', ST: '#DDB33A', SV: '#93AFD4', CU: '#00D1ED', KC: '#6236CD', CS: '#0068FF', CH: '#1DBE3A', FS: '#3BACAC', FO: '#55CCAB', SC: '#60DB33', KN: '#3C44CD', EP: '#888888' };
const pcol = (t) => PITCH_COLORS[t] || '#9ca3af';
const f3 = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '-.'));
const f1 = (v) => (v == null ? '—' : v.toFixed(1));
const f2 = (v) => (v == null ? '—' : v.toFixed(2));
const pc = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const f0 = (v) => (v == null ? '—' : Math.round(v).toLocaleString());
const scale = (vals, v) => { const xs = vals.filter((x) => typeof x === 'number'); if (xs.length < 2 || typeof v !== 'number') return null; const lo = Math.min(...xs), hi = Math.max(...xs); return hi === lo ? 50 : Math.round(((v - lo) / (hi - lo)) * 100); };

function Empty({ loading, what }) {
  return <section className="panel card muted">{loading ? 'Loading Savant data…' : `No Savant ${what} for this season yet. They are built from pitch-level data during the nightly data build.`}</section>;
}
const Card = ({ title, sub, children, className = '' }) => <section className={'panel card ' + className}><h3>{title}</h3>{sub && <div className="muted small">{sub}</div>}{children}</section>;

/* ---------------- pitch arsenal ---------------- */
const ARS_COLS = {
  pit: [['usage', 'Use%', pc], ['n', 'Pitches', f0], ['velo', 'Velo', f1], ['spin', 'Spin', f0], ['hb', 'HB (in)', f1], ['ivb', 'IVB (in)', f1], ['ext', 'Ext (ft)', f1], ['whiff', 'Whiff%', pc], ['putaway', 'PutAway%', pc], ['k', 'K%', pc], ['ba', 'BA', f3], ['slg', 'SLG', f3], ['woba', 'wOBA', f3], ['xwoba', 'xwOBA', f3], ['hh', 'HardHit%', pc], ['rv', 'Run Value', f1], ['rv100', 'RV/100', f2]],
  bat: [['usage', 'Seen%', pc], ['n', 'Pitches', f0], ['velo', 'Velo', f1], ['whiff', 'Whiff%', pc], ['k', 'K%', pc], ['ba', 'BA', f3], ['slg', 'SLG', f3], ['woba', 'wOBA', f3], ['xwoba', 'xwOBA', f3], ['hh', 'HardHit%', pc], ['ev', 'EV', f1], ['la', 'LA', f1], ['rv', 'Run Value', f1], ['rv100', 'RV/100', f2]],
};
export function ArsenalTab({ role, id, season }) {
  const { sec, loading } = useSavant(role, id, season);
  if (!sec?.ars?.length) return <Empty loading={loading} what="pitch arsenal" />;
  const cols = ARS_COLS[role];
  const rv = sec.ars.map((a) => a.rv100);
  return (
    <>
      <Card title={role === 'pit' ? 'Pitch arsenal & run value' : 'Run value by pitch type'} sub={`${season} · ${sec.n.toLocaleString()} pitches · run value is from ${role === 'pit' ? 'the pitcher’s side (positive = runs saved)' : 'the hitter’s side (positive = runs gained)'}`}>
        <div className="scroll"><table className="t sticky-first"><thead><tr><th className="l">Pitch</th>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{sec.ars.map((a) => <tr key={a.type}><td className="l"><span className="pdot-key" style={{ background: pcol(a.type) }} />{a.name} <span className="muted small">{a.type}</span></td>
            {cols.map(([k, , f]) => <td key={k} className="mono" style={k === 'rv100' ? tint(scale(rv, a[k]), 40) : undefined}>{f(a[k])}</td>)}</tr>)}</tbody></table></div>
      </Card>
      <div className="grid" style={{ '--cols': role === 'pit' ? 2 : 1 }}>
        <Card title="Run value per 100 pitches"><RvBars ars={sec.ars} /></Card>
        {role === 'pit' && <Card title="Movement" sub="Induced vertical break vs horizontal break, inches, catcher’s view. Small dots are individual pitches, big dots the averages."><Movement ars={sec.ars} mov={sec.mov || []} /></Card>}
        {role === 'pit' && <Card title="Release point & extension" sub="Average release by pitch type, catcher’s view (feet)."><Release ars={sec.ars} /></Card>}
      </div>
    </>
  );
}
function RvBars({ ars }) {
  const max = Math.max(1, ...ars.map((a) => Math.abs(a.rv100 || 0)));
  return <div className="rvbars">{ars.map((a) => (
    <div key={a.type} className="rvbar"><span>{a.type}</span><div className="track"><i style={{ left: a.rv100 < 0 ? `${50 - (Math.abs(a.rv100) / max) * 50}%` : '50%', width: `${(Math.abs(a.rv100 || 0) / max) * 50}%`, background: pcol(a.type) }} /></div><b className="mono">{f2(a.rv100)}</b></div>))}</div>;
}
function Movement({ ars, mov }) {
  const S = 120, R = 25, X = (v) => S + (v / R) * (S - 12), Y = (v) => S - (v / R) * (S - 12);
  return (
    <svg viewBox={`0 0 ${S * 2} ${S * 2}`} className="chart sq">
      {[-20, -10, 0, 10, 20].map((v) => <g key={v}><line className="gl" x1={X(v)} x2={X(v)} y1={4} y2={S * 2 - 4} /><line className="gl" y1={Y(v)} y2={Y(v)} x1={4} x2={S * 2 - 4} /><text className="axis" x={X(v) + 2} y={S * 2 - 6}>{v}</text><text className="axis" x={4} y={Y(v) - 2}>{v}</text></g>)}
      {mov.map(([t, x, z], i) => <circle key={i} cx={X(x)} cy={Y(z)} r={2.2} fill={pcol(t)} opacity={0.45} />)}
      {ars.filter((a) => a.hb != null).map((a) => <g key={a.type}><circle cx={X(a.hb)} cy={Y(a.ivb)} r={7} fill={pcol(a.type)} stroke="var(--panel)" strokeWidth={1.5} /><text className="tiptext b" x={X(a.hb) + 9} y={Y(a.ivb) + 4}>{a.type}</text></g>)}
    </svg>
  );
}
function Release({ ars }) {
  const pts = ars.filter((a) => a.rx != null && a.rz != null);
  if (!pts.length) return <div className="muted">No release data.</div>;
  const X = (v) => 120 + v * 30, Y = (v) => 210 - v * 28;
  return (
    <>
      <svg viewBox="0 0 240 220" className="chart sq">
        <line className="gl" x1={0} x2={240} y1={Y(0)} y2={Y(0)} /><line className="gl" x1={X(0)} x2={X(0)} y1={0} y2={220} />
        {[2, 4, 6].map((v) => <text key={v} className="axis" x={2} y={Y(v)}>{v} ft</text>)}
        {pts.map((a) => <g key={a.type}><circle cx={X(a.rx)} cy={Y(a.rz)} r={6} fill={pcol(a.type)} stroke="var(--panel)" /><text className="tiptext" x={X(a.rx) + 8} y={Y(a.rz) + 4}>{a.type}</text></g>)}
      </svg>
      <div className="legend">{pts.map((a) => <span key={a.type}><i style={{ background: pcol(a.type) }} />{a.type}: {f1(a.ext)} ft ext</span>)}</div>
    </>
  );
}

/* ---------------- zones & swing/take ---------------- */
const ZMETRICS = [['n', 'Pitches'], ['swing', 'Swing%'], ['whiff', 'Whiff%'], ['xwoba', 'xwOBA']];
export function ZonesTab({ role, id, season }) {
  const { sec, loading } = useSavant(role, id, season);
  const [m, setM] = usePref('sav:zone', 'xwoba');
  if (!sec?.zones) return <Empty loading={loading} what="zone data" />;
  const idx = { n: 0, swing: 1, whiff: 2, xwoba: 3 }[m];
  const z = sec.zones;
  const val = (k) => z[k]?.[idx] ?? null;
  const tot = Object.values(z).reduce((a, r) => a + r[0], 0);
  const shown = (k) => (m === 'n' ? (z[k] ? z[k][0] / tot : null) : val(k));
  const all = Object.keys(z).map(shown);
  const fmt = m === 'xwoba' ? f3 : pc;
  const cell = (k, x, y, w, h) => { const v = shown(k); const s = scale(all, v); return <g key={k}><rect x={x} y={y} width={w} height={h} style={{ fill: s == null ? 'var(--panel2)' : pctColor(s) }} stroke="var(--panel)" strokeWidth={2} /><text className="ztext" x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle">{v == null ? '' : fmt(v)}</text></g>; };
  const st = sec.st || {};
  return (
    <div className="grid" style={{ '--cols': 2 }}>
      <Card title="Zone chart" sub={`${season} · catcher’s view · ${role === 'bat' ? 'pitches he saw' : 'pitches he threw'}`}>
        <Seg small value={m} onChange={setM} options={ZMETRICS} />
        <svg viewBox="0 0 220 220" className="chart sq zone">
          {cell('11', 0, 0, 110, 110)}{cell('12', 110, 0, 110, 110)}{cell('13', 0, 110, 110, 110)}{cell('14', 110, 110, 110, 110)}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => cell(String(k), 40 + ((k - 1) % 3) * 46.7, 40 + Math.floor((k - 1) / 3) * 46.7, 46.7, 46.7))}
          <rect x={40} y={40} width={140} height={140} fill="none" stroke="var(--fg)" strokeWidth={2} />
        </svg>
      </Card>
      <Card title="Swing / take" sub="Savant’s attack regions: heart, shadow (edges), chase and waste. Run values from the hitter’s side for hitters and the pitcher’s side for pitchers.">
        <SwingTakeDiagram st={st} />
        <table className="t sm"><thead><tr><th className="l">Region</th><th>Pitches</th><th>Share</th><th>Swing%</th><th>Swing RV</th><th>Take RV</th><th>Total</th></tr></thead>
          <tbody>{['heart', 'shadow', 'chase', 'waste'].filter((r) => st[r]).map((r) => { const [n, sh, sw, rs, rt] = st[r]; return <tr key={r}><td className="l"><b>{r[0].toUpperCase() + r.slice(1)}</b></td><td className="mono">{f0(n)}</td><td className="mono">{pc(sh)}</td><td className="mono">{pc(sw)}</td><td className="mono">{f1(rs)}</td><td className="mono">{f1(rt)}</td><td className="mono"><b>{rs != null && rt != null ? f1(rs + rt) : '—'}</b></td></tr>; })}
            {Object.keys(st).length > 0 && <tr className="sel"><td className="l"><b>Total</b></td><td /><td /><td /><td className="mono">{f1(Object.values(st).reduce((a, r) => a + (r[3] || 0), 0))}</td><td className="mono">{f1(Object.values(st).reduce((a, r) => a + (r[4] || 0), 0))}</td><td className="mono"><b>{f1(Object.values(st).reduce((a, r) => a + (r[3] || 0) + (r[4] || 0), 0))}</b></td></tr>}</tbody></table>
      </Card>
    </div>
  );
}
function SwingTakeDiagram({ st }) {
  const regs = ['waste', 'chase', 'shadow', 'heart'];
  const tots = regs.map((r) => (st[r] ? (st[r][3] || 0) + (st[r][4] || 0) : null));
  const sizes = [200, 160, 116, 64];
  return (
    <svg viewBox="0 0 220 220" className="chart sq st">
      {regs.map((r, i) => { const s = sizes[i]; const o = (220 - s) / 2; const sc = scale(tots, tots[i]); return <g key={r}><rect x={o} y={o} width={s} height={s} rx={i === 3 ? 4 : 10} style={{ fill: sc == null ? 'var(--panel2)' : pctColor(sc) }} stroke="var(--panel)" strokeWidth={2} />
        <text className="ztext" x={110} y={o + (i === 3 ? s / 2 + 4 : 14)} textAnchor="middle">{r} {tots[i] == null ? '' : f1(tots[i])}</text></g>; })}
    </svg>
  );
}

/* ---------------- batted balls & spray ---------------- */
const HIT_COL = { 0: 'var(--muted)', 1: '#3b82f6', 2: '#22c55e', 3: '#f59e0b', 4: '#ef4444' };
const HIT_NAME = { 0: 'Out', 1: '1B', 2: '2B', 3: '3B', 4: 'HR' };
export function BattedTab({ role, id, season }) {
  const { sec, loading } = useSavant(role, id, season);
  const [show, setShow] = useState({ 0: true, 1: true, 2: true, 3: true, 4: true });
  if (!sec?.bb?.n) return <Empty loading={loading} what="batted-ball data" />;
  const bb = sec.bb;
  const dirs = [['pull', 'Pull'], ['straight', 'Straight'], ['oppo', 'Oppo']];
  const types = [['GB', 'var(--c3)'], ['LD', 'var(--c1)'], ['FB', 'var(--c2)'], ['PU', 'var(--c5)']];
  const qoc = ['Weak', 'Topped', 'Under', 'Flare/Burner', 'Solid', 'Barrel'];
  const qcol = ['#64748b', '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
  return (
    <div className="grid" style={{ '--cols': 2 }}>
      <Card title="Spray chart" sub={`${season} · ${sec.spray.length} batted balls${role === 'pit' ? ' allowed' : ''} (sampled when there are more than 300)`}>
        <div className="legend">{[0, 1, 2, 3, 4].map((c) => <label key={c} className="row small"><input type="checkbox" checked={show[c]} onChange={(e) => setShow({ ...show, [c]: e.target.checked })} /><i style={{ background: HIT_COL[c] }} />{HIT_NAME[c]}</label>)}</div>
        <svg viewBox="0 0 250 210" className="chart sq field">
          <path d="M125.42 198.27 L 0 72.85 M125.42 198.27 L 250.84 72.85" />
          <path d="M 13 86 Q 125.42 -45 237.84 86" />
          <path d="M 98 171 Q 125.42 135 152.84 171" />
          {sec.spray.filter((p) => show[p[3]]).map(([x, y, ev, c], i) => <circle key={i} className="bb-dot" cx={x} cy={y} r={c === 4 ? 3.2 : 2.4} fill={HIT_COL[c]} opacity={c ? 0.95 : 0.55}><title>{`${HIT_NAME[c]} · ${ev} mph`}</title></circle>)}
        </svg>
      </Card>
      <Card title="Batted ball profile" sub={`${bb.n} batted balls · direction by ${role === 'bat' ? 'his' : 'the hitter’s'} side`}>
        {dirs.map(([k, l]) => { const d = bb.dir[k] || []; return (
          <div className="bbrow" key={k}><span><b>{l}</b> {pc(d[0])}</span>
            <div className="stack">{types.map(([t, c], i) => <i key={t} style={{ width: `${(d[i + 1] || 0) * 100}%`, background: c }} title={`${t} ${pc(d[i + 1])}`}>{(d[i + 1] || 0) > 0.12 ? t : ''}</i>)}</div></div>); })}
        <div className="legend">{types.map(([t, c]) => <span key={t}><i style={{ background: c }} />{t}</span>)}</div>
        <h3 style={{ marginTop: 12 }}>Quality of contact</h3>
        <div className="stack big">{qoc.map((q, i) => <i key={q} style={{ width: `${(bb.qoc[i] || 0) * 100}%`, background: qcol[i] }} title={`${q} ${pc(bb.qoc[i])}`}>{(bb.qoc[i] || 0) > 0.08 ? pc(bb.qoc[i]) : ''}</i>)}</div>
        <div className="legend">{qoc.map((q, i) => <span key={q}><i style={{ background: qcol[i] }} />{q} {pc(bb.qoc[i])}</span>)}</div>
        <h3 style={{ marginTop: 12 }}>Launch angle</h3>
        <div className="scroll"><table className="t sm"><thead><tr><th className="l">Ground (&lt;10°)</th><th>Line drive (10–25°)</th><th>Fly (25–50°)</th><th>Pop-up (&gt;50°)</th><th>Sweet spot (8–32°)</th></tr></thead>
          <tbody><tr>{bb.la.map((v, i) => <td key={i} className={'mono' + (i ? '' : ' l')}>{pc(v)}</td>)}<td className="mono">{pc(bb.sweet)}</td></tr></tbody></table></div>
      </Card>
    </div>
  );
}

/* ---------------- splits ---------------- */
const SPLIT_COLS = [['PA', f0], ['AVG', f3], ['OBP', f3], ['SLG', f3], ['wOBA', f3], ['xwOBA', f3], ['K%', pc], ['BB%', pc], ['Whiff%', pc], ['EV', f1], ['HardHit%', pc]];
export function SplitsTab({ role, id, season }) {
  const { sec, loading } = useSavant(role, id, season);
  if (!sec?.splits) return <Empty loading={loading} what="splits" />;
  const groups = Object.entries(sec.splits);
  return (
    <div className="grid" style={{ '--cols': 2 }}>
      {groups.map(([g, rows]) => {
        const woba = rows.map((r) => r[5]);
        return (
          <Card key={g} title={g} sub={g === 'Count' ? 'Count when the plate appearance ended' : null}>
            <div className="scroll"><table className="t sm sticky-first"><thead><tr><th className="l">{g}</th>{SPLIT_COLS.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <tr key={r[0]}><td className="l"><b>{r[0]}</b></td>{SPLIT_COLS.map(([h, f], i) => <td key={h} className="mono" style={h === 'wOBA' ? tint(role === 'pit' ? 100 - scale(woba, r[5]) : scale(woba, r[5]), 35) : undefined}>{f(r[i + 1])}</td>)}</tr>)}</tbody></table></div>
          </Card>);
      })}
    </div>
  );
}

/* ---------------- similar players (client side, from the season file) ---------------- */
const SIM_KEYS = { bat: ['xwOBA', 'EV', 'Barrel%', 'HardHit%', 'K%', 'BB%', 'Whiff%', 'O-Swing%', 'LA', 'Spd'], pit: ['xwOBA', 'K%', 'BB%', 'Whiff%', 'O-Swing%', 'GB%', 'Barrel%', 'FBv', 'HardHit%'] };
export function similarPlayers(seasonFile, role, id, n = 8) {
  if (!seasonFile) return [];
  const keys = SIM_KEYS[role];
  let pool = seasonFile.players.filter((p) => { const s = p.splits.all || {}; return role === 'bat' ? (s.PA ?? s.sc_PA ?? 0) >= 150 : (s.IP ?? 0) >= 30; });
  const me = seasonFile.players.find((p) => p.id === id);
  if (!me) return [];
  const starter = (p) => (p.splits.all?.GS || 0) / (p.splits.all?.G || 1) >= 0.5;
  if (role === 'pit') pool = pool.filter((p) => starter(p) === starter(me));
  const stats = keys.map((k) => { const xs = pool.map((p) => p.splits.all?.[k]).filter((v) => typeof v === 'number'); const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1); const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1)) || 1; return [m, sd]; });
  const vec = (p) => keys.map((k, i) => { const v = p.splits.all?.[k]; return typeof v === 'number' ? (v - stats[i][0]) / stats[i][1] : null; });
  const mv = vec(me);
  return pool.filter((p) => p.id !== id).map((p) => { const v = vec(p); let d = 0, c = 0; v.forEach((x, i) => { if (x != null && mv[i] != null) { d += (x - mv[i]) ** 2; c++; } }); return { p, d: c >= keys.length - 2 ? Math.sqrt(d / c) : Infinity }; })
    .filter((x) => Number.isFinite(x.d)).sort((a, b) => a.d - b.d).slice(0, n).map(({ p, d }) => ({ id: p.id, name: p.name, team: p.team, sim: Math.max(0, Math.round(100 - d * 40)) }));
}
