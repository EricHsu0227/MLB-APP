// Derives small lookup files from the season files (runs before `vite build` / `vite`):
//   public/data/players/<role>/<id>.json  = { id, name, seasons: { "<year>": { team, splits } } }
//   public/data/players-index.json        = [{ id, n: name, r: ["bat","pit"], y: [first,last], t: lastTeam }]
//   public/data/leaders.json              = { "<year>": { bat: [...top WAR], pit: [...top WAR] } }
import fs from 'node:fs';
import path from 'node:path';
const root = 'public/data';
const seasons = fs.readdirSync(root).filter((n) => /^\d{4}$/.test(n)).sort();
fs.rmSync(path.join(root, 'players'), { recursive: true, force: true });
const byRole = { bat: new Map(), pit: new Map() };
const leaders = {};
for (const y of seasons) {
  leaders[y] = {};
  for (const role of ['bat', 'pit']) {
    const f = path.join(root, y, `${role}.json`);
    if (!fs.existsSync(f)) continue;
    const players = JSON.parse(fs.readFileSync(f, 'utf8')).players;
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
console.log(`wrote ${n} player files, index of ${index.size} players, leaders for ${seasons.length} seasons`);
