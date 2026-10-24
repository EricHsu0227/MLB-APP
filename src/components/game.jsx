import { TeamLink } from './team.jsx';

/** Inning-by-inning linescore. ls = MLB linescore object; away/home = {abbr?, name?, id?}. */
export function Linescore({ ls, away, home }) {
  const inns = ls?.innings || [];
  if (!inns.length) return null;
  const n = Math.max(9, inns.length);
  const name = (t) => t?.abbreviation || t?.name || '';
  return (
    <div className="scroll"><table className="t sm linescore"><thead><tr><th className="l" />{Array.from({ length: n }, (_, i) => <th key={i}>{i + 1}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead>
      <tbody>{[['away', away], ['home', home]].map(([s, t]) => <tr key={s}><td className="l"><b>{name(t)}</b></td>{Array.from({ length: n }, (_, i) => <td key={i}>{inns[i]?.[s]?.runs ?? (i < inns.length ? 'X' : '')}</td>)}<td><b>{ls.teams?.[s]?.runs}</b></td><td>{ls.teams?.[s]?.hits}</td><td>{ls.teams?.[s]?.errors}</td></tr>)}</tbody></table></div>
  );
}

/** Tiny base diamond: runners = {first,second,third} truthy when occupied. */
export function Diamond({ runners = {}, outs = 0, size = 34 }) {
  const b = (on, x, y) => <rect x={x - 5} y={y - 5} width="10" height="10" transform={`rotate(45 ${x} ${y})`} className={'base' + (on ? ' on' : '')} />;
  return (
    <span className="diamond" title={`${outs} out`}>
      <svg viewBox="0 0 40 36" width={size} height={size * 0.9}>{b(runners.second, 20, 8)}{b(runners.third, 8, 20)}{b(runners.first, 32, 20)}</svg>
      <span className="outs">{[0, 1, 2].map((i) => <i key={i} className={i < outs ? 'on' : ''} />)}</span>
    </span>
  );
}
export { TeamLink };
