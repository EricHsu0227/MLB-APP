import { useEffect, useState } from 'react';

// Live MLB Stats API (statsapi.mlb.com). Called from the browser; it is not part of the data pipeline.
const BASE = 'https://statsapi.mlb.com/api/v1';
const cache = new Map();

/** Turn a fetch failure into a message a person can act on. */
function explain(e, status) {
  if (status) return status === 404 ? 'MLB API 404 (no data for this request yet)' : status === 429 ? 'MLB API is rate limiting requests (429)' : `MLB API returned ${status}`;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return 'MLB API timed out';
  return "Couldn't reach statsapi.mlb.com (offline, or blocked by an ad blocker, VPN or firewall)";
}
async function getJson(url, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.ok) return await r.json();
      last = new Error(explain(null, r.status)); last.status = r.status;
      if (r.status < 500 && r.status !== 429) throw last; // not worth retrying
    } catch (e) {
      if (e === last) throw e;
      last = new Error(explain(e)); last.network = true;
    } finally { clearTimeout(t); }
    if (i < tries - 1) await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  throw last;
}

export function api(path, ttl = 30000) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const url = path.startsWith('/v1.1') ? `https://statsapi.mlb.com/api${path}` : BASE + path;
  const p = getJson(url);
  cache.set(path, { t: Date.now(), p });
  p.catch(() => cache.delete(path));
  return p;
}

/** Fetch + auto refresh. Returns { data, error, loading, retry }. `refresh` ms; falsy = once. */
export function useApi(path, { refresh = 0, ttl = 30000, pick } = {}) {
  const [st, set] = useState({ data: null, error: null, loading: !!path });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) { set({ data: null, error: null, loading: false }); return undefined; }
    let on = true;
    const go = () => api(path, ttl).then((d) => on && set({ data: pick ? pick(d) : d, error: null, loading: false }), (e) => on && set((s) => ({ ...s, error: e, loading: false })));
    set((s) => ({ ...s, loading: true, error: n ? null : s.error })); go();
    const t = refresh ? setInterval(go, refresh) : null;
    return () => { on = false; if (t) clearInterval(t); };
  }, [path, refresh, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = () => { cache.delete(path); setN((x) => x + 1); };
  return { ...st, retry };
}

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };

export const schedulePath = (date) => `/schedule?sportId=1&date=${date}&hydrate=linescore,probablePitcher,decisions,team`;
export const standingsPath = (season) => `/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`;
export const rosterPath = (teamId) => `/teams/${teamId}/roster?rosterType=active`;
export const teamSchedulePath = (teamId, from, to) => `/schedule?sportId=1&teamId=${teamId}&startDate=${from}&endDate=${to}&hydrate=linescore,team`;
export const boxscorePath = (pk) => `/game/${pk}/boxscore`;
export const feedPath = (pk) => `/v1.1/game/${pk}/feed/live`;
export const winProbPath = (pk) => `/game/${pk}/winProbability`;

/** schedule response -> flat list of games */
export const gamesOf = (d) => (d?.dates || []).flatMap((x) => x.games || []);

/** Short status label for a game row. */
export function gameStatus(g) {
  const s = g.status || {};
  if (s.abstractGameState === 'Final') return { kind: 'final', text: g.linescore?.currentInning && g.linescore.currentInning !== 9 ? `Final/${g.linescore.currentInning}` : 'Final' };
  if (s.abstractGameState === 'Live') return { kind: 'live', text: `${g.linescore?.inningState || ''} ${g.linescore?.currentInningOrdinal || ''}`.trim() || 'Live' };
  if (/postponed|suspended|cancel/i.test(s.detailedState || '')) return { kind: 'ppd', text: s.detailedState };
  return { kind: 'pre', text: g.gameDate ? new Date(g.gameDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : s.detailedState || '' };
}

/** standings response -> Map(teamId -> row) */
export function standingsMap(d) {
  const m = new Map();
  for (const rec of d?.records || []) for (const t of rec.teamRecords || []) {
    const split = (type) => (t.records?.splitRecords || []).find((s) => s.type === type);
    const rec2 = (s) => (s ? `${s.wins}-${s.losses}` : '—');
    m.set(t.team.id, {
      id: t.team.id, w: t.wins, l: t.losses, pct: +t.winningPercentage, gb: t.gamesBack, wcgb: t.wildCardGamesBack, rs: t.runsScored, ra: t.runsAllowed, diff: t.runDifferential,
      streak: t.streak?.streakCode, home: rec2(split('home')), away: rec2(split('away')), l10: rec2(split('lastTen')), divRank: +t.divisionRank, clinch: t.clinchIndicator, g: t.gamesPlayed ?? t.wins + t.losses,
    });
  }
  return m;
}
