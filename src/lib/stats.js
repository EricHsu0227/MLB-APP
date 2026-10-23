// Pure helpers (tested in tests/stats.test.mjs).
export function percentile(values, v, lowGood = false) {
  const xs = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (typeof v !== 'number' || xs.length < 2) return null;
  let below = 0, equal = 0;
  for (const x of xs) { if (x < v) below++; else if (x === v) equal++; }
  let p = ((below + 0.5 * Math.max(equal - 1, 0)) / (xs.length - 1)) * 100;
  p = Math.max(0, Math.min(100, p));
  return Math.round(lowGood ? 100 - p : p);
}

/** Pool of peers for percentile / leaderboard filtering. */
export function peerPool(rows, split, { minPA = 0, minIP = 0, team = null } = {}) {
  return rows.filter((r) => {
    const s = r.splits[split];
    if (!s) return false;
    if (team && r.team !== team) return false;
    const pa = s.PA ?? s.sc_PA ?? 0;
    const ip = s.IP ?? 0;
    return pa >= minPA && ip >= minIP;
  });
}

export function sortRows(rows, split, key, dir = -1) {
  const val = (r) => r.splits[split]?.[key];
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir;
  });
}

export function toCSV(rows, split, keys) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Team', ...keys].map(esc).join(',');
  return [head, ...rows.map((r) => [r.name, r.team, ...keys.map((k) => r.splits[split]?.[k] ?? '')].map(esc).join(','))].join('\n');
}
