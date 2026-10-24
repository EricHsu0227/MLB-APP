import { useState } from 'react';

/** Error box for live MLB API failures: says what happened, offers Retry and a connection test. */
export default function ApiError({ what, error, retry, inline }) {
  const [test, setTest] = useState('');
  const run = async () => {
    setTest('Testing…');
    try { const r = await fetch('https://statsapi.mlb.com/api/v1/sports'); setTest(r.ok ? 'statsapi.mlb.com is reachable from this browser. Try Retry.' : `statsapi.mlb.com answered ${r.status}.`); }
    catch { setTest("This browser can't reach statsapi.mlb.com. Turn off ad blockers or VPN for this site, or check your network."); }
  };
  return (
    <div className={inline ? 'muted pad' : 'panel'}>
      <div>Couldn’t load {what}. <span className="muted">{String(error?.message || error)}</span></div>
      <div className="row" style={{ marginTop: 8 }}>
        {retry && <button type="button" className="btn sm" onClick={retry}>↻ Retry</button>}
        <button type="button" className="btn sm" onClick={run}>Test connection</button>
        {test && <span className="small">{test}</span>}
      </div>
    </div>
  );
}
