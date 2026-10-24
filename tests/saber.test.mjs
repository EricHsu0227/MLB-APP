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

import { ipToOuts, outsToIp, gameScore, sumHitting, sumPitching } from '../src/lib/saber.js';
test('innings notation and game score', () => {
  assert.equal(ipToOuts('6.1'), 19); assert.equal(outsToIp(19), '6.1'); assert.equal(ipToOuts(undefined), 0);
  // 7 IP, 5 H, 2 R/2 ER, 1 BB, 8 K: 50 + 21 + 2*3 + 8 - 10 - 8 - 0 - 1 = 66
  assert.equal(gameScore({ inningsPitched: '7.0', hits: 5, runs: 2, earnedRuns: 2, baseOnBalls: 1, strikeOuts: 8 }), 66);
});
test('sumHitting and sumPitching compute rates from counting stats', () => {
  const h = sumHitting([{ plateAppearances: 5, atBats: 4, hits: 2, doubles: 1, baseOnBalls: 1, strikeOuts: 1 }, { plateAppearances: 4, atBats: 4, hits: 1, homeRuns: 1 }]);
  assert.equal(h.ab, 8); assert.equal(h.h, 3); assert.ok(Math.abs(h.avg - 0.375) < 1e-9);
  assert.ok(Math.abs(h.slg - (3 + 1 + 3) / 8) < 1e-9); assert.ok(Math.abs(h.obp - 4 / 9) < 1e-9);
  const p = sumPitching([{ inningsPitched: '6.1', earnedRuns: 2, hits: 5, baseOnBalls: 1, strikeOuts: 7 }, { inningsPitched: '5.2', earnedRuns: 1 }]);
  assert.equal(p.outs, 36); assert.equal(p.ip, '12.0'); assert.ok(Math.abs(p.era - 2.25) < 1e-9);
});
