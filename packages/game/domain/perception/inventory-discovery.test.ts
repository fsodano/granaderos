import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoveryObservers,
  isBodyFound,
  isDroppedWeaponFound,
  isGroundItemFound,
  isOpenChestFound,
} from './inventory-discovery.ts';
import type {
  DiscoveryBody,
  DiscoveryChest,
  DiscoveryDroppedWeapon,
  DiscoveryGroundItem,
  DiscoveryObserver,
  DiscoverySight,
} from './inventory-discovery.ts';

const key = (point: { readonly x: number; readonly y: number }): string => `${point.x},${point.y}`;

// The map as the retained rule reported it before this rule moved: these
// interiors are unknown, and the observers see exactly these cells.
const hiddenInteriors = new Set(['10,2', '11,2', '1,3']);
const watchedCells = new Set([
  '1,2',
  '3,2',
  '4,2',
  '5,2',
  '6,2',
  '7,2',
  '8,2',
  '9,2',
  '3,1',
  '5,1',
]);

const sight: DiscoverySight = {
  interiorVisible: (point) => !hiddenInteriors.has(key(point)),
  observerSees: (_observer, point) => watchedCells.has(key(point)),
};

const observers: readonly DiscoveryObserver[] = [{ side: 'player', hp: 100, x: 0, y: 2 }];

type Named<T> = T & Readonly<{ id: string }>;

const foundIds = <T extends Readonly<{ id: string }>>(
  entries: readonly T[],
  isFound: (entry: T) => boolean,
): readonly string[] => entries.filter(isFound).map((entry) => entry.id);

// The field the current implementation was run on. Each expected list below is
// the set of identifiers it marked knownToPlayer on that same field.
const groundItems: readonly Named<DiscoveryGroundItem>[] = [
  { id: 'ground-found', x: 3, y: 2, count: 1 },
  { id: 'ground-hidden', x: 10, y: 2, count: 1 },
  { id: 'ground-zero', x: 4, y: 2, count: 0 },
  { id: 'ground-held', x: 5, y: 2, count: 1, heldBy: 'hero' },
  { id: 'ground-far', x: 18, y: 2, count: 1 },
];
const droppedWeapons: readonly Named<DiscoveryDroppedWeapon>[] = [
  { id: 'drop-found', x: 6, y: 2, taken: false },
  { id: 'drop-taken', x: 7, y: 2, taken: true },
  { id: 'drop-hidden', x: 11, y: 2, taken: false },
];
const bodies: readonly Named<DiscoveryBody>[] = [
  { id: 'dead-near', x: 1, y: 2, hp: 0 },
  { id: 'dead-visible-far', x: 8, y: 2, hp: 0 },
  { id: 'dead-hidden-near', x: 1, y: 3, hp: 0 },
  { id: 'dead-departed', x: 2, y: 2, hp: 0, departure: true },
];
const chests: readonly Named<DiscoveryChest>[] = [
  { id: 'chest-open-visible', type: 'chest', open: true, cells: [{ x: 3, y: 1 }] },
  {
    id: 'chest-open-partial',
    type: 'chest',
    open: true,
    cells: [
      { x: 9, y: 2 },
      { x: 10, y: 2 },
      { x: 11, y: 2 },
    ],
  },
  {
    id: 'chest-open-hidden',
    type: 'chest',
    open: true,
    cells: [
      { x: 10, y: 2 },
      { x: 11, y: 2 },
    ],
  },
  { id: 'chest-closed', type: 'chest', open: false, cells: [{ x: 5, y: 1 }] },
];

void test('loose equipment in sight is found and loose equipment out of sight is not', () => {
  assert.deepEqual(
    foundIds(groundItems, (item) => isGroundItemFound(item, observers, sight)),
    ['ground-found'],
  );
});

void test('equipment without a count or held by someone is not found', () => {
  const empty = groundItems.find((item) => item.id === 'ground-zero');
  const held = groundItems.find((item) => item.id === 'ground-held');
  assert.ok(empty);
  assert.ok(held);
  assert.equal(isGroundItemFound(empty, observers, sight), false);
  assert.equal(isGroundItemFound(held, observers, sight), false);
});

void test('a dropped weapon in sight is found and a taken one is not', () => {
  assert.deepEqual(
    foundIds(droppedWeapons, (weapon) => isDroppedWeaponFound(weapon, observers, sight)),
    ['drop-found'],
  );
});

void test("a body is found only at arm's length, and not when it is out of sight", () => {
  assert.deepEqual(
    foundIds(bodies, (body) => isBodyFound(body, observers, sight)),
    ['dead-near'],
  );
});

void test('an open chest is found when one of its cells is in sight, and a closed chest never', () => {
  assert.deepEqual(
    foundIds(chests, (chest) => isOpenChestFound(chest, observers, sight)),
    ['chest-open-visible', 'chest-open-partial'],
  );
});

void test('only a living, conscious, present player combatant observes the field', () => {
  const eligible: DiscoveryObserver = { side: 'player', hp: 100, x: 0, y: 2 };
  const units: readonly DiscoveryObserver[] = [
    eligible,
    { side: 'enemy', hp: 100, x: 0, y: 2 },
    { side: 'player', hp: 0, x: 0, y: 2 },
    { side: 'player', hp: 100, unconscious: true, x: 0, y: 2 },
    { side: 'player', hp: 100, departure: true, x: 0, y: 2 },
    { side: 'player', hp: 100, routed: true, x: 0, y: 2 },
    { side: 'player', hp: 100, surrendered: true, x: 0, y: 2 },
  ];
  assert.deepEqual(discoveryObservers(units), [eligible]);
});
