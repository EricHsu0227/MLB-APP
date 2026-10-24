import { useState } from 'react';
import { Link } from 'react-router-dom';
import { logo, teamByAbbr, teamById } from '../lib/teams.js';

export function TeamLogo({ id, size = 24 }) {
  const [bad, setBad] = useState(false);
  if (bad || !id) return <span className="tlogo" style={{ width: size, height: size, fontSize: size * 0.6 }}>⚾</span>;
  return <img className="tlogo" src={logo(id)} width={size} height={size} alt="" loading="lazy" onError={() => setBad(true)} />;
}
export function TeamLink({ id, abbr, size = 22, full = false, children }) {
  const t = id ? teamById(id) : teamByAbbr(abbr);
  if (!t) return <span>{children || abbr}</span>;
  return <Link to={`/team/${t.abbr}`} className="team-link"><TeamLogo id={t.id} size={size} />{children || (full ? t.name : t.abbr)}</Link>;
}
