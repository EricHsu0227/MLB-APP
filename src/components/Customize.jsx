import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePref } from '../lib/data.js';

/*
 * Page customizer. Any table tagged data-cust="<key>" (optionally data-title and data-hide="A,B" for
 * columns hidden by default) gets a column picker here. The choice is stored per table key and applied
 * as generated CSS, so tables don't each need their own plumbing.
 */
const headers = (t) => [...(t.tHead?.rows?.[0]?.cells || [])].map((c) => c.textContent.trim());
const tables = () => {
  const seen = new Map();
  for (const t of document.querySelectorAll('table[data-cust]')) if (!seen.has(t.dataset.cust)) seen.set(t.dataset.cust, t);
  return [...seen.values()];
};
const hiddenFor = (prefs, t) => prefs[t.dataset.cust] || (t.dataset.hide ? t.dataset.hide.split(',') : []);

/** Keeps a <style> in step with the saved choices; mount once. */
export function useColumnCss() {
  const [prefs] = usePref('cols:hidden', {});
  const loc = useLocation();
  useEffect(() => {
    let el = document.getElementById('cust-css');
    if (!el) { el = document.createElement('style'); el.id = 'cust-css'; document.head.appendChild(el); }
    let raf = 0;
    const apply = () => {
      const rules = [];
      for (const t of document.querySelectorAll('table[data-cust]')) {
        const hs = headers(t); const hide = hiddenFor(prefs, t);
        hs.forEach((h, i) => { if (i > 0 && hide.includes(h)) rules.push(`table[data-cust="${t.dataset.cust}"] tr > :nth-child(${i + 1}){display:none}`); });
      }
      const css = [...new Set(rules)].join('\n');
      if (el.textContent !== css) el.textContent = css;
    };
    const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); };
    const mo = new MutationObserver(kick);
    mo.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    kick();
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, [prefs, loc.pathname]);
}

export function CustomizePanel() {
  const [prefs, setPrefs] = usePref('cols:hidden', {});
  const loc = useLocation();
  const [list, setList] = useState([]);
  useEffect(() => {
    const scan = () => setList(tables().map((t) => ({ key: t.dataset.cust, title: t.dataset.title || t.dataset.cust, cols: headers(t).slice(1).filter(Boolean), def: t.dataset.hide ? t.dataset.hide.split(',') : [] })));
    scan(); const id = setInterval(scan, 1500); // tables can appear after data loads
    return () => clearInterval(id);
  }, [loc.pathname]);
  if (!list.length) return <div className="muted small">Nothing on this page has customizable columns. Player pages have their own “Customize page” button.</div>;
  const toggle = (k, col, def) => setPrefs((p) => { const cur = p[k] || def; const nx = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col]; return { ...p, [k]: nx }; });
  const reset = (k) => setPrefs((p) => { const { [k]: _, ...rest } = p; return rest; });
  return (
    <div className="cust">
      {list.map((t) => { const hide = prefs[t.key] || t.def; return (
        <div key={t.key} className="cust-t">
          <div className="row between"><b>{t.title}</b><span className="row"><button type="button" className="btn sm" onClick={() => setPrefs((p) => ({ ...p, [t.key]: [] }))}>All</button><button type="button" className="btn sm" onClick={() => reset(t.key)}>Default</button></span></div>
          <div className="chips">{t.cols.map((c) => <label key={c} className={'chip' + (hide.includes(c) ? '' : ' on')}><input type="checkbox" checked={!hide.includes(c)} onChange={() => toggle(t.key, c, t.def)} />{c}</label>)}</div>
        </div>); })}
    </div>
  );
}
