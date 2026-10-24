import test from 'node:test';
import assert from 'node:assert/strict';
import { pythag, regress, bestLineup, battingOrder } from '../src/lib/saber.js';

test('pythag is symmetric and ~.500 for equal runs', () => {
  assert.ok(Math.abs(pythag(700, 700, 162) - 0.5) < 1e-9);
  assert.ok(Math.abs(pythag(800, 700, 162) + pythag(700, 800, 162) - 1) < 1e-9);
  assert.ok(pythag(800, 700, 162) > 0.55);
  assert.equal(pythag(0, 700, 162), null);
});
test('regress shrinks small samples toward the prior', () => {
  assert.equal(regress(0.5, 0, 0.3), 0.3);
  assert.ok(Math.abs(regress(0.5, 220, 0.3) - 0.4) < 1e-9);
  assert.ok(regress(0.5, 2000, 0.3) > 0.47);
});
test('bestLineup uses regressed split, respects blocked and minPA', () => {
  const mk = (id, all, vs, vpa, apa = 400) => ({ id, name: String(id), all: { wOBA: all, PA: apa }, vs: { wOBA: vs, PA: vpa } });
  const ps = [mk(1, 0.32, 0.45, 5), mk(2, 0.33, 0.36, 200), mk(3, 0.31, 0.30, 200), mk(4, 0.30, 0.30, 10, 20)];
  const l = bestLineup(ps, { n: 2 });
  assert.deepEqual(l.map((p) => p.id), [2, 1]); // 1's .450 on 5 PA is mostly regressed away
  assert.deepEqual(bestLineup(ps, { n: 5, blocked: new Set([2]) }).map((p) => p.id), [1, 3]);
  assert.equal(battingOrder(ps.slice(0, 3).map((p) => ({ ...p, score: p.all.wOBA }))).length, 3);
});

import { fitLine, agingDeltas, cumulative, zStats, zDistance, similarity } from '../src/lib/saber.js';
test('fitLine recovers slope and r', () => {
  const f = fitLine([1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x + 1 })));
  assert.ok(Math.abs(f.slope - 2) < 1e-9 && Math.abs(f.r - 1) < 1e-9);
  assert.equal(fitLine([{ x: 1, y: 1 }]), null);
});
test('agingDeltas averages consecutive-season changes by starting age', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) { rows.push({ id: i, season: 2020, age: 25, v: 3 }, { id: i, season: 2021, age: 26, v: 4 }, { id: i, season: 2022, age: 27, v: 4.5 }); }
  const d = agingDeltas(rows, 5);
  assert.deepEqual(d.map((x) => [x.age, x.n, x.delta]), [[25, 10, 1], [26, 10, 0.5]]);
  assert.deepEqual(cumulative(d).map((x) => [x.age, x.v]), [[25, 0], [26, 1], [27, 1.5]]);
  assert.equal(agingDeltas(rows, 11).length, 0);
});
test('similarity: identical rows score 100, far rows score less', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ a: i, b: i * 2, c: (i * 7) % 5 }));
  const z = zStats(pool, ['a', 'b', 'c']);
  assert.equal(similarity(zDistance(pool[3], pool[3], z)), 100);
  assert.ok(similarity(zDistance(pool[3], pool[4], z)) > similarity(zDistance(pool[3], pool[15], z)));
  assert.equal(zDistance({ a: 1 }, { a: 2 }, z), null);
});
