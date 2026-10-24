// Pure sabermetric helpers (tested in tests/saber.test.mjs).

/** Pythagenpat expected win% from runs scored/allowed over g games. */
export function pythag(rs, ra, g) {
  if (!(rs > 0) || !(ra > 0) || !(g > 0)) return null;
  const e = Math.pow((rs + ra) / g, 0.287);
  return Math.pow(rs, e) / (Math.pow(rs, e) + Math.pow(ra, e));
}

/** Shrink a split rate toward a prior (e.g. the player's own overall rate) by pa/(pa+k). */
export const regress = (split, pa, prior, k = 220) => (typeof split !== 'number' || !(pa > 0) ? prior : (split * pa + prior * k) / (pa + k));

/**
 * Pick the best nine hitters against one handedness.
 * players: [{ id, name, all: {wOBA, PA}, vs: {wOBA, PA} }]; score = split wOBA regressed to the player's overall wOBA.
 * `blocked` ids are skipped; `minPA` filters out part-timers on the overall line.
 */
export function bestLineup(players, { blocked = new Set(), minPA = 50, n = 9, k = 220 } = {}) {
  return players
    .filter((p) => !blocked.has(p.id) && (p.all?.PA ?? 0) >= minPA && typeof p.all?.wOBA === 'number')
    .map((p) => ({ ...p, score: regress(p.vs?.wOBA, p.vs?.PA, p.all.wOBA, k) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/** Order a lineup: best OBP-ish hitters first. Simple heuristic (not a simulation): 1,2,4,3,5,6... by score. */
export function battingOrder(nine) {
  const s = [...nine].sort((a, b) => b.score - a.score);
  const slots = [1, 3, 0, 2, 4, 5, 6, 7, 8]; // spot -> index in score order: #1 hitter bats 2nd, etc.
  return slots.map((i) => s[i]).filter(Boolean);
}

/** "6.1" innings notation -> outs. */
export function ipToOuts(ip) {
  if (ip == null) return 0;
  const [w, f = '0'] = String(ip).split('.');
  return (+w || 0) * 3 + (+f || 0);
}
export const outsToIp = (o) => `${Math.floor(o / 3)}.${o % 3}`;

/** Bill James Game Score for a pitching line (MLB API field names). */
export function gameScore(s) {
  const outs = ipToOuts(s.inningsPitched);
  const inningsAfter4 = Math.max(0, Math.floor((outs - 12) / 3));
  const er = s.earnedRuns || 0;
  return 50 + outs + 2 * inningsAfter4 + (s.strikeOuts || 0) - 2 * (s.hits || 0) - 4 * er - 2 * ((s.runs || 0) - er) - (s.baseOnBalls || 0);
}

const n = (v) => +v || 0;
/** Sum hitting counting stats over game lines. */
export function sumHitting(lines) {
  const t = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, ibb: 0, hbp: 0, sf: 0, so: 0, sb: 0, cs: 0 };
  for (const s of lines) { t.pa += n(s.plateAppearances); t.ab += n(s.atBats); t.h += n(s.hits); t.d += n(s.doubles); t.t += n(s.triples); t.hr += n(s.homeRuns); t.r += n(s.runs); t.rbi += n(s.rbi); t.bb += n(s.baseOnBalls); t.hbp += n(s.hitByPitch); t.sf += n(s.sacFlies); t.so += n(s.strikeOuts); t.sb += n(s.stolenBases); t.cs += n(s.caughtStealing); }
  const tb = t.h + t.d + 2 * t.t + 3 * t.hr;
  const obpDen = t.ab + t.bb + t.hbp + t.sf;
  t.avg = t.ab ? t.h / t.ab : null; t.obp = obpDen ? (t.h + t.bb + t.hbp) / obpDen : null; t.slg = t.ab ? tb / t.ab : null;
  t.ops = t.obp != null && t.slg != null ? t.obp + t.slg : null;
  return t;
}
/** Sum pitching counting stats over game lines. */
export function sumPitching(lines) {
  const t = { outs: 0, h: 0, r: 0, er: 0, hr: 0, bb: 0, so: 0, g: 0, gs: 0, w: 0, l: 0, sv: 0, np: 0 };
  for (const s of lines) { t.outs += ipToOuts(s.inningsPitched); t.h += n(s.hits); t.r += n(s.runs); t.er += n(s.earnedRuns); t.hr += n(s.homeRuns); t.bb += n(s.baseOnBalls); t.so += n(s.strikeOuts); t.g++; t.gs += n(s.gamesStarted); t.w += n(s.wins); t.l += n(s.losses); t.sv += n(s.saves); t.np += n(s.numberOfPitches); }
  t.ip = outsToIp(t.outs);
  t.era = t.outs ? (t.er * 27) / t.outs : null; t.whip = t.outs ? ((t.h + t.bb) * 3) / t.outs : null; t.k9 = t.outs ? (t.so * 27) / t.outs : null;
  return t;
}
