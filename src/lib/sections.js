// FanGraphs / Savant style sections. A section lists the stat keys to show (those present in the data);
// `match` adds every key a regex catches, so pitch-level columns do not need to be listed by hand.
const L = (s) => s.split(/\s+/).filter(Boolean);

const COMMON = {
  battedBall: { label: 'Batted Ball', keys: L('GB/FB LD% GB% FB% IFFB% HR/FB IFH IFH% BUH BUH% Pull% Cent% Oppo% Soft% Med% Hard% GB%+ FB%+ LD%+ Pull%+ Cent%+ Oppo%+ Soft%+ Med%+ Hard%+ HRFB%+ Pull Cent Oppo Soft Med Hard GB FB LD IFFB') },
  discipline: { label: 'Plate Discipline', keys: L('O-Swing% Z-Swing% Swing% O-Contact% Z-Contact% Contact% Zone% F-Strike% SwStr% CStr% C+SwStr% Pitches Balls Strikes'), match: /^sc[A-Z]+-(Contact|Swing|Zone)%$/ },
  statcast: { label: 'Statcast', keys: L('EV maxEV EV90 LA Barrel% Barrels HardHit% HardHit xAVG xSLG xwOBA xERA bipCount sc_PA sc_BBE sc_EV sc_maxEV sc_EV90 sc_LA sc_Barrel% sc_HardHit% sc_SweetSpot% sc_wOBA sc_xwOBA sc_K% sc_BB% sc_Whiff% sc_Swing% sc_Z-Swing% sc_O-Swing% sc_Z-Contact% sc_O-Contact% sc_GB% sc_LD% sc_FB% sc_PU%') },
  batTracking: { label: 'Bat Tracking', keys: L('AvgBatSpeed FastSwing% SwingLength Swords SquaredUpContact% SquaredUpSwing% BlastContact% BlastSwing% AttackAngle AttackDirection IdealAttackAngle% Tilt DepthInBox DistanceOffPlate CompetitiveSwings') },
  pitchInfo: { label: 'Pitch Info', keys: L('FB% SL% CB% CH% CT% SF% KN% XX% FBv SLv CBv CHv CTv SFv KNv'), match: /^(pi|pfx)(?!w)[A-Za-z]+(%|-X|-Z)?$|^(pi|pfx)(v|sp|aa)[A-Z]+$|^(pi|pfx)(Pace|Contact%|O-Swing%|O-Contact%|Z-Swing%|Z-Contact%|Zone%|Swing%)$/ },
  pitchValues: { label: 'Pitch Values', keys: L('wFB wSL wCB wCH wCT wSF wKN wFB/C wSL/C wCB/C wCH/C wCT/C wSF/C wKN/C'), match: /^(pi|pfx)w[A-Z]+(\/C)?$/ },
  winProb: { label: 'Win Probability', keys: L('WPA -WPA +WPA RE24 REW pLI phLI exLI gmLI inLI PH WPA/LI Clutch') },
};

export const SECTIONS = {
  bat: {
    dashboard: { label: 'Dashboard', keys: L('G PA HR R RBI SB BB% K% ISO BABIP AVG OBP SLG wOBA xwOBA wRC+ BaseRunning Offense Defense WAR') },
    standard: { label: 'Standard', keys: L('G AB PA H 1B 2B 3B HR R RBI BB IBB SO HBP SF SH GDP SB CS AVG') },
    advanced: { label: 'Advanced', keys: L('PA BB% K% BB/K AVG OBP SLG OPS ISO BABIP wRAA wRC wOBA wRC+ Spd AVG+ BB%+ K%+ OBP+ SLG+ ISO+ BABIP+') },
    battedBall: COMMON.battedBall, discipline: COMMON.discipline, statcast: COMMON.statcast, batTracking: COMMON.batTracking,
    value: { label: 'Value', keys: L('Batting BaseRunning Fielding Positional Offense Defense Replacement RAR WAR WAROld Dollars wBsR UBR XBR GDPRuns CFraming Age') },
    pitchInfo: COMMON.pitchInfo, pitchValues: COMMON.pitchValues, winProb: COMMON.winProb,
  },
  pit: {
    dashboard: { label: 'Dashboard', keys: L('W L SV G GS IP K/9 BB/9 HR/9 BABIP LOB% GB% HR/FB FBv ERA xERA FIP xFIP WAR') },
    standard: { label: 'Standard', keys: L('W L ERA G GS CG ShO SV HLD BS IP TBF H R ER HR BB IBB HBP WP BK SO') },
    advanced: { label: 'Advanced', keys: L('K/9 BB/9 K/BB HR/9 K% BB% K-BB% AVG WHIP BABIP LOB% ERA- FIP- xFIP- ERA FIP E-F xFIP SIERA tERA xERA kwERA K/9+ BB/9+ K/BB+ H/9+ HR/9+ AVG+ WHIP+ BABIP+ LOB%+') },
    battedBall: COMMON.battedBall, discipline: COMMON.discipline, statcast: COMMON.statcast,
    stuff: { label: 'Stuff+ & PitchingBot', keys: L('sp_stuff sp_location sp_pitching pb_stuff pb_command pb_overall pb_ERA pb_xRV100'), match: /^(sp_|pb_)/ },
    value: { label: 'Value', keys: L('WAR RAR Dollars RA9-Wins BIP-Wins LOB-Wins BS-Wins Relief-IP Start-IP Starting Relieving Age') },
    pitchInfo: COMMON.pitchInfo, pitchValues: COMMON.pitchValues, winProb: COMMON.winProb,
  },
};
SECTIONS.bat.all = SECTIONS.pit.all = { label: 'All stats', keys: [], all: true };

export const sectionIds = (role) => Object.keys(SECTIONS[role]);
export const sectionLabel = (role, id) => SECTIONS[role][id]?.label || id;

/** Keys of a section that exist in `available` (a Set / array of every key in the data). */
export function sectionKeys(role, id, available) {
  const sec = SECTIONS[role][id];
  const have = available instanceof Set ? available : new Set(available);
  if (sec.all) return [...have].sort((a, b) => a.localeCompare(b));
  const out = sec.keys.filter((k) => have.has(k));
  if (sec.match) for (const k of [...have].sort()) if (sec.match.test(k) && !out.includes(k)) out.push(k);
  return out;
}
