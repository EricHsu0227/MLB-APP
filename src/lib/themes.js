// Themes are plain CSS-variable sets. p0/p50/p100 are the percentile scale (low / middle / high);
// c1..c6 are chart series colors.
const sans = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const serif = 'Georgia, "Iowan Old Style", serif';
const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const C = (a, b, c, d, e, f) => ({ '--c1': a, '--c2': b, '--c3': c, '--c4': d, '--c5': e, '--c6': f });
const base = { '--font': sans, '--head-font': sans, '--radius': '12px', '--shadow': '0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.06)', '--accent-fg': '#fff' };

export const THEMES = [
  { id: 'light', label: 'Light', dark: false, swatch: ['#ffffff', '#2563eb', '#dc2626'], v: { ...base,
    '--bg': '#f4f6fa', '--bg2': '#eef1f7', '--fg': '#0f172a', '--muted': '#64748b', '--panel': '#ffffff', '--panel2': '#f1f5f9', '--line': '#e2e8f0',
    '--accent': '#2563eb', '--nav': '#ffffffcc', '--p0': '#3b82f6', '--p50': '#e2e8f0', '--p100': '#ef4444', ...C('#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2') } },
  { id: 'dark', label: 'Dark', dark: true, swatch: ['#0f1218', '#60a5fa', '#f87171'], v: { ...base,
    '--bg': '#0b0e14', '--bg2': '#10141c', '--fg': '#e6e9ef', '--muted': '#8b95a7', '--panel': '#141922', '--panel2': '#1a202b', '--line': '#262d3a',
    '--accent': '#60a5fa', '--accent-fg': '#04101f', '--nav': '#0b0e14cc', '--shadow': '0 1px 2px rgba(0,0,0,.4), 0 6px 20px rgba(0,0,0,.35)',
    '--p0': '#3b82f6', '--p50': '#334155', '--p100': '#ef4444', ...C('#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#a78bfa', '#22d3ee') } },
  { id: 'savant', label: 'Savant', dark: true, swatch: ['#0c1a2b', '#d22d49', '#2c6fbb'], v: { ...base,
    '--bg': '#08111c', '--bg2': '#0c1a2b', '--fg': '#f1f5f9', '--muted': '#8da2bb', '--panel': '#102239', '--panel2': '#152a45', '--line': '#1f3856',
    '--accent': '#d22d49', '--nav': '#08111ccc', '--radius': '6px', '--shadow': '0 2px 10px rgba(0,0,0,.4)',
    '--p0': '#2c6fbb', '--p50': '#3d4f66', '--p100': '#d22d49', ...C('#d22d49', '#4aa3ff', '#ffd166', '#06d6a0', '#c77dff', '#f78c6b') } },
  { id: 'fangraphs', label: 'FanGraphs', dark: false, swatch: ['#ffffff', '#1c6ea4', '#f0b429'], v: { ...base,
    '--bg': '#eef2f5', '--bg2': '#e5ebf0', '--fg': '#1b2733', '--muted': '#5f7183', '--panel': '#ffffff', '--panel2': '#f3f6f9', '--line': '#d5dde5',
    '--accent': '#1c6ea4', '--nav': '#14425fe6', '--radius': '4px', '--shadow': '0 1px 2px rgba(0,0,0,.08)',
    '--p0': '#5b8def', '--p50': '#e9eef3', '--p100': '#e5484d', ...C('#1c6ea4', '#d9480f', '#2f9e44', '#f0b429', '#7048e8', '#0c8599') } },
  { id: 'midnight', label: 'Midnight', dark: true, swatch: ['#0a0a1f', '#8b5cf6', '#22d3ee'], v: { ...base,
    '--bg': '#07071a', '--bg2': '#0c0c28', '--fg': '#e8e8ff', '--muted': '#8a8ab8', '--panel': '#101034', '--panel2': '#16163f', '--line': '#26265a',
    '--accent': '#8b5cf6', '--nav': '#07071acc', '--shadow': '0 8px 30px rgba(80,60,200,.18)',
    '--p0': '#22d3ee', '--p50': '#33336b', '--p100': '#f472b6', ...C('#8b5cf6', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#60a5fa') } },
  { id: 'ballpark', label: 'Ballpark', dark: true, swatch: ['#0f2a1d', '#f2c14e', '#e4572e'], v: { ...base,
    '--bg': '#0b1f15', '--bg2': '#0f2a1d', '--fg': '#eef6ee', '--muted': '#93b3a0', '--panel': '#133524', '--panel2': '#19412d', '--line': '#24543b',
    '--accent': '#f2c14e', '--accent-fg': '#2a2007', '--nav': '#0b1f15cc', '--p0': '#4ea8de', '--p50': '#2f5a43', '--p100': '#e4572e',
    ...C('#f2c14e', '#e4572e', '#8bd3a0', '#4ea8de', '#d9a5ff', '#ffffff') } },
  { id: 'sunset', label: 'Sunset', dark: false, swatch: ['#fff4ea', '#f97316', '#be185d'], v: { ...base,
    '--bg': '#fff6ee', '--bg2': '#ffe9d6', '--fg': '#3b1d12', '--muted': '#9a6b57', '--panel': '#fffdfb', '--panel2': '#fff1e3', '--line': '#f2d3bb',
    '--accent': '#ea580c', '--nav': '#fff6eecc', '--p0': '#6366f1', '--p50': '#f3dccb', '--p100': '#e11d48',
    ...C('#ea580c', '#be185d', '#0d9488', '#ca8a04', '#7c3aed', '#2563eb') } },
  { id: 'slate', label: 'Slate', dark: true, swatch: ['#1e293b', '#38bdf8', '#fb7185'], v: { ...base,
    '--bg': '#1a2231', '--bg2': '#1e293b', '--fg': '#e2e8f0', '--muted': '#94a3b8', '--panel': '#243247', '--panel2': '#2b3b54', '--line': '#374962',
    '--accent': '#38bdf8', '--accent-fg': '#04202e', '--nav': '#1a2231cc', '--p0': '#38bdf8', '--p50': '#475a75', '--p100': '#fb7185',
    ...C('#38bdf8', '#fb7185', '#a3e635', '#fbbf24', '#c084fc', '#2dd4bf') } },
  { id: 'paper', label: 'Paper', dark: false, swatch: ['#f7f1e3', '#8b4513', '#2f6f4f'], v: { ...base,
    '--bg': '#f2ead7', '--bg2': '#ebe1c9', '--fg': '#2b2118', '--muted': '#7a6a55', '--panel': '#fbf6ea', '--panel2': '#f3ead4', '--line': '#ddd0b3',
    '--accent': '#8b4513', '--nav': '#f2ead7e6', '--font': serif, '--head-font': serif, '--radius': '3px', '--shadow': '0 1px 0 rgba(0,0,0,.08)',
    '--p0': '#3f6f9e', '--p50': '#e6dcc3', '--p100': '#b3402a', ...C('#8b4513', '#2f6f4f', '#3f6f9e', '#b3402a', '#7a4fa0', '#a07a1c') } },
  { id: 'terminal', label: 'Terminal', dark: true, swatch: ['#000000', '#33ff66', '#ffb000'], v: { ...base,
    '--bg': '#030603', '--bg2': '#061006', '--fg': '#c8ffd4', '--muted': '#5fa874', '--panel': '#07130a', '--panel2': '#0a1b0e', '--line': '#14451f',
    '--accent': '#33ff66', '--accent-fg': '#001a07', '--nav': '#030603dd', '--font': mono, '--head-font': mono, '--radius': '0px', '--shadow': 'none',
    '--p0': '#1fa3ff', '--p50': '#123d1b', '--p100': '#ffb000', ...C('#33ff66', '#ffb000', '#1fa3ff', '#ff4d6d', '#d38cff', '#ffffff') } },
  { id: 'blueprint', label: 'Blueprint', dark: true, swatch: ['#0b3d91', '#ffffff', '#ffd23f'], v: { ...base,
    '--bg': '#0a3580', '--bg2': '#0b3d91', '--fg': '#eaf2ff', '--muted': '#9cb8ea', '--panel': '#0e4aa8', '--panel2': '#1155b8', '--line': '#2e72d1',
    '--accent': '#ffd23f', '--accent-fg': '#1d2b00', '--nav': '#0a3580dd', '--radius': '2px', '--shadow': 'none',
    '--p0': '#ffffff', '--p50': '#2a68c4', '--p100': '#ffd23f', ...C('#ffd23f', '#ffffff', '#7ee0ff', '#ff9bd2', '#a8ff8a', '#ffb066') } },
  { id: 'contrast', label: 'High contrast', dark: false, swatch: ['#ffffff', '#000000', '#d00000'], v: { ...base,
    '--bg': '#ffffff', '--bg2': '#f0f0f0', '--fg': '#000000', '--muted': '#333333', '--panel': '#ffffff', '--panel2': '#ededed', '--line': '#000000',
    '--accent': '#0000cc', '--nav': '#ffffff', '--radius': '0px', '--shadow': 'none', '--p0': '#0000cc', '--p50': '#dddddd', '--p100': '#d00000',
    ...C('#0000cc', '#d00000', '#006600', '#b36b00', '#660099', '#007c91') } },
];

export const FONTS = [['Theme default', ''], ['Sans', sans], ['Serif', serif], ['Mono', mono]];
export const DEFAULT_UI = { theme: 'auto', accent: '', radius: -1, font: '', fontSize: 14, density: 'cozy', cards: 'default' };

const prefersDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
export function resolveTheme(id) {
  if (id === 'auto' || !THEMES.some((t) => t.id === id)) return THEMES.find((t) => t.id === (prefersDark() ? 'dark' : 'light'));
  return THEMES.find((t) => t.id === id);
}
const DENSITY = { compact: ['8px', '3px 7px'], cozy: ['14px', '5px 9px'], roomy: ['20px', '8px 12px'] };

export function applyUI(ui) {
  const u = { ...DEFAULT_UI, ...ui };
  const t = resolveTheme(u.theme);
  const r = document.documentElement;
  const vars = { ...t.v };
  if (u.accent) vars['--accent'] = u.accent;
  if (u.radius >= 0) vars['--radius'] = u.radius + 'px';
  if (u.font) { vars['--font'] = u.font; vars['--head-font'] = u.font; }
  vars['--fs'] = u.fontSize + 'px';
  [vars['--gap'], vars['--cell']] = DENSITY[u.density] || DENSITY.cozy;
  for (const [k, v] of Object.entries(vars)) r.style.setProperty(k, v);
  r.dataset.theme = t.id; r.dataset.cards = u.cards; r.style.colorScheme = t.dark ? 'dark' : 'light';
}

/** Percentile (0-100) -> color along the theme's p0 -> p50 -> p100 scale. */
export const pctColor = (p) => (p < 50
  ? `color-mix(in srgb, var(--p0) ${Math.round((50 - p) * 2)}%, var(--p50))`
  : `color-mix(in srgb, var(--p100) ${Math.round((p - 50) * 2)}%, var(--p50))`);

/** Cell background for a 0-100 score; undefined when there is no score. */
export const tint = (p, amt = 34) => (p == null ? undefined : { background: `color-mix(in srgb, ${pctColor(p)} ${amt}%, transparent)` });
