import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteQueue } from './route-queue.ts';

type Cell = { id: string; cost: number };

function drain(queue: RouteQueue<Cell>): Cell[] {
  const cells: Cell[] = [];
  for (let cell = queue.shift(); cell; cell = queue.shift()) {
    cells.push(cell);
  }
  return cells;
}

void test('the cheapest cell comes out first', () => {
  const queue = new RouteQueue<Cell>();
  queue.push({ id: 'five', cost: 5 });
  queue.push({ id: 'one', cost: 1 });
  queue.push({ id: 'three', cost: 3 });

  assert.deepEqual(drain(queue), [
    { id: 'one', cost: 1 },
    { id: 'three', cost: 3 },
    { id: 'five', cost: 5 },
  ]);
});

void test('equal-cost cells keep the order they were pushed in', () => {
  const queue = new RouteQueue<Cell>();
  queue.push({ id: 'three', cost: 4 });
  queue.push({ id: 'two', cost: 4 });
  queue.push({ id: 'one', cost: 4 });

  assert.deepEqual(drain(queue), [
    { id: 'three', cost: 4 },
    { id: 'two', cost: 4 },
    { id: 'one', cost: 4 },
  ]);
});

void test('a cell pushed later with a lower cost comes out first', () => {
  const queue = new RouteQueue<Cell>();
  queue.push({ id: 'ten', cost: 10 });
  queue.push({ id: 'twenty', cost: 20 });
  queue.push({ id: 'five', cost: 5 });

  assert.deepEqual(drain(queue), [
    { id: 'five', cost: 5 },
    { id: 'ten', cost: 10 },
    { id: 'twenty', cost: 20 },
  ]);
});

void test('the queue reports its length before and after the cells are taken', () => {
  const queue = new RouteQueue<Cell>();
  queue.push({ id: 'x', cost: 1 });
  queue.push({ id: 'y', cost: 2 });
  queue.push({ id: 'z', cost: 3 });
  assert.equal(queue.length, 3);

  assert.deepEqual(queue.shift(), { id: 'x', cost: 1 });
  assert.equal(queue.length, 2);
  assert.deepEqual(queue.shift(), { id: 'y', cost: 2 });
  assert.equal(queue.length, 1);
  assert.deepEqual(queue.shift(), { id: 'z', cost: 3 });
  assert.equal(queue.length, 0);
});

void test('taking from an empty queue yields nothing', () => {
  const queue = new RouteQueue<Cell>();

  assert.equal(queue.shift(), undefined);
});
