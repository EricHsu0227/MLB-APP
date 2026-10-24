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

/** Pearson r and least-squares line for [{x,y}] points. */
export function fitLine(pts) {
  const n = pts.length; if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
  if (!sxx || !syy) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r: sxy / Math.sqrt(sxx * syy) };
}

/**
 * Delta-method aging curve. rows: [{id, season, age, v}] (already filtered to qualified seasons).
 * Returns [{age, n, delta}] where delta is the mean change in v from `age` to `age + 1`
 * across players with consecutive qualifying seasons.
 */
export function agingDeltas(rows, minN = 8) {
  const by = new Map();
  for (const r of rows) { if (typeof r.v !== 'number' || typeof r.age !== 'number') continue; by.set(`${r.id}:${r.season}`, r); }
  const acc = new Map();
  for (const r of by.values()) {
    const nx = by.get(`${r.id}:${r.season + 1}`); if (!nx) continue;
    const a = acc.get(r.age) || { n: 0, sum: 0 }; a.n++; a.sum += nx.v - r.v; acc.set(r.age, a);
  }
  return [...acc.entries()].filter(([, a]) => a.n >= minN).map(([age, a]) => ({ age, n: a.n, delta: a.sum / a.n })).sort((x, y) => x.age - y.age);
}

/** Running total of deltas, starting at 0 on the first age. Returns [{age, v}]. */
export function cumulative(deltas) {
  let t = 0; const out = [];
  for (const d of deltas) { out.push({ age: d.age, v: t }); t += d.delta; }
  if (deltas.length) out.push({ age: deltas.at(-1).age + 1, v: t });
  return out;
}

/** z-score columns for a pool of rows over keys; returns {mean, sd} per key. */
export function zStats(pool, keys) {
  const out = {};
  for (const k of keys) {
    const xs = pool.map((r) => r[k]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (xs.length < 5) continue;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    if (sd > 0) out[k] = { m, sd };
  }
  return out;
}

/** Distance between two rows over the z-stats keys they both have; null if fewer than 3 shared. */
export function zDistance(a, b, z) {
  let s = 0, n = 0;
  for (const k of Object.keys(z)) {
    if (typeof a[k] !== 'number' || typeof b[k] !== 'number') continue;
    s += ((a[k] - b[k]) / z[k].sd) ** 2; n++;
  }
  return n < 3 ? null : Math.sqrt(s / n);
}
/** 0-100 similarity from a z distance (0 = identical). */
export const similarity = (d) => (d == null ? null : Math.max(0, Math.round(100 - 30 * d)));
