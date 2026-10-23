// Stat catalog. Keys come from the data itself (so every FanGraphs / Savant column is available);
// this file only supplies labels, formats and which direction is "good" for known stats.
const PCT = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');
const RATE3 = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0\./, '.'));
const D1 = (v) => (v == null ? '—' : v.toFixed(1));
const INT = (v) => (v == null ? '—' : String(Math.round(v)));

const KNOWN = {
  AVG: { f: RATE3 }, OBP: { f: RATE3 }, SLG: { f: RATE3 }, OPS: { f: RATE3 }, wOBA: { f: RATE3 }, ISO: { f: RATE3 }, BABIP: { f: RATE3 },
  'wRC+': { f: INT }, WAR: { f: D1 }, ERA: { f: (v) => (v == null ? '—' : v.toFixed(2)), lowGood: true }, FIP: { f: (v) => (v == null ? '—' : v.toFixed(2)), lowGood: true },
  WHIP: { f: (v) => (v == null ? '—' : v.toFixed(2)), lowGood: true },
  'K%': { f: PCT }, 'BB%': { f: PCT },
  sc_wOBA: { f: RATE3, label: 'wOBA (calc)' }, sc_xwOBA: { f: RATE3, label: 'xwOBA (calc)' },
  sc_EV: { f: D1, label: 'Avg EV' }, sc_maxEV: { f: D1, label: 'Max EV' }, sc_EV90: { f: D1, label: 'EV90' }, sc_LA: { f: D1, label: 'Avg LA' },
};
const LOW_GOOD = /^(sc_)?(K%|ERA|FIP|xFIP|WHIP|BB\/9|HR\/9|GB%|PU%)$/;

export const SPLITS = [['all', 'All'], ['vsL', 'vs LHP / LHB'], ['vsR', 'vs RHP / RHB']];

export function statDef(key, role = 'bat') {
  const k = KNOWN[key] || {};
  const calc = key.startsWith('sc_');
  const base = key.replace(/^sc_/, '');
  const isPct = /%$/.test(base);
  const lowGood = k.lowGood ?? (LOW_GOOD.test(key) && role === 'bat' ? key.includes('K%') || key.includes('GB') || key.includes('PU') : LOW_GOOD.test(key));
  return {
    key, calc,
    label: k.label || (calc ? base + ' (calc)' : base),
    f: k.f || (isPct ? PCT : (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2))),
    // pitchers want K% high / BB% low; batters the opposite for K% and BB%... handled via role in percentile()
    lowGood: role === 'pit' ? invertForPitcher(key, lowGood) : lowGood,
  };
}
function invertForPitcher(key, low) {
  if (/(^|_)K%$/.test(key) || /Whiff|Swing|Chase|O-Swing|SwStr|CSW/.test(key)) return false;
  if (/BB%|ERA|FIP|WHIP|HR\/9|BB\/9|HardHit|Barrel|(^|_)EV|wOBA|xwOBA|AVG|OBP|SLG|OPS/.test(key)) return true;
  return low;
}

export function statKeys(rows) {
  const s = new Set();
  for (const r of rows) for (const sp of Object.values(r.splits)) for (const k of Object.keys(sp)) s.add(k);
  return [...s].sort((a, b) => a.localeCompare(b));
}
