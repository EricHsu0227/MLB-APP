// FanGraphs / Savant style sections. A section lists the stat keys to show (those present in the data);
// `match` adds every key a regex catches, so pitch-level columns do not need to be listed by hand.
const L = (s) => s.split(/\s+/).filter(Boolean);

const COMMON = {
  battedBall: { label: 'Batted Ball', keys: L('GB/FB LD% GB% FB% IFFB% HR/FB IFH IFH% BUH BUH% Pull% Cent% Oppo% Soft% Med% Hard% GB%+ FB%+ LD%+ Pull%+ Cent%+ Oppo%+ Soft%+ Med%+ Hard%+ HRFB%+ Pull Cent Oppo Soft Med Hard GB FB LD IFFB') },
  discipline: { label: 'Plate Discipline', keys: L('O-Swing% Z-Swing% Swing% O-Contact% Z-Contact% Contact% Zone% F-Strike% SwStr% CStr% C+SwStr% Pitches Balls Strikes'), match: /^sc[A-Z]+-(Contact|Swing|Zone)%$|^(pi|pfx)(Pace|Contact%|O-Swing%|O-Contact%|Z-Swing%|Z-Contact%|Zone%|Swing%)$/ },
  statcast: { label: 'Statcast', keys: L('EV maxEV EV90 LA Barrel% Barrels HardHit% HardHit xAVG xSLG xwOBA xERA bipCount sc_PA sc_BBE sc_EV sc_maxEV sc_EV90 sc_LA sc_Barrel% sc_HardHit% sc_SweetSpot% sc_wOBA sc_xwOBA sc_K% sc_BB% sc_Whiff% sc_Swing% sc_Z-Swing% sc_O-Swing% sc_Z-Contact% sc_O-Contact% sc_GB% sc_LD% sc_FB% sc_PU%') },
  batTracking: { label: 'Bat Tracking', keys: L('sv_SwingRV sv_HardSwing% sv_SqUpSwing% sv_BlastSwing% AvgBatSpeed FastSwing% SwingLength Swords SquaredUpContact% SquaredUpSwing% BlastContact% BlastSwing% AttackAngle AttackDirection IdealAttackAngle% Tilt DepthInBox DistanceOffPlate CompetitiveSwings') },
  pitchType: { label: 'Pitch Type', keys: L('FB% SL% CB% CH% CT% SF% KN% XX%'), match: /^(pi|pfx)[A-Z]{2,3}%$/ },
  velocity: { label: 'Velocity', keys: L('FBv SLv CBv CHv CTv SFv KNv'), match: /^(pi|pfx)v[A-Z]+$/ },
  movement: { label: 'Movement & Spin', keys: [], match: /^(pi|pfx)[A-Z]+-[XZ]$|^pfx(sp|aa)[A-Z]+$/ },
  pitchValues: { label: 'Pitch Values', keys: L('wFB wSL wCB wCH wCT wSF wKN wFB/C wSL/C wCB/C wCH/C wCT/C wSF/C wKN/C'), match: /^(pi|pfx)w[A-Z]+(\/C)?$/ },
  plus: { label: '+ Stats', keys: [], match: /^[A-Za-z][A-Za-z0-9/%]*[+-]$/ },
  arsenal: { label: 'Pitch Arsenal (Savant)', keys: [], match: /^svA_/ },
  swingTake: { label: 'Swing / Take', keys: ['svST_RV', 'svST_Swing RV', 'svST_Take RV'], match: /^svST_/ },
  bbProfile: { label: 'Batted Ball Profile', keys: L('sc_GB% sc_LD% sc_FB% sc_PU%'), match: /^svBB_/ },
  expected: { label: 'Expected Stats', keys: L('AVG xAVG SLG xSLG wOBA xwOBA sc_wOBA sc_xwOBA ERA xERA') },
  winProb: { label: 'Win Probability', keys: L('WPA -WPA +WPA RE24 REW pLI phLI exLI gmLI inLI PH WPA/LI Clutch') },
};

export const SECTIONS = {
  bat: {
    playerValue: { label: 'Player value', keys: L('WAR RRAA RAR Batting BaseRunning Fielding Positional Offense Defense RRAA_Bat RRAA_BsR RRAA_Fld wRAA wRC wRC+ WPA RE24 Dollars'), editable: true },
    realAbility: { label: 'Real ability', keys: L('xwOBA wwOBA wwRC+ xAVG xSLG EV EV90 maxEV Barrel% HardHit% LA K% BB% O-Swing% Z-Contact% SwStr% Contact% AvgBatSpeed SquaredUpContact% BlastContact% Spd sc_xwOBA sc_EV90 sc_Barrel%'), editable: true },
    standard: { label: 'Standard', keys: L('G AB PA H 1B 2B 3B HR R RBI BB IBB SO HBP SF SH GDP SB CS AVG') },
    advanced: { label: 'Advanced', keys: L('PA BB% K% BB/K AVG OBP SLG OPS ISO BABIP wRAA wRC wOBA wRC+ Spd AVG+ BB%+ K%+ OBP+ SLG+ ISO+ BABIP+') },
    statcast: COMMON.statcast, battedBall: COMMON.battedBall, discipline: COMMON.discipline, batTracking: COMMON.batTracking,
    value: { label: 'Value', keys: L('Batting BaseRunning Fielding Positional Offense Defense Replacement RAR WAR WAROld Dollars wBsR UBR XBR GDPRuns CFraming Age') },
    rraa: { label: 'RRAA', keys: L('RRAA RRAA_Bat RRAA_wRAA RRAA_Park RRAA_Lg RRAA_BsR RRAA_Fld RRAA_FRV wwOBA wwRC+ lg_wwOBA RRAA_PA WAR') },
    fielding: { label: 'Fielding', keys: L('sv_OAA sv_FRP sv_FRV sv_FRV_Range sv_FRV_Arm sv_FRV_Throw sv_FRV_Block sv_FRV_Framing sv_Arm sv_ArmMax sv_Throws sv_FramingRV sv_Framing% sv_FramingPitches Fielding Defense Positional CFraming RRAA_Fld RRAA_FRV') },
    running: { label: 'Running', keys: L('sv_Sprint sv_HPto1B sv_Bolts sv_CompRuns RRAA_BsR BaseRunning wBsR UBR XBR Spd SB CS') },
    arsenal: { ...COMMON.arsenal, label: 'Pitches Faced (Savant)' }, swingTake: COMMON.swingTake, bbProfile: COMMON.bbProfile, expected: COMMON.expected,
    plus: COMMON.plus, winProb: COMMON.winProb,
    pitchType: { ...COMMON.pitchType, label: 'Pitch Type (faced)' }, velocity: { ...COMMON.velocity, label: 'Velocity (faced)' },
    pitchValues: COMMON.pitchValues, movement: { ...COMMON.movement, label: 'Movement (faced)' },
    dashboard: { label: 'Dashboard', keys: L('G PA HR R RBI SB BB% K% ISO BABIP AVG OBP SLG wOBA xwOBA wRC+ BaseRunning Offense Defense RRAA WAR') },
  },
  pit: {
    playerValue: { label: 'Player value', keys: L('WAR RRAA RAR RA9-Wins BIP-Wins LOB-Wins RRAA_wRAA RRAA_Park WPA RE24 Dollars ERA- FIP-'), editable: true },
    realAbility: { label: 'Real ability', keys: L('K-BB% K% BB% SwStr% CSW% C+SwStr% O-Swing% Zone% xFIP SIERA xERA sc_xwOBA RRAA_wOBA GB% Barrel% HardHit% EV FBv sp_stuff sp_location sp_pitching pb_overall'), editable: true },
    standard: { label: 'Standard', keys: L('W L ERA G GS CG ShO SV HLD BS IP TBF H R ER HR BB IBB HBP WP BK SO') },
    advanced: { label: 'Advanced', keys: L('K/9 BB/9 K/BB HR/9 K% BB% K-BB% AVG WHIP BABIP LOB% ERA- FIP- xFIP- ERA FIP E-F xFIP SIERA tERA xERA kwERA K/9+ BB/9+ K/BB+ H/9+ HR/9+ AVG+ WHIP+ BABIP+ LOB%+') },
    statcast: COMMON.statcast, battedBall: COMMON.battedBall, discipline: COMMON.discipline,
    arsenal: COMMON.arsenal, swingTake: COMMON.swingTake, bbProfile: COMMON.bbProfile, expected: COMMON.expected,
    stuff: { label: 'Stuff+ & PitchingBot', keys: L('sp_stuff sp_location sp_pitching pb_stuff pb_command pb_overall pb_ERA pb_xRV100'), match: /^(sp_|pb_)/ },
    pitchType: COMMON.pitchType, velocity: COMMON.velocity, movement: COMMON.movement, pitchValues: COMMON.pitchValues,
    value: { label: 'Value', keys: L('WAR RAR Dollars RA9-Wins BIP-Wins LOB-Wins BS-Wins Relief-IP Start-IP Starting Relieving Age') },
    rraa: { label: 'RRAA', keys: L('RRAA RRAA_wRAA RRAA_Park RRAA_wOBA lg_wOBA RRAA_PA TBF IP WAR') },
    plus: COMMON.plus, winProb: COMMON.winProb,
    dashboard: { label: 'Dashboard', keys: L('W L SV G GS IP K/9 BB/9 HR/9 BABIP LOB% GB% HR/FB FBv ERA xERA FIP xFIP RRAA WAR') },
  },
};
SECTIONS.bat.all = SECTIONS.pit.all = { label: 'All stats', keys: [], all: true };

export const sectionIds = (role) => Object.keys(SECTIONS[role]);
export const sectionLabel = (role, id) => SECTIONS[role][id]?.label || id;

/** Keys of a section that exist in `available` (a Set / array of every key in the data). */
export function sectionKeys(role, id, available) {
  const sec = SECTIONS[role][id];
  const have = available instanceof Set ? available : new Set(available);
  if (!sec) return [];
  if (sec.all) return [...have].sort((a, b) => a.localeCompare(b));
  const out = sec.keys.filter((k) => have.has(k));
  if (sec.match) for (const k of [...have].sort()) if (sec.match.test(k) && !out.includes(k) && k !== '-WPA' && k !== '+WPA') out.push(k);
  return out;
}
