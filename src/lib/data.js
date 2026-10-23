import { useEffect, useState } from 'react';
const cache = new Map();
export function load(path) {
  if (!cache.has(path)) cache.set(path, fetch(`./data/${path}`).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }));
  return cache.get(path);
}
export function useData(path) {
  const [s, set] = useState({ data: null, error: null });
  useEffect(() => { let on = true; set({ data: null, error: null }); if (path) load(path).then((d) => on && set({ data: d, error: null }), (e) => on && set({ data: null, error: e })); return () => { on = false; }; }, [path]);
  return s;
}
/** Persisted UI preference (per-viewer; localStorage may be unavailable). */
export function usePref(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem('mlb:' + key); return s ? JSON.parse(s) : init; } catch { return init; } });
  const set = (n) => setV((o) => { const val = typeof n === 'function' ? n(o) : n; try { localStorage.setItem('mlb:' + key, JSON.stringify(val)); } catch { /* ignore */ } return val; });
  return [v, set];
}
