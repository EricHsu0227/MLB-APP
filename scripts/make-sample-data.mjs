// SYNTHETIC dev data so the UI can run without network access. Not real players or stats.
// Real data comes from `python pipeline/build.py <season>` (run in GitHub Actions).
import fs from 'node:fs';
let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const norm = (m, sd) => m + sd * (rnd() + rnd() + rnd() - 1.5) * 1.15;
const TEAMS = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'];
function bat(i) {
  const talent = norm(0, 1);
  const mk = (pa, d) => {
    const woba = 0.315 + 0.03 * (talent + d), ev = 88 + 1.6 * (talent + d) + norm(0, 0.5);
    return { PA: pa, AVG: 0.245 + 0.02 * (talent + d), OBP: 0.315 + 0.025 * (talent + d), SLG: 0.40 + 0.05 * (talent + d), wOBA: woba, 'wRC+': 100 + 18 * (talent + d), WAR: pa / 600 * (2 + 1.5 * talent),
      'K%': 0.22 - 0.02 * talent + norm(0, 0.02), 'BB%': 0.085 + 0.01 * talent + norm(0, 0.01),
      sc_PA: pa, sc_wOBA: woba, sc_xwOBA: woba + norm(0, 0.01), sc_EV: ev, sc_maxEV: ev + 17, sc_LA: 12 + norm(0, 3), 'sc_HardHit%': 0.38 + 0.05 * (talent + d), 'sc_Barrel%': 0.08 + 0.025 * (talent + d), 'sc_Whiff%': 0.25 - 0.02 * talent, 'sc_O-Swing%': 0.30 + norm(0, 0.03) };
  };
  const pa = Math.round(150 + rnd() * 500), d = norm(0, 0.3);
  return { id: 100000 + i, name: `Sample Hitter ${i + 1}`, team: TEAMS[i % 6], splits: { all: mk(pa, 0), vsR: mk(Math.round(pa * 0.7), d), vsL: mk(Math.round(pa * 0.3), -d) } };
}
function pit(i) {
  const talent = norm(0, 1);
  const mk = (ip, d) => ({ IP: ip, ERA: 4.2 - 0.7 * (talent + d), FIP: 4.1 - 0.6 * (talent + d), WHIP: 1.28 - 0.1 * (talent + d), 'K%': 0.22 + 0.04 * (talent + d), 'BB%': 0.085 - 0.01 * talent, WAR: ip / 180 * (2.5 + talent),
    sc_PA: Math.round(ip * 4.2), sc_wOBA: 0.320 - 0.025 * (talent + d), sc_xwOBA: 0.320 - 0.025 * (talent + d) + norm(0, 0.01), 'sc_Whiff%': 0.25 + 0.03 * (talent + d), 'sc_HardHit%': 0.38 - 0.04 * talent });
  const ip = Math.round(40 + rnd() * 150), d = norm(0, 0.3);
  return { id: 200000 + i, name: `Sample Pitcher ${i + 1}`, team: TEAMS[i % 6], splits: { all: mk(ip, 0), vsR: mk(Math.round(ip * 0.5), d), vsL: mk(Math.round(ip * 0.5), -d) } };
}
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v)));
fs.mkdirSync('public/data', { recursive: true });
const seasons = [2023, 2024, 2025];
for (const y of seasons) {
  fs.mkdirSync(`public/data/${y}`, { recursive: true });
  fs.writeFileSync(`public/data/${y}/bat.json`, JSON.stringify(round({ season: y, role: 'bat', players: Array.from({ length: 120 }, (_, i) => bat(i)) })));
  fs.writeFileSync(`public/data/${y}/pit.json`, JSON.stringify(round({ season: y, role: 'pit', players: Array.from({ length: 80 }, (_, i) => pit(i)) })));
}
fs.writeFileSync('public/data/index.json', JSON.stringify({ seasons, statcastFrom: 2015, synthetic: true }));
console.log('wrote synthetic sample data for', seasons.join(', '));
