import { useEffect, useState } from 'react';
import { DEFAULT_UI, FONTS, THEMES, applyUI } from '../lib/themes.js';
import { usePref } from '../lib/data.js';

export function useAppearance() {
  const [ui, setUi] = usePref('ui2', DEFAULT_UI);
  useEffect(() => { applyUI(ui); }, [ui]);
  useEffect(() => { // re-resolve "auto" if the OS theme flips
    if (ui.theme !== 'auto' && ui.theme) return undefined;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const f = () => applyUI(ui); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f);
  }, [ui]);
  return [{ ...DEFAULT_UI, ...ui }, setUi];
}

export default function Appearance({ ui, setUi }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => setUi({ ...ui, ...patch });
  return (
    <div className="appearance">
      <button type="button" className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>🎨 Theme</button>
      {open && (
        <div className="pop panel" role="dialog" aria-label="Appearance">
          <div className="pop-h"><b>Appearance</b><button type="button" className="btn sm" onClick={() => setOpen(false)}>✕</button></div>
          <div className="themes">
            <button type="button" className={'theme-card' + (ui.theme === 'auto' ? ' on' : '')} onClick={() => set({ theme: 'auto' })}><span className="sw auto" />Auto</button>
            {THEMES.map((t) => (
              <button type="button" key={t.id} className={'theme-card' + (ui.theme === t.id ? ' on' : '')} onClick={() => set({ theme: t.id })}>
                <span className="sw" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`, boxShadow: `inset 0 0 0 3px ${t.swatch[2]}33` }} />{t.label}
              </button>))}
          </div>
          <div className="form">
            <label>Accent <span className="row"><input type="color" value={ui.accent || '#2563eb'} onChange={(e) => set({ accent: e.target.value })} /><button type="button" className="btn sm" onClick={() => set({ accent: '' })}>Theme</button></span></label>
            <label>Corners <input type="range" min="-1" max="22" value={ui.radius} onChange={(e) => set({ radius: +e.target.value })} /></label>
            <label>Text size <input type="range" min="12" max="18" value={ui.fontSize} onChange={(e) => set({ fontSize: +e.target.value })} /></label>
            <label>Font <select value={ui.font} onChange={(e) => set({ font: e.target.value })}>{FONTS.map(([n, v]) => <option key={n} value={v}>{n}</option>)}</select></label>
            <label>Density <select value={ui.density} onChange={(e) => set({ density: e.target.value })}><option value="compact">Compact</option><option value="cozy">Cozy</option><option value="roomy">Roomy</option></select></label>
            <label>Cards <select value={ui.cards} onChange={(e) => set({ cards: e.target.value })}><option value="default">Default</option><option value="flat">Flat</option><option value="outline">Outlined</option><option value="raised">Raised</option></select></label>
          </div>
          <button type="button" className="btn sm" onClick={() => setUi(DEFAULT_UI)}>Reset appearance</button>
        </div>)}
    </div>
  );
}
