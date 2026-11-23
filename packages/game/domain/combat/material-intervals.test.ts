import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MATERIAL_ENTER_EVENT_PRIORITY,
  MATERIAL_EXIT_EVENT_PRIORITY,
  MATERIAL_INTERVAL_TOUCH_TOLERANCE,
  materialSpanEvents,
  mergeMaterialIntervals,
} from './material-intervals.ts';
import type { MaterialInterval } from './material-intervals.ts';

const spansOf = (intervals: readonly MaterialInterval[]) =>
  mergeMaterialIntervals(intervals).map(({ entry, exit }) => ({ entry, exit }));

void test('intervals that do not overlap stay separate spans', () => {
  assert.deepEqual(
    spansOf([
      { entry: 0.1, exit: 0.2 },
      { entry: 0.4, exit: 0.5 },
      { entry: 0.7, exit: 0.9 },
    ]),
    [
      { entry: 0.1, exit: 0.2 },
      { entry: 0.4, exit: 0.5 },
      { entry: 0.7, exit: 0.9 },
    ],
  );
});

void test('overlapping intervals merge into one span that reaches the furthest exit', () => {
  assert.deepEqual(
    spansOf([
      { entry: 0.1, exit: 0.8 },
      { entry: 0.2, exit: 0.5 },
    ]),
    [{ entry: 0.1, exit: 0.8 }],
  );
  assert.deepEqual(
    spansOf([
      { entry: 0.1, exit: 0.4 },
      { entry: 0.3, exit: 0.55 },
      { entry: 0.5, exit: 0.6 },
    ]),
    [{ entry: 0.1, exit: 0.6 }],
  );
});

void test('intervals that only touch merge', () => {
  assert.equal(MATERIAL_INTERVAL_TOUCH_TOLERANCE, 1e-10);
  assert.deepEqual(
    spansOf([
      { entry: 0.2, exit: 0.4 },
      { entry: 0.4, exit: 0.6 },
    ]),
    [{ entry: 0.2, exit: 0.6 }],
  );
});

void test('intervals within the touch tolerance merge and a wider gap does not', () => {
  assert.deepEqual(
    spansOf([
      { entry: 0.2, exit: 0.4 },
      { entry: 0.4 + 1e-11, exit: 0.6 },
    ]),
    [{ entry: 0.2, exit: 0.6 }],
  );
  assert.deepEqual(
    spansOf([
      { entry: 0.2, exit: 0.4 },
      { entry: 0.4 + 1e-9, exit: 0.6 },
    ]),
    [
      { entry: 0.2, exit: 0.4 },
      { entry: 0.40000000100000005, exit: 0.6 },
    ],
  );
});

void test('the merged spans keep the order of their entry', () => {
  assert.deepEqual(
    spansOf([
      { entry: 0.6, exit: 0.7 },
      { entry: 0.1, exit: 0.2 },
      { entry: 0.3, exit: 0.35 },
    ]),
    [
      { entry: 0.1, exit: 0.2 },
      { entry: 0.3, exit: 0.35 },
      { entry: 0.6, exit: 0.7 },
    ],
  );
});

void test('a merged span keeps the payload of the interval that opened it', () => {
  const [span] = mergeMaterialIntervals([
    { entry: 0.2, exit: 0.3, cell: { x: 1, y: 2 }, volume: { id: 'wall' } },
    { entry: 0.25, exit: 0.45, cell: { x: 2, y: 2 }, volume: { id: 'wall' } },
  ]);
  assert.deepEqual(span, {
    entry: 0.2,
    exit: 0.45,
    cell: { x: 1, y: 2 },
    volume: { id: 'wall' },
  });
});

void test('each span produces the entering and the leaving event in the same order', () => {
  assert.equal(MATERIAL_ENTER_EVENT_PRIORITY, 2);
  assert.equal(MATERIAL_EXIT_EVENT_PRIORITY, 4);
  assert.deepEqual(
    materialSpanEvents(
      'wall',
      mergeMaterialIntervals([
        { entry: 0.1, exit: 0.2 },
        { entry: 0.4, exit: 0.5 },
      ]),
    ),
    [
      { fraction: 0.1, priority: 2, key: 'wall', type: 'enter', span: { entry: 0.1, exit: 0.2 } },
      { fraction: 0.2, priority: 4, key: 'wall', type: 'exit', span: { entry: 0.1, exit: 0.2 } },
      { fraction: 0.4, priority: 2, key: 'wall', type: 'enter', span: { entry: 0.4, exit: 0.5 } },
      { fraction: 0.5, priority: 4, key: 'wall', type: 'exit', span: { entry: 0.4, exit: 0.5 } },
    ],
  );
});

void test('the entering and leaving events of one span share that span', () => {
  const spans = mergeMaterialIntervals([{ entry: 0.1, exit: 0.2 }]),
    events = materialSpanEvents('wall', spans);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.span, spans[0]);
  assert.equal(events[1]?.span, spans[0]);
});
