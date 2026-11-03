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
