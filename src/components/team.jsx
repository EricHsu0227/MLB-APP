import { useState } from 'react';
import { logo } from '../lib/teams.js';

export function TeamLogo({ id, size = 24 }) {
  const [bad, setBad] = useState(false);
  if (bad || !id) return <span className="tlogo" style={{ width: size, height: size, }} />;
  return <img className="tlogo" src={logo(id)} width={size} height={size} alt="" loading="lazy" onError={() => setBad(true)} />;
}
