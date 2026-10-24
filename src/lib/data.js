import { useEffect, useState } from 'react';
const cache = new Map();
export function load(path) {
  if (!cache.has(path)) {
    const p = fetch(`./data/${path}`).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}
export function useData(path) {
  const [s, set] = useState({ data: null, error: null, loading: !!path });
  useEffect(() => {
    let on = true; set({ data: null, error: null, loading: !!path });
    if (path) load(path).then((d) => on && set({ data: d, error: null, loading: false }), (e) => on && set({ data: null, error: e, loading: false }));
    return () => { on = false; };
  }, [path]);
  return s;
}
export const usePlayerFile = (role, id) => useData(role && id ? `players/${role}/${id}.json` : null);
export const useSeason = (season, role) => useData(season && role ? `${season}/${role}.json` : null);

/** Per-viewer UI preference (localStorage may be unavailable). */
export function usePref(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem('mlb:' + key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { // keep every component using the same key in step
    const on = (e) => { if (e.detail.key === key) setV(e.detail.val); };
    window.addEventListener('mlb-pref', on);
    return () => window.removeEventListener('mlb-pref', on);
  }, [key]);
  const set = (n) => {
    const val = typeof n === 'function' ? n(v) : n;
    try { localStorage.setItem('mlb:' + key, JSON.stringify(val)); } catch { /* ignore */ }
    setV(val);
    window.dispatchEvent(new CustomEvent('mlb-pref', { detail: { key, val } }));
  };
  return [v, set];
}
export const headshot = (id, w = 120) => `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;

/** Every player-season row for a role between two seasons (loads the season files). */
export function useRows(role, from, to, seasons) {
  const [st, set] = useState({ rows: [], loading: true, error: null, loaded: 0, total: 0 });
  useEffect(() => {
    let on = true;
    const ys = seasons.filter((y) => y >= from && y <= to);
    set({ rows: [], loading: true, error: null, loaded: 0, total: ys.length });
    let n = 0;
    Promise.all(ys.map((y) => load(`${y}/${role}.json`).then((d) => { n++; on && set((s) => ({ ...s, loaded: n })); return d.players.map((p) => ({ ...p, season: y })); })))
      .then((parts) => on && set((s) => ({ ...s, rows: parts.flat(), loading: false })), (e) => on && set((s) => ({ ...s, error: e, loading: false })));
    return () => { on = false; };
  }, [role, from, to, seasons]);
  return st;
}
