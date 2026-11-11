// Stat catalog. Keys come from the data itself (every FanGraphs / Savant column is available);
// this file supplies labels, number formats, which direction is "good", and short descriptions.
const dash = (f) => (v) => (v == null || Number.isNaN(v) ? '—' : f(v));
const PCT = dash((v) => (v * 100).toFixed(1) + '%');
const RATE3 = dash((v) => v.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '-.'));
const D1 = dash((v) => v.toFixed(1));
const D2 = dash((v) => v.toFixed(2));
const INT = dash((v) => String(Math.round(v)));
const GEN = dash((v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)));

const RATE3_KEYS = new Set('wwOBA RRAA_wOBA lg_wwOBA lg_wOBA AVG OBP SLG OPS wOBA xwOBA xAVG xSLG ISO BABIP sc_wOBA sc_xwOBA'.split(' '));
const D2_KEYS = new Set('ERA FIP xFIP SIERA tERA xERA kwERA WHIP K/9 BB/9 HR/9 H/9 K/BB BB/K GB/FB RS/9 E-F pb_ERA'.split(' '));
const RRAA_RUNS = new Set('RRAA RRAA_Bat RRAA_BsR RRAA_Fld RRAA_wRAA RRAA_Park RRAA_Lg RRAA_FRV'.split(' '));
const D1_KEYS = new Set('WAR RWAR RAR wRAA wRC IP Spd EV maxEV EV90 LA sc_EV sc_maxEV sc_EV90 sc_LA AvgBatSpeed SwingLength AttackAngle AttackDirection Tilt BaseRunning Batting Fielding Positional Offense Defense Replacement Dollars WPA -WPA +WPA RE24 REW Clutch wBsR UBR XBR pLI phLI exLI gmLI inLI Start-IP Relief-IP DepthInBox DistanceOffPlate'.split(' '));

const GLOSS = {
  RRAA: 'Runs Above Average (Eric\'s metric). Hitters: batting runs from wwOBA with park and league adjustments, plus Savant baserunning and team-adjusted fielding runs. Pitchers: runs saved from wOBA allowed with a park adjustment',
  RRAA_Bat: 'RRAA batting runs: wwOBA runs above average + park + league adjustment', RRAA_BsR: 'RRAA base running runs (Savant Baserunning Run Value)', RRAA_Fld: 'RRAA fielding runs (Savant FRV minus team average per inning)',
  RRAA_wRAA: 'RRAA runs above average before the park and league adjustments', RRAA_Park: 'RRAA park adjustment (runs), from 3-year regressed park factors for every park the player played in', RRAA_Lg: 'RRAA league adjustment (runs): AL vs NL non-pitcher run environment', RRAA_PA: 'Plate appearances counted by RRAA', RRAA_FRV: 'Savant Fielding Run Value before the team adjustment', lg_wwOBA: 'League wwOBA this season', lg_wOBA: 'League wOBA this season',
  RWAR: 'RRAA wins above replacement: RRAA plus positional runs (hitters) and replacement runs, divided by runs per win. Scaled so hitter and pitcher totals match FanGraphs WAR', 'wwRC+': 'wRC+ built on wwOBA: RRAA batting runs per PA (with park and league adjustments) against the league non-pitcher rate; 100 = league average. For pitchers it is allowed, so lower is better', wwOBA: 'wOBA that also weights strikeouts, double plays and productive outs (RRAA run values)', RRAA_wOBA: 'wOBA allowed on the RRAA run-value scale (lower is better)',
  WAR: 'Wins Above Replacement (FanGraphs)', 'wRC+': 'Weighted Runs Created Plus; 100 = league average', wOBA: 'Weighted On-Base Average', xwOBA: 'Expected wOBA from exit velocity, launch angle and speed',
  xAVG: 'Expected batting average', xSLG: 'Expected slugging', ISO: 'Isolated power (SLG - AVG)', BABIP: 'Batting average on balls in play', 'K%': 'Strikeout rate', 'BB%': 'Walk rate',
  'O-Swing%': 'Swing rate on pitches outside the zone (chase rate)', 'Z-Swing%': 'Swing rate on pitches in the zone', 'SwStr%': 'Swinging-strike rate', 'CSW%': 'Called + whiff strike rate',
  'Barrel%': 'Barrels per batted ball event', 'HardHit%': 'Share of batted balls hit 95+ mph', EV: 'Average exit velocity', maxEV: 'Maximum exit velocity', LA: 'Average launch angle',
  ERA: 'Earned run average', FIP: 'Fielding Independent Pitching', xFIP: 'FIP with a league-average HR/FB rate', SIERA: 'Skill-Interactive ERA', 'LOB%': 'Left-on-base percentage',
  'K-BB%': 'Strikeout rate minus walk rate', WHIP: 'Walks + hits per inning', sp_stuff: 'Stuff+ (FanGraphs); 100 = average', sp_location: 'Location+ (FanGraphs); 100 = average', sp_pitching: 'Pitching+ (FanGraphs); 100 = average',
  AvgBatSpeed: 'Average bat speed (mph)', SwingLength: 'Average swing length (feet)', 'BlastContact%': 'Share of contact that is a blast', Spd: 'Speed score',
};
const LABELS = { sp_stuff: 'Stuff+', sp_location: 'Location+', sp_pitching: 'Pitching+', pb_stuff: 'PB Stuff', pb_command: 'PB Command', pb_overall: 'PitchingBot', RRAA_wRAA: 'RwRAA', RRAA_Park: 'RPARK', RRAA_Lg: 'RLG', RRAA_PA: 'RPA', RRAA_FRV: 'FRV (raw)', RRAA_Bat: 'RBAT', RRAA_BsR: 'RBSR', RRAA_Fld: 'RFLD', RRAA_wOBA: 'wOBA allowed (RRAA)', lg_wwOBA: 'Lg wwOBA', lg_wOBA: 'Lg wOBA' };
const PREFIX = [[/^sc_/, '', ' (calc)'], [/^pfx/, '', ' (PFX)'], [/^pi(?=[A-Za-z])/, '', ' (PI)'], [/^sp_/, 'Stuff+ ', ''], [/^pb_/, 'PB ', '']];

// Direction a stat is "good" in. 1 = higher is better, -1 = lower is better, 0 = neutral/context.
const BAT_LOW = /^(sc_)?(K%|K%\+|SwStr%|Soft%|Soft%\+|IFFB%|IFFB|GDP|CS|O-Swing%|GB%|GB%\+|PU%|Whiff%|BU|SO|Strikes|Balls|Swords|CStr%)$/;
const PIT_LOW = /^(RRAA_wOBA|wwOBA|wwRC\+|RRAA_Park|ERA|ERA-|FIP|FIP-|xFIP|xFIP-|SIERA|tERA|xERA|kwERA|WHIP|WHIP\+|BB%|BB%\+|BB\/9|BB\/9\+|HR\/9|HR\/9\+|H\/9|H\/9\+|AVG|AVG\+|OBP|SLG|OPS|BABIP|HR\/FB|HRFB%\+|Hard%|Hard%\+|Barrel%|HardHit%|EV|EV90|maxEV|LD%|LD%\+|R|ER|H|HR|BB|HBP|WP|BK|BS|L|E-F|Pull%|sc_BB%|sc_wOBA|sc_xwOBA|sc_Barrel%|sc_HardHit%|sc_EV|sc_EV90|sc_maxEV|wOBA|xwOBA|xAVG|xSLG|Zone%)$/;
const NEUTRAL = /^(RRAA_PA|lg_wwOBA|lg_wOBA|Season|Age|G|GS|Games|Pos|PA|AB|TPA|TBF|IP|Pitches|BBE|bipCount|Events|playerTeamId|teamid|SeasonMin|SeasonMax|Q|Pull%|Cent%|Oppo%|Med%|FB%|GB\/FB|Tilt|AttackDirection|DepthInBox|DistanceOffPlate|sc_PA|sc_BBE|sc_Pitches|sc_Swing%|sc_LA|LA)$/;

const SV_NAMES = { sv_OAA: 'OAA', sv_FRP: 'Fielding Runs Prevented', sv_FRV: 'Fielding Run Value', sv_FRV_Range: 'FRV Range', sv_FRV_Arm: 'FRV Arm', sv_FRV_Framing: 'FRV Framing', sv_FRV_Block: 'FRV Blocking', sv_FRV_Throw: 'FRV Throwing',
  sv_Arm: 'Arm Strength', sv_ArmMax: 'Max Arm', sv_Throws: 'Throws', sv_FramingRV: 'Framing Runs', 'sv_Framing%': 'Framing Strike%', sv_FramingPitches: 'Framing Pitches',
  sv_Sprint: 'Sprint Speed', sv_HPto1B: 'Home to 1B', sv_Bolts: 'Bolts', sv_CompRuns: 'Competitive Runs', sv_SwingRV: 'Bat Tracking RV', 'sv_HardSwing%': 'Hard Swing%', 'sv_SqUpSwing%': 'Squared-up/Swing', 'sv_BlastSwing%': 'Blast/Swing' };
/** Direction for Savant keys (prefix sv), or undefined when the generic rules apply. */
function svDirection(key, role) {
  if (!key.startsWith('sv')) return undefined;
  const pit = role === 'pit';
  if (key.startsWith('svA_')) {
    if (/(%|Velo|Spin|HB|IVB|Ext| Pitches)$/.test(key) && !/(Whiff|PutAway|K|HardHit)%$/.test(key)) return /Velo$/.test(key) && pit ? 1 : 0;
    if (/RV(\/100)?$/.test(key)) return 1; // pitcher run values are stored with the sign flipped (positive = runs saved)
    if (/(Whiff|PutAway|K)%$/.test(key)) return pit ? 1 : -1;
    return pit ? -1 : 1; // BA, SLG, wOBA, xwOBA, HardHit%
  }
  if (key.startsWith('svST_')) return /RV$/.test(key) ? 1 : 0;
  if (key.startsWith('svBB_')) {
    if (/(Pull|Straight|Oppo)%$/.test(key)) return 0;
    const good = /(Barrel|Solid|Flare\/Burner|Sweet Spot|Pull Air)%$/.test(key);
    return (good ? 1 : -1) * (pit ? -1 : 1);
  }
  if (key === 'sv_HPto1B') return -1;
  if (/^sv_(Throws|FramingPitches|CompRuns)$/.test(key)) return 0;
  return 1;
}

export function direction(key, role = 'bat') {
  const sv = svDirection(key, role);
  if (sv !== undefined) return sv;
  if (NEUTRAL.test(key) || /^(pi|pfx)/.test(key)) return 0;
  if (role === 'pit') {
    if (PIT_LOW.test(key)) return -1;
    return 1;
  }
  return BAT_LOW.test(key) ? -1 : 1;
}

function pickFormat(key) {
  if (key.startsWith('sv')) {
    if (/%$|\/Swing%?$/.test(key) || key === 'sv_SqUpSwing%') return PCT;
    if (/ (BA|SLG|wOBA|xwOBA)$/.test(key)) return RATE3;
    if (/RV\/100$|HPto1B$/.test(key)) return D2;
    if (/ (Spin|Pitches)$|^sv_(OAA|Throws|Bolts|CompRuns|FramingPitches)$/.test(key)) return INT;
    return D1;
  }
  if (RRAA_RUNS.has(key)) return INT; // RRAA run totals show as whole runs
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
  let label = LABELS[key] || SV_NAMES[key] || (key.startsWith('svA_') ? key.slice(4) : key.startsWith('svST_') ? key.slice(5) : key.startsWith('svBB_') ? key.slice(5) : key);
  if (!LABELS[key] && !key.startsWith('sv')) for (const [re, pre, suf] of PREFIX) if (re.test(key)) { label = pre + key.replace(re, '') + suf; break; }
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

// Counting stats (totals that grow with playing time). Everything else is treated as a rate.
const COUNT = /^(G|GS|AB|PA|TBF|IP|H|1B|2B|3B|HR|R|RBI|BB|IBB|SO|HBP|SF|SH|GDP|SB|CS|W|L|SV|HLD|BS|CG|ShO|ER|WP|BK|Pitches|Balls|Strikes|Barrels|HardHit|IFH|BUH|Pull|Cent|Oppo|Soft|Med|Hard|GB|FB|LD|IFFB|BU|TB|WAR|WAROld|RAR|RRAA|RRAA_.*|wRAA|wRC|Batting|BaseRunning|Fielding|Positional|Offense|Defense|Replacement|Dollars|WPA|-WPA|\+WPA|RE24|REW|Clutch|wBsR|UBR|XBR|GDPRuns|CFraming|bipCount|Events|BBE|Starting|Relieving|Start-IP|Relief-IP|RA9-Wins|BIP-Wins|LOB-Wins|BS-Wins|w[A-Z]{2}|(pi|pfx)w[A-Z]+|sc_(PA|BBE|Pitches))$/;
export const isCount = (key) => COUNT.test(key);
