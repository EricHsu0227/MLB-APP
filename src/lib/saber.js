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
