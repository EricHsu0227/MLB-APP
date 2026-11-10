import { useMemo } from 'react';
import { unCalc, usePref } from './data.js';
import { SECTIONS, sectionIds, sectionKeys } from './sections.js';

/** The stats the person cares about most, in priority order. Set in Settings; every page leans toward them. */
export const DEFAULT_FAVS = {
  bat: ['RRAA', 'wRC+', 'wOBA', 'xwOBA', 'AVG', 'OBP', 'SLG', 'K%', 'BB%', 'EV', 'Barrel%', 'HardHit%', 'Spd', 'WAR'],
  pit: ['RRAA', 'ERA', 'FIP', 'xFIP', 'xERA', 'K%', 'BB%', 'K-BB%', 'WHIP', 'GB%', 'SwStr%', 'FBv', 'WAR'],
};
export const useFavs = (role) => { const [v, set] = usePref(`fav:${role}`, DEFAULT_FAVS[role]); return [unCalc(v), set]; };

/** Favorites first (in their priority order), then everything else in its original order. */
export const favFirst = (keys, favs) => { const have = new Set(keys); return [...favs.filter((k) => have.has(k)), ...keys.filter((k) => !favs.includes(k))]; };

/** Section ids ordered by how many favorites each contains (ties keep the default order). */
export function useSectionOrder(role, avail, favs) {
  return useMemo(() => {
    const ids = sectionIds(role).filter((s) => s !== 'all');
    const score = (s) => { const ks = new Set(sectionKeys(role, s, avail)); return favs.reduce((n, k, i) => n + (ks.has(k) ? 1 + (favs.length - i) / 100 : 0), 0); };
    return [...ids].sort((a, b) => score(b) - score(a));
  }, [role, avail, favs]);
}

/** "My stats" groups (Player value, Real ability): editable stat lists shared by Settings, the leaderboard and player pages. */
export const MY_GROUPS = ['playerValue', 'realAbility'];
export function useGroup(role, id) {
  const [edits, setEdits] = usePref(`p3:edits:${role}`, {});
  const keys = unCalc(edits[id] || SECTIONS[role][id]?.keys || []);
  const set = (v) => setEdits({ ...edits, [id]: v });
  const reset = () => { const e = { ...edits }; delete e[id]; setEdits(e); };
  return [keys, set, reset, !!edits[id]];
}
