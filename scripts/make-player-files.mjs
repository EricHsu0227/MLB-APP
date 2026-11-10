// Derives small lookup files from the season files (runs before `vite build` / `vite`):
//   public/data/players/<role>/<id>.json  = { id, name, seasons: { "<year>": { team, splits } } }
//   public/data/players-index.json        = [{ id, n: name, r: ["bat","pit"], y: [first,last], t: lastTeam }]
//   public/data/leaders.json              = { "<year>": { bat: [...top WAR], pit: [...top WAR] } }
//   public/data/league-<role>.json        = { "<year>": { "<split>": { stat: [leagueAvg, q0, q10, ..., q100] } } }
//     league quantiles of regulars (hitters 100+ PA, pitchers 20+ IP; splits 40+ PA / 60+ TBF) for color coding and
//     every-season percentiles; leagueAvg is the PA/TBF-weighted mean for rates and the median for counting stats.
import fs from 'node:fs';
import path from 'node:path';
import { direction, isCount } from '../src/lib/catalog.js';
const root = 'public/data';
const seasons = fs.readdirSync(root).filter((n) => /^\d{4}$/.test(n)).sort();
fs.rmSync(path.join(root, 'players'), { recursive: true, force: true });
const byRole = { bat: new Map(), pit: new Map() };
const leaders = {};
const league = { bat: {}, pit: {} };
const sig = (v) => (v === 0 ? 0 : +v.toPrecision(5));
function leagueRef(players, role) {
  const out = {};
  for (const sp of ['all', 'vsL', 'vsR']) {
    const pool = players.map((p) => p.splits[sp]).filter((s) => {
      if (!s) return false;
      if (sp === 'all') return role === 'bat' ? (s.PA ?? s.sc_PA ?? 0) >= 100 : (s.IP ?? 0) >= 20;
      return (s.PA ?? s.TBF ?? s.sc_PA ?? 0) >= (role === 'bat' ? 40 : 60);
    });
    if (pool.length < 10) continue;
    const keys = new Set(); for (const s of pool) for (const k in s) if (typeof s[k] === 'number') keys.add(k);
    const o = {};
    for (const k of keys) {
      if (!direction(k, role)) continue;
      const xs = []; let ws = 0, wv = 0;
      for (const s of pool) { const v = s[k]; if (typeof v !== 'number' || !Number.isFinite(v)) continue; xs.push(v); const w = s.PA ?? s.TBF ?? s.sc_PA ?? 1; ws += w; wv += w * v; }
      if (xs.length < 10) continue;
      xs.sort((a, b) => a - b);
      const q = (f) => { const i = f * (xs.length - 1); const lo = Math.floor(i); return xs[lo] + (xs[Math.min(lo + 1, xs.length - 1)] - xs[lo]) * (i - lo); };
      const qs = Array.from({ length: 11 }, (_, i) => q(i / 10));
      o[k] = [isCount(k) ? qs[5] : wv / ws, ...qs].map(sig);
    }
    out[sp] = o;
  }
  return out;
}
for (const y of seasons) {
  leaders[y] = {};
  for (const role of ['bat', 'pit']) {
    const f = path.join(root, y, `${role}.json`);
    if (!fs.existsSync(f)) continue;
    const players = JSON.parse(fs.readFileSync(f, 'utf8')).players;
    // our own sc_X calculations only fill gaps: show them as X (same rule as src/lib/data.js collapseCalc)
    for (const p of players) for (const sp of Object.values(p.splits)) for (const k of Object.keys(sp)) if (k.startsWith('sc_')) { if (sp[k.slice(3)] == null) sp[k.slice(3)] = sp[k]; delete sp[k]; }
    league[role][y] = leagueRef(players, role);
    for (const p of players) {
      const m = byRole[role];
      if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, seasons: {} });
      const e = m.get(p.id);
      e.name = p.name || e.name;
      e.seasons[y] = { team: p.team, splits: p.splits };
    }
    leaders[y][role] = players
      .filter((p) => typeof p.splits.all?.WAR === 'number')
      .sort((a, b) => b.splits.all.WAR - a.splits.all.WAR).slice(0, 15)
      .map((p) => ({ id: p.id, name: p.name, team: p.team, WAR: p.splits.all.WAR,
        a: role === 'bat' ? p.splits.all['wRC+'] : p.splits.all.ERA, b: role === 'bat' ? p.splits.all.HR : p.splits.all.SO }));
  }
}
const index = new Map();
let n = 0;
for (const role of ['bat', 'pit']) {
  fs.mkdirSync(path.join(root, 'players', role), { recursive: true });
  for (const [id, e] of byRole[role]) {
    fs.writeFileSync(path.join(root, 'players', role, `${id}.json`), JSON.stringify(e)); n++;
    const ys = Object.keys(e.seasons).sort();
    const cur = index.get(id) || { id, n: e.name, r: [], y: [ys[0], ys.at(-1)], t: e.seasons[ys.at(-1)].team };
    cur.r.push(role); cur.y = [Math.min(cur.y[0], ys[0]), Math.max(cur.y[1], ys.at(-1))];
    index.set(id, cur);
  }
}
fs.writeFileSync(path.join(root, 'players-index.json'), JSON.stringify([...index.values()]));
fs.writeFileSync(path.join(root, 'leaders.json'), JSON.stringify(leaders));
for (const role of ['bat', 'pit']) fs.writeFileSync(path.join(root, `league-${role}.json`), JSON.stringify(league[role]));
console.log(`wrote ${n} player files, index of ${index.size} players, leaders for ${seasons.length} seasons`);
