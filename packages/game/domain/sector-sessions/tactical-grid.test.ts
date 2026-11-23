import assert from 'node:assert/strict';
import test from 'node:test';
import { tacticalGridLabel } from './tactical-grid.ts';

// The expected labels were computed from the rule as it stood in
// packages/game/tactical-grid.js before the move.

void test('the first row is A', () => {
  assert.equal(tacticalGridLabel(0, 0), 'A1');
  assert.equal(tacticalGridLabel(4, 0), 'A5');
});

void test('the row after Z is AA', () => {
  assert.equal(tacticalGridLabel(0, 25), 'Z1');
  assert.equal(tacticalGridLabel(0, 26), 'AA1');
});

void test('the row after AA is AB', () => {
  assert.equal(tacticalGridLabel(0, 27), 'AB1');
});

void test('the label carries the column number starting at one', () => {
  assert.equal(tacticalGridLabel(0, 3), 'D1');
  assert.equal(tacticalGridLabel(5, 0), 'A6');
});

void test('the label of a cell at column zero and row zero is A1', () => {
  assert.equal(tacticalGridLabel(0, 0), 'A1');
});
