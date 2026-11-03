// Static team table. `abbr` matches the FanGraphs abbreviations in our data; `id` is the MLB Stats API team id.
const T = (abbr, id, name, lg, div) => ({ abbr, id, name, lg, div });
export const TEAMS = [
  T('BAL', 110, 'Baltimore Orioles', 'AL', 'East'), T('BOS', 111, 'Boston Red Sox', 'AL', 'East'), T('NYY', 147, 'New York Yankees', 'AL', 'East'), T('TBR', 139, 'Tampa Bay Rays', 'AL', 'East'), T('TOR', 141, 'Toronto Blue Jays', 'AL', 'East'),
  T('CHW', 145, 'Chicago White Sox', 'AL', 'Central'), T('CLE', 114, 'Cleveland Guardians', 'AL', 'Central'), T('DET', 116, 'Detroit Tigers', 'AL', 'Central'), T('KCR', 118, 'Kansas City Royals', 'AL', 'Central'), T('MIN', 142, 'Minnesota Twins', 'AL', 'Central'),
  T('ATH', 133, 'Athletics', 'AL', 'West'), T('HOU', 117, 'Houston Astros', 'AL', 'West'), T('LAA', 108, 'Los Angeles Angels', 'AL', 'West'), T('SEA', 136, 'Seattle Mariners', 'AL', 'West'), T('TEX', 140, 'Texas Rangers', 'AL', 'West'),
  T('ATL', 144, 'Atlanta Braves', 'NL', 'East'), T('MIA', 146, 'Miami Marlins', 'NL', 'East'), T('NYM', 121, 'New York Mets', 'NL', 'East'), T('PHI', 143, 'Philadelphia Phillies', 'NL', 'East'), T('WSN', 120, 'Washington Nationals', 'NL', 'East'),
  T('CHC', 112, 'Chicago Cubs', 'NL', 'Central'), T('CIN', 113, 'Cincinnati Reds', 'NL', 'Central'), T('MIL', 158, 'Milwaukee Brewers', 'NL', 'Central'), T('PIT', 134, 'Pittsburgh Pirates', 'NL', 'Central'), T('STL', 138, 'St. Louis Cardinals', 'NL', 'Central'),
  T('ARI', 109, 'Arizona Diamondbacks', 'NL', 'West'), T('COL', 115, 'Colorado Rockies', 'NL', 'West'), T('LAD', 119, 'Los Angeles Dodgers', 'NL', 'West'), T('SDP', 135, 'San Diego Padres', 'NL', 'West'), T('SFG', 137, 'San Francisco Giants', 'NL', 'West'),
];
export const teamByAbbr = (a) => TEAMS.find((t) => t.abbr === a);
export const teamById = (id) => TEAMS.find((t) => t.id === +id);
export const DIVISIONS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];
export const divisionOf = (t) => `${t.lg} ${t.div}`;
export const logo = (id) => `https://www.mlbstatic.com/team-logos/${id}.svg`;

// [primary, accent that reads well on a black background]
const COLORS = {
  ARI: ['#A71930', '#E04A5F'], ATL: ['#13274F', '#CE1141'], BAL: ['#DF4601', '#F26A21'], BOS: ['#0C2340', '#D2353F'], CHC: ['#0E3386', '#4F7BE0'],
  CHW: ['#27251F', '#C4CED4'], CIN: ['#C6011F', '#E8344A'], CLE: ['#0C2340', '#E31937'], COL: ['#33006F', '#8E6BD1'], DET: ['#0C2340', '#FA4616'],
  HOU: ['#002D62', '#EB6E1F'], KCR: ['#004687', '#BD9B60'], LAA: ['#003263', '#E0283F'], LAD: ['#005A9C', '#3E8EDE'], MIA: ['#0077A6', '#00A3E0'],
  MIL: ['#12284B', '#FFC52F'], MIN: ['#002B5C', '#D31145'], NYM: ['#002D72', '#FF5910'], NYY: ['#0C2340', '#9FB3D1'], ATH: ['#003831', '#EFB21E'],
  OAK: ['#003831', '#EFB21E'], PHI: ['#002D72', '#E81828'], PIT: ['#27251F', '#FDB827'], SDP: ['#2F241D', '#FFC425'], SEA: ['#0C2C56', '#00A3A3'],
  SFG: ['#27251F', '#FD5A1E'], STL: ['#0C2340', '#E0425C'], TBR: ['#092C5C', '#8FBCE6'], TEX: ['#003278', '#E0303F'], TOR: ['#134A8E', '#4C8FE0'],
  WSN: ['#14225A', '#D1202B'],
};
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
/** CSS variables that paint a page in a team's colors, or null for unknown / multi-team rows. */
export function teamVars(abbr) {
  const c = COLORS[abbr];
  if (!c) return null;
  return { '--accent': c[1], '--accent-fg': lum(c[1]) > 0.3 ? '#111' : '#fff', '--team': c[0], '--c1': c[1] };
}
