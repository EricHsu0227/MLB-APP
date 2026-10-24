// Stat catalog. Keys come from the data itself (every FanGraphs / Savant column is available);
// this file supplies labels, number formats, which direction is "good", and short descriptions.
const dash = (f) => (v) => (v == null || Number.isNaN(v) ? '—' : f(v));
const PCT = dash((v) => (v * 100).toFixed(1) + '%');
const RATE3 = dash((v) => v.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '-.'));
const D1 = dash((v) => v.toFixed(1));
const D2 = dash((v) => v.toFixed(2));
const INT = dash((v) => String(Math.round(v)));
const GEN = dash((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)));

const RATE3_KEYS = new Set('AVG OBP SLG OPS wOBA xwOBA xAVG xSLG ISO BABIP sc_wOBA sc_xwOBA'.split(' '));
const D2_KEYS = new Set('ERA FIP xFIP SIERA tERA xERA kwERA WHIP K/9 BB/9 HR/9 H/9 K/BB BB/K GB/FB RS/9 E-F pb_ERA'.split(' '));
const D1_KEYS = new Set('WAR RAR wRAA wRC IP Spd EV maxEV EV90 LA sc_EV sc_maxEV sc_EV90 sc_LA AvgBatSpeed SwingLength AttackAngle AttackDirection Tilt BaseRunning Batting Fielding Positional Offense Defense Replacement Dollars WPA -WPA +WPA RE24 REW Clutch wBsR UBR XBR pLI phLI exLI gmLI inLI Start-IP Relief-IP DepthInBox DistanceOffPlate'.split(' '));

const GLOSS = {
  WAR: 'Wins Above Replacement (FanGraphs)', 'wRC+': 'Weighted Runs Created Plus; 100 = league average', wOBA: 'Weighted On-Base Average', xwOBA: 'Expected wOBA from exit velocity, launch angle and speed',
  xAVG: 'Expected batting average', xSLG: 'Expected slugging', ISO: 'Isolated power (SLG - AVG)', BABIP: 'Batting average on balls in play', 'K%': 'Strikeout rate', 'BB%': 'Walk rate',
  'O-Swing%': 'Swing rate on pitches outside the zone (chase rate)', 'Z-Swing%': 'Swing rate on pitches in the zone', 'SwStr%': 'Swinging-strike rate', 'CSW%': 'Called + whiff strike rate',
  'Barrel%': 'Barrels per batted ball event', 'HardHit%': 'Share of batted balls hit 95+ mph', EV: 'Average exit velocity', maxEV: 'Maximum exit velocity', LA: 'Average launch angle',
  ERA: 'Earned run average', FIP: 'Fielding Independent Pitching', xFIP: 'FIP with a league-average HR/FB rate', SIERA: 'Skill-Interactive ERA', 'LOB%': 'Left-on-base percentage',
  'K-BB%': 'Strikeout rate minus walk rate', WHIP: 'Walks + hits per inning', sp_stuff: 'Stuff+ (FanGraphs); 100 = average', sp_location: 'Location+ (FanGraphs); 100 = average', sp_pitching: 'Pitching+ (FanGraphs); 100 = average',
  AvgBatSpeed: 'Average bat speed (mph)', SwingLength: 'Average swing length (feet)', 'BlastContact%': 'Share of contact that is a blast', Spd: 'Speed score',
};
const PREFIX = [[/^sc_/, '', ' (calc)'], [/^pfx/, '', ' (PFX)'], [/^pi(?=[A-Za-z])/, '', ' (PI)'], [/^sp_/, 'Stuff+ ', ''], [/^pb_/, 'PB ', '']];

// Direction a stat is "good" in. 1 = higher is better, -1 = lower is better, 0 = neutral/context.
const BAT_LOW = /^(sc_)?(K%|K%\+|SwStr%|Soft%|Soft%\+|IFFB%|IFFB|GDP|CS|O-Swing%|GB%|GB%\+|PU%|Whiff%|BU|SO|Strikes|Balls|Swords|CStr%)$/;
const PIT_LOW = /^(ERA|ERA-|FIP|FIP-|xFIP|xFIP-|SIERA|tERA|xERA|kwERA|WHIP|WHIP\+|BB%|BB%\+|BB\/9|BB\/9\+|HR\/9|HR\/9\+|H\/9|H\/9\+|AVG|AVG\+|OBP|SLG|OPS|BABIP|HR\/FB|HRFB%\+|Hard%|Hard%\+|Barrel%|HardHit%|EV|EV90|maxEV|LD%|LD%\+|R|ER|H|HR|BB|HBP|WP|BK|BS|L|E-F|Pull%|sc_BB%|sc_wOBA|sc_xwOBA|sc_Barrel%|sc_HardHit%|sc_EV|sc_EV90|sc_maxEV|wOBA|xwOBA|xAVG|xSLG|Zone%)$/;
const NEUTRAL = /^(Season|Age|G|GS|Games|Pos|PA|AB|TPA|TBF|IP|Pitches|BBE|bipCount|Events|playerTeamId|teamid|SeasonMin|SeasonMax|Q|Pull%|Cent%|Oppo%|Med%|FB%|GB\/FB|Tilt|AttackDirection|DepthInBox|DistanceOffPlate|sc_PA|sc_BBE|sc_Pitches|sc_Swing%|sc_LA|LA)$/;

export function direction(key, role = 'bat') {
  if (NEUTRAL.test(key) || /^(pi|pfx)/.test(key)) return 0;
  if (role === 'pit') {
    if (PIT_LOW.test(key)) return -1;
    return 1;
  }
  return BAT_LOW.test(key) ? -1 : 1;
}

function pickFormat(key) {
  if (RATE3_KEYS.has(key)) return RATE3;
  if (D2_KEYS.has(key)) return D2;
  if (D1_KEYS.has(key)) return D1;
  if (/\+$|-$/.test(key)) return INT; // wRC+, K%+, ERA-, FIP-
  if (/^(pi|pfx)(v|sp|aa)[A-Za-z]/.test(key) || /^(FB|SL|CB|CH|CT|SF|KN)v$/.test(key) || /-[XZ]$/.test(key)) return D1;
  if (/^(pi|pfx)w|^w[A-Z]{2}(\/C)?$/.test(key)) return key.endsWith('/C') ? D2 : D1;
  if (/%$/.test(key)) return PCT;
  if (/^(sp_|pb_)/.test(key)) return D1;
  return GEN;
}

export function statDef(key, role = 'bat') {
  const calc = key.startsWith('sc_');
  const base = key.replace(/^sc_/, '');
  const f = pickFormat(key);
  let label = key;
  for (const [re, pre, suf] of PREFIX) if (re.test(key)) { label = pre + key.replace(re, '') + suf; break; }
  return { key, calc, label, f, pct: f === PCT, dir: direction(key, role), lowGood: direction(key, role) < 0, desc: GLOSS[key] || GLOSS[base] || '', group: calc ? 'Calculated' : '' };
}

export const SPLITS = [['all', 'All'], ['vsL', role => (role === 'pit' ? 'vs LHB' : 'vs LHP')], ['vsR', role => (role === 'pit' ? 'vs RHB' : 'vs RHP')]];
export const splitLabel = (id, role = 'bat') => { const s = SPLITS.find((x) => x[0] === id); return typeof s[1] === 'function' ? s[1](role) : s[1]; };

export function statKeys(rows) {
  const s = new Set();
  for (const r of rows) for (const sp of Object.values(r.splits)) for (const k of Object.keys(sp)) s.add(k);
  return [...s].sort((a, b) => a.localeCompare(b));
}
export const keysOfSeasons = (seasonsObj) => {
  const s = new Set();
  for (const e of Object.values(seasonsObj)) for (const sp of Object.values(e.splits)) for (const k of Object.keys(sp)) s.add(k);
  return s;
};
