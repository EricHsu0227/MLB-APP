import test from 'node:test';
import assert from 'node:assert/strict';
import { percentile, peerPool, sortRows, toCSV } from '../src/lib/stats.js';

test('percentile ranks and flips for low-is-good', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(percentile(xs, 5), 100);
  assert.equal(percentile(xs, 1), 0);
  assert.equal(percentile(xs, 3), 50);
  assert.equal(percentile(xs, 5, true), 0);
  assert.equal(percentile(xs, null), null);
});
test('peerPool filters by split, PA and team', () => {
  const rows = [
    { id: 1, team: 'A', splits: { all: { PA: 600 }, vsL: { PA: 150 } } },
    { id: 2, team: 'B', splits: { all: { PA: 100 } } },
  ];
  assert.deepEqual(peerPool(rows, 'all', { minPA: 502 }).map((r) => r.id), [1]);
  assert.deepEqual(peerPool(rows, 'vsL').map((r) => r.id), [1]);
  assert.deepEqual(peerPool(rows, 'all', { team: 'B' }).map((r) => r.id), [2]);
});
test('sortRows puts missing last', () => {
  const rows = [{ splits: { all: { x: 1 } } }, { splits: { all: {} } }, { splits: { all: { x: 3 } } }];
  assert.deepEqual(sortRows(rows, 'all', 'x').map((r) => r.splits.all.x), [3, 1, undefined]);
});
test('toCSV escapes', () => {
  assert.match(toCSV([{ name: 'A "B"', team: 'X', splits: { all: { k: 1 } } }], 'all', ['k']), /"A ""B"""/);
});
