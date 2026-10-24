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
