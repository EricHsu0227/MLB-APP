import test from 'node:test';
import assert from 'node:assert/strict';
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
