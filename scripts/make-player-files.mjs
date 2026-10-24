// Splits public/data/<season>/<role>.json into small per-player career files:
//   public/data/players/<role>/<id>.json = { id, name, seasons: { "<year>": { team, splits } } }
// so the player page loads ~tens of KB instead of every season's full file. Runs before `vite build`.
import fs from 'node:fs';
import path from 'node:path';
const root = 'public/data';
const seasons = fs.readdirSync(root).filter((n) => /^\d{4}$/.test(n)).sort();
fs.rmSync(path.join(root, 'players'), { recursive: true, force: true });
const byRole = { bat: new Map(), pit: new Map() };
for (const y of seasons) {
  for (const role of ['bat', 'pit']) {
    const f = path.join(root, y, `${role}.json`);
    if (!fs.existsSync(f)) continue;
    for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).players) {
      const m = byRole[role];
      if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, seasons: {} });
      const e = m.get(p.id);
      e.name = p.name || e.name;
      e.seasons[y] = { team: p.team, splits: p.splits };
    }
  }
}
let n = 0;
for (const role of ['bat', 'pit']) {
  fs.mkdirSync(path.join(root, 'players', role), { recursive: true });
  for (const [id, e] of byRole[role]) { fs.writeFileSync(path.join(root, 'players', role, `${id}.json`), JSON.stringify(e)); n++; }
}
console.log(`wrote ${n} player files from ${seasons.length} seasons`);
