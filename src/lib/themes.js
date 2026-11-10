// Themes are plain CSS-variable sets. p0/p50/p100 are the percentile scale (low / middle / high);
// c1..c6 are chart series colors.
const sans = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const C = (a, b, c, d, e, f) => ({ '--c1': a, '--c2': b, '--c3': c, '--c4': d, '--c5': e, '--c6': f });
const base = { '--font': sans, '--head-font': sans, '--radius': '3px', '--shadow': 'none', '--accent-fg': '#fff' };

// Three plain themes, in the spirit of FanGraphs / Baseball Savant: flat panels, thin rules, no gradients.
// Percentile colors follow Savant (blue = poor, gray = average, red = great).
const SAVANT = { '--p0': '#3661ad', '--p100': '#d82129' };
export const THEMES = [
  { id: 'black', label: 'Black', dark: true, swatch: ['#000000', '#f5b700'], v: { ...base, ...SAVANT,
    '--bg': '#000000', '--fg': '#ececec', '--muted': '#8f8f96', '--panel': '#0b0b0c', '--panel2': '#151517', '--line': '#26262a', '--head': '#141416',
    '--accent': '#f5b700', '--accent-fg': '#111', '--nav': '#000', '--nav-fg': '#ececec', '--p50': '#3a3a40', '--p0': '#4a7fd6', '--p100': '#e0383f',
    ...C('#f5b700', '#e0383f', '#4a7fd6', '#3fbf6b', '#a78bfa', '#22c3d6') } },
  { id: 'dark', label: 'Dark', dark: true, swatch: ['#111820', '#5aa0ff'], v: { ...base, ...SAVANT,
    '--bg': '#0f141b', '--fg': '#e3e7ec', '--muted': '#8b96a5', '--panel': '#141b24', '--panel2': '#1a222d', '--line': '#273241', '--head': '#18202a',
    '--accent': '#5aa0ff', '--accent-fg': '#06121f', '--nav': '#0a0f15', '--nav-fg': '#e3e7ec', '--p50': '#3b4554', '--p0': '#4a7fd6', '--p100': '#e0383f',
    ...C('#5aa0ff', '#e0383f', '#3fbf6b', '#f2b134', '#a78bfa', '#22c3d6') } },
  { id: 'light', label: 'Light', dark: false, swatch: ['#ffffff', '#1d5d90'], v: { ...base, ...SAVANT,
    '--bg': '#ffffff', '--fg': '#1c1f23', '--muted': '#6a7380', '--panel': '#ffffff', '--panel2': '#f4f6f8', '--line': '#dfe3e8', '--head': '#eef1f4',
    '--accent': '#1d5d90', '--accent-fg': '#fff', '--nav': '#1c2b39', '--nav-fg': '#ffffff', '--p50': '#dcdfe3',
    ...C('#1d5d90', '#d82129', '#2f8f46', '#d98e04', '#6b4fbb', '#0f8a9c') } },
];
// Older saved theme ids map onto the closest of the three.
const OLD = { savant: 'dark', midnight: 'dark', slate: 'dark', blueprint: 'dark', ballpark: 'dark', terminal: 'black', fangraphs: 'light', sunset: 'light', paper: 'light', contrast: 'light' };

export const DEFAULT_UI = { theme: 'black', accent: '', accent2: '', fontSize: 14 };

const prefersDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
export function resolveTheme(id) {
  id = OLD[id] || id;
  if (id === 'auto' || !THEMES.some((t) => t.id === id)) return THEMES.find((t) => t.id === (prefersDark() ? 'dark' : 'light'));
  return THEMES.find((t) => t.id === id);
}
/** Black or white text, whichever reads better on a hex color. */
export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
  const n = parseInt(m[1], 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#111' : '#fff';
}

export function applyUI(ui) {
  const u = { ...DEFAULT_UI, ...ui };
  const t = resolveTheme(u.theme);
  const r = document.documentElement;
  const vars = { ...t.v };
  if (u.accent) { vars['--accent'] = u.accent; vars['--c1'] = u.accent; vars['--accent-fg'] = textOn(u.accent); }
  if (u.accent2) vars['--c2'] = u.accent2;
  vars['--fs'] = (u.fontSize || 14) + 'px';
  for (const [k, v] of Object.entries(vars)) r.style.setProperty(k, v);
  r.dataset.theme = t.id; r.style.colorScheme = t.dark ? 'dark' : 'light';
}

/** Percentile (0-100) -> color along the theme's p0 -> p50 -> p100 scale. */
export const pctColor = (p) => (p < 50
  ? `color-mix(in srgb, var(--p0) ${Math.round((50 - p) * 2)}%, var(--p50))`
  : `color-mix(in srgb, var(--p100) ${Math.round((p - 50) * 2)}%, var(--p50))`);

/** Cell background for a 0-100 score; undefined when there is no score. */
export const tint = (p, amt = 34) => (p == null ? undefined : { background: `color-mix(in srgb, ${pctColor(p)} ${amt}%, transparent)` });

/** Leaderboard cell shading for a 0-100 percentile: light tint, stronger toward the ends (Savant style). */
export const shadeStyle = (p) => (p == null || Math.abs(p - 50) < 10 ? undefined : { background: `color-mix(in srgb, ${p > 50 ? 'var(--p100)' : 'var(--p0)'} ${Math.round(Math.abs(p - 50) * 0.5)}%, transparent)` });
