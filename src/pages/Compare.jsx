import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { load, usePref } from '../lib/data.js';
import { statDef, splitLabel, keysOfSeasons } from '../lib/catalog.js';
import { sectionIds, sectionKeys, sectionLabel } from '../lib/sections.js';
import { heat, peerPool, percentile } from '../lib/stats.js';
import { Bubble, Headshot, PlayerSearch, Seg, SplitSeg, StatPicker, SubSplits } from '../components/ui.jsx';
import { tint } from '../lib/themes.js';
import { LineChart, Radar, seriesColor } from '../components/charts.jsx';

const DEFAULT_STATS = { bat: ['PA', 'AVG', 'OBP', 'SLG', 'wOBA', 'xwOBA', 'wRC+', 'K%', 'BB%', 'EV', 'Barrel%', 'HardHit%', 'HR', 'SB', 'WAR'], pit: ['IP', 'ERA', 'FIP', 'xFIP', 'K%', 'BB%', 'K-BB%', 'WHIP', 'GB%', 'SwStr%', 'FBv', 'WAR'] };
const parse = (s) => (s || '').split(',').filter(Boolean).map((t) => { const [role, id, season] = t.split(':'); return { role, id: +id, season: +season }; }).filter((e) => (e.role === 'bat' || e.role === 'pit') && e.id);
const enc = (es) => es.map((e) => `${e.role}:${e.id}:${e.season}`).join(',');

function useFiles(entries) {
  const [files, setFiles] = useState({});
  const key = [...new Set(entries.map((e) => `${e.role}/${e.id}`))].join('|');
  useEffect(() => {
    let on = true;
    key.split('|').filter(Boolean).forEach((k) => load(`players/${k}.json`).then((d) => on && setFiles((f) => (f[k] ? f : { ...f, [k]: d })), () => {}));
    return () => { on = false; };
  }, [key]);
  return files;
}
function useSeasonPools(entries) {
  const [pools, setPools] = useState({});
  const key = [...new Set(entries.map((e) => `${e.season}/${e.role}`))].join('|');
  useEffect(() => {
    let on = true;
    key.split('|').filter(Boolean).forEach((k) => load(`${k}.json`).then((d) => on && setPools((p) => (p[k] ? p : { ...p, [k]: d.players })), () => {}));
    return () => { on = false; };
  }, [key]);
  return pools;
}

export default function Compare({ index }) {
  const [qs, setQs] = useSearchParams();
  const entries = useMemo(() => parse(qs.get('p')), [qs]);
  const [split, setSplit] = usePref('cmp:split', 'all');
  const [view, setView] = usePref('cmp:view', 'table');
  const [withPct, setWithPct] = usePref('cmp:pct', true);
  const [inline, setInline] = usePref('cmp:inline', true);
  const [heatOn, setHeatOn] = usePref('cmp:heat', true);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [edit, setEdit] = useState(false);
  const [trendKey, setTrendKey] = useState('WAR');
  const files = useFiles(entries);
  const pools = useSeasonPools(withPct || view === 'radar' ? entries : []);
  const roles = [...new Set(entries.map((e) => e.role))];
  const role = roles.length === 1 ? roles[0] : 'bat';
  const [statsBat, setStatsBat] = usePref('cmp:stats:bat', DEFAULT_STATS.bat);
  const [statsPit, setStatsPit] = usePref('cmp:stats:pit', DEFAULT_STATS.pit);
  const stats = role === 'bat' ? statsBat : statsPit, setStats = role === 'bat' ? setStatsBat : setStatsPit;
  const setEntries = (es) => setQs((q) => { const n = new URLSearchParams(q); if (es.length) n.set('p', enc(es)); else n.delete('p'); return n; }, { replace: true });
  const fileOf = (e) => files[`${e.role}/${e.id}`];
  const lineOf = (e) => fileOf(e)?.seasons?.[e.season]?.splits?.[split];
  const allKeys = useMemo(() => { const s = new Set(); for (const e of entries) { const f = fileOf(e); if (f) for (const k of keysOfSeasons(f.seasons)) s.add(k); } return [...s].sort((a, b) => a.localeCompare(b)); }, [entries, files]); // eslint-disable-line
  const keySet = useMemo(() => new Set(allKeys), [allKeys]);
  const pctOf = (e, k) => {
    const d = statDef(k, e.role); const pool = pools[`${e.season}/${e.role}`];
    if (!pool || !d.dir) return null;
    const peers = peerPool(pool, split, e.role === 'bat' ? { minPA: split === 'all' ? 100 : 40 } : { minIP: split === 'all' ? 30 : 12 });
    return percentile(peers.map((r) => r.splits[split]?.[k]), lineOf(e)?.[k], d.dir < 0);
  };
  const add = (p) => { const role = p.roles[0]; if (entries.length >= 8) return; setEntries([...entries, { role, id: p.id, season: p.last }]); };
  const colorOf = (i) => seriesColor(i);
  const shownStats = stats.filter((k) => {
    if (!onlyDiff || entries.length < 2) return true;
    const vs = entries.map((e) => lineOf(e)?.[k]).filter((v) => v != null);
    return new Set(vs).size > 1;
  });
  const best = (k) => {
    const d = statDef(k, role); if (roles.length !== 1 || !d.dir) return null;
    const vs = entries.map((e) => lineOf(e)?.[k]).filter((v) => typeof v === 'number');
    return vs.length < 2 ? null : d.dir < 0 ? Math.min(...vs) : Math.max(...vs);
  };

  // trend overlay: one line per distinct player
  const players = [...new Map(entries.map((e) => [`${e.role}:${e.id}`, e])).values()];
  const trendSeries = players.map((e) => { const f = fileOf(e); return { label: f?.name || '…', points: f ? Object.keys(f.seasons).map(Number).sort().map((y) => ({ x: y, y: f.seasons[y]?.splits[split]?.[trendKey] ?? null })) : [] }; });
  const radarKeys = shownStats.filter((k) => statDef(k, role).dir).slice(0, 10);

  return (
    <>
      <section className="panel">
        <div className="row between"><h2 style={{ margin: 0 }}>Compare players</h2>
          <div className="row"><SplitSeg role={role} value={split} onChange={setSplit} /><Seg value={view} onChange={setView} options={[['table', 'Table'], ['radar', 'Radar'], ['trend', 'Trend']]} /></div></div>
        <div className="row" style={{ marginTop: 10 }}>
          <PlayerSearch placeholder={entries.length >= 8 ? 'Max 8 player-seasons' : 'Add a player…'} onPick={add} />
          {entries.length > 0 && <button type="button" className="btn sm" onClick={() => setEntries([])}>Clear all</button>}
        </div>
        <div className="chips-row">
          {entries.map((e, i) => { const f = fileOf(e); const ys = f ? Object.keys(f.seasons).map(Number).sort() : [e.season]; return (
            <div className="cmp-chip" key={`${e.role}${e.id}${i}`} style={{ borderColor: colorOf(i) }}>
              <Headshot id={e.id} size={34} />
              <div><Link to={`/player/${e.role}/${e.id}?season=${e.season}`}><b>{f?.name || '…'}</b></Link><div>
                <select value={e.season} onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, season: +ev.target.value } : x)))}>{ys.reverse().map((y) => <option key={y}>{y}</option>)}</select>
                <span className="muted small"> {e.role === 'bat' ? 'hitting' : 'pitching'}</span></div></div>
              <button type="button" className="btn sm" title="Same player, another season" onClick={() => setEntries([...entries.slice(0, i + 1), { ...e, season: (ys.find((y) => y < e.season) || ys[0]) }, ...entries.slice(i + 1)].slice(0, 8))}>＋season</button>
              <button type="button" className="btn sm" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>✕</button>
            </div>); })}
        </div>
        {entries.length === 0 && <p className="muted">Search for players above. You can add the same player in several seasons to see how they changed, or mix players from different years.</p>}
        {roles.length > 1 && <p className="muted small">Hitters and pitchers are mixed, so “best value” highlighting is off.</p>}
      </section>

      {entries.length > 0 && view !== 'trend' && (
        <section className="panel">
          <div className="row">
            <span className="muted small">Quick sets:</span>
            {sectionIds(role).filter((s) => s !== 'all').map((s) => <button type="button" key={s} className="btn sm" onClick={() => setStats(sectionKeys(role, s, keySet).slice(0, 40))}>{sectionLabel(role, s)}</button>)}
            <button type="button" className="btn sm" onClick={() => setStats(DEFAULT_STATS[role])}>Default</button>
            <button type="button" className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : `Choose stats (${stats.length})`}</button>
            <label className="small row"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences</label>
            <label className="small row"><input type="checkbox" checked={withPct} onChange={(e) => setWithPct(e.target.checked)} /> Percentiles</label>
            <label className="small row"><input type="checkbox" checked={inline} onChange={(e) => setInline(e.target.checked)} /> Show L/R splits</label>
            <label className="small row"><input type="checkbox" checked={heatOn} onChange={(e) => setHeatOn(e.target.checked)} /> Color coding</label>
          </div>
          {edit && <StatPicker keys={allKeys} role={role} value={stats} onChange={setStats} />}
        </section>)}

      {entries.length > 0 && view === 'table' && (
        <section className="panel nopad"><div className="scroll"><table className="t sticky-first cmp">
          <thead><tr><th className="l">Stat</th>{entries.map((e, i) => <th key={i} style={{ borderBottom: `3px solid ${colorOf(i)}` }}>{fileOf(e)?.name || '…'}<div className="muted small">{e.season} · {fileOf(e)?.seasons?.[e.season]?.team}</div></th>)}</tr></thead>
          <tbody>{shownStats.map((k) => { const d = statDef(k, role); const b = best(k); return (
            <tr key={k}><td className="l" title={d.desc}>{d.label}</td>
              {entries.map((e, i) => { const v = lineOf(e)?.[k]; const p = withPct ? pctOf(e, k) : null; const vals = entries.map((x) => lineOf(x)?.[k]); const sd = statDef(k, e.role);
                return <td key={i} className={'mono' + (b != null && v === b ? ' best' : '')} style={heatOn && roles.length === 1 ? tint(heat(vals, v, sd.dir), 20) : undefined}>{sd.f(v)}{p != null && <> <Bubble p={p} size={22} /></>}{inline && split === 'all' && <SubSplits line={fileOf(e)?.seasons?.[e.season]?.splits} k={k} d={sd} main={v} role={e.role} />}</td>; })}</tr>); })}</tbody></table></div></section>)}

      {entries.length > 0 && view === 'radar' && (
        <section className="panel"><div className="radar-wrap">
          <Radar axes={radarKeys.map((k) => statDef(k, role).label)} series={entries.map((e) => ({ values: radarKeys.map((k) => pctOf(e, k)) }))} />
          <div><div className="muted small" style={{ marginBottom: 8 }}>Percentile rank among qualified players of that season ({splitLabel(split, role)}). Uses the first 10 rankable stats in your list.</div>
            {entries.map((e, i) => <div key={i} className="legend-row"><i style={{ background: colorOf(i) }} />{fileOf(e)?.name || '…'} · {e.season}</div>)}</div></div></section>)}

      {entries.length > 0 && view === 'trend' && (
        <section className="panel">
          <div className="row"><label>Stat <select value={trendKey} onChange={(e) => setTrendKey(e.target.value)}>{allKeys.map((k) => <option key={k} value={k}>{statDef(k, role).label}</option>)}</select></label>
            <span className="muted small">Every season of each player, {splitLabel(split, role)}.</span></div>
          <LineChart series={trendSeries} fmt={statDef(trendKey, role).f} />
          <div className="legend">{trendSeries.map((s, i) => <span key={i}><i style={{ background: colorOf(i) }} />{s.label}</span>)}</div>
        </section>)}
    </>
  );
}
