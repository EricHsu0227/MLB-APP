import { useEffect } from 'react';
import { DEFAULT_UI, THEMES, applyUI, resolveTheme } from '../lib/themes.js';
import { usePref } from '../lib/data.js';
import { Seg } from './ui.jsx';

const themeVar = (ui, k) => resolveTheme(ui.theme || DEFAULT_UI.theme).v[k] || '#888888';

export function useAppearance() {
  const [ui, setUi] = usePref('ui3', DEFAULT_UI);
  useEffect(() => { applyUI(ui); }, [ui]);
  useEffect(() => { // re-resolve "auto" if the OS theme flips
    if (ui.theme !== 'auto' && ui.theme) return undefined;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const f = () => applyUI(ui); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f);
  }, [ui]);
  return [{ ...DEFAULT_UI, ...ui }, setUi];
}

/** Appearance settings, shown on the Settings page. */
export default function AppearanceSettings() {
  const [ui, setUi] = useAppearance();
  const set = (patch) => setUi({ ...ui, ...patch });
  const theme = resolveTheme(ui.theme).id;
  return (
    <div className="form">
      <label>Theme <Seg small value={ui.theme === 'auto' ? 'auto' : theme} onChange={(v) => set({ theme: v })} options={[...THEMES.map((t) => [t.id, t.label]), ['auto', 'Match device']]} /></label>
      <label>Main color <span className="row"><input type="color" value={ui.accent || themeVar(ui, '--accent')} onChange={(e) => set({ accent: e.target.value })} /><button type="button" className="btn sm" onClick={() => set({ accent: '' })}>Default</button></span></label>
      <label>Second color <span className="row"><input type="color" value={ui.accent2 || themeVar(ui, '--c2')} onChange={(e) => set({ accent2: e.target.value })} /><button type="button" className="btn sm" onClick={() => set({ accent2: '' })}>Default</button></span></label>
      <label>Text size <Seg small value={ui.fontSize || 14} onChange={(v) => set({ fontSize: v })} options={[[13, 'Small'], [14, 'Normal'], [16, 'Large']]} /></label>
      <label>Team color on player pages <input type="checkbox" role="switch" checked={ui.teamColors !== false} onChange={(e) => set({ teamColors: e.target.checked })} /></label>
    </div>
  );
}
