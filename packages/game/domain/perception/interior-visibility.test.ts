import assert from 'node:assert/strict';
import test from 'node:test';
import { isInteriorVisible, roomAt } from './interior-visibility.ts';
import type { InteriorTerrain } from './interior-visibility.ts';

const width = 10;
const height = 8;
const building = {
  id: 'building:house',
  x: 2,
  y: 2,
  width: 5,
  height: 5,
  rooms: [
    {
      id: 'room:hall',
      cells: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
    },
    { id: 'room:back', cells: [{ x: 5, y: 5 }] },
  ],
};
const insideBuilding = (x: number, y: number) => x >= 2 && x <= 6 && y >= 2 && y <= 6;
const onWall = (x: number, y: number) => x === 2 || x === 6 || y === 2 || y === 6;
const tiles = Array.from({ length: width * height }, (_, index) => {
  const x = index % width;
  const y = Math.floor(index / width);
  return {
    x,
    y,
    type: insideBuilding(x, y) ? (onWall(x, y) ? 'wall' : 'floor') : 'grass',
    blocked: insideBuilding(x, y) && onWall(x, y),
    cover: 0,
    ...(insideBuilding(x, y) ? { buildingId: building.id } : {}),
  };
});
const state: InteriorTerrain = { width, height, tiles, buildings: [building] };
const nothingRevealed: ReadonlySet<string> = new Set();
const hallRevealed: ReadonlySet<string> = new Set(['room:hall']);
const backRevealed: ReadonlySet<string> = new Set(['room:back']);
const bothRevealed: ReadonlySet<string> = new Set(['room:hall', 'room:back']);

void test('a point outside any building has no room and stays visible', () => {
  const outside = { x: 0, y: 0 };
  assert.equal(roomAt(state, outside), undefined);
  assert.equal(isInteriorVisible(state, outside, nothingRevealed), true);
  assert.equal(isInteriorVisible(state, outside, bothRevealed), true);
});

void test('a point inside a room belongs to that room', () => {
  assert.equal(roomAt(state, { x: 2, y: 2 })?.id, 'room:hall');
  assert.equal(roomAt(state, { x: 5, y: 5 })?.id, 'room:back');
});

void test('a room is visible from the cell that contains it only once it is revealed', () => {
  const hallCell = { x: 2, y: 2 };
  assert.equal(isInteriorVisible(state, hallCell, hallRevealed), true);
  assert.equal(isInteriorVisible(state, hallCell, bothRevealed), true);
  assert.equal(isInteriorVisible(state, hallCell, nothingRevealed), false);
  assert.equal(isInteriorVisible(state, hallCell, backRevealed), false);
  const backCell = { x: 5, y: 5 };
  assert.equal(isInteriorVisible(state, backCell, backRevealed), true);
  assert.equal(isInteriorVisible(state, backCell, nothingRevealed), false);
  assert.equal(isInteriorVisible(state, backCell, hallRevealed), false);
});

void test('a cell the building separates from every room stays hidden', () => {
  const separated = { x: 4, y: 4, buildingId: building.id };
  assert.equal(roomAt(state, separated), undefined);
  assert.equal(isInteriorVisible(state, separated, bothRevealed), false);
  assert.equal(isInteriorVisible(state, separated, nothingRevealed), false);
});

void test('a tagged room resolves through the point that carries it', () => {
  const taggedHall = { x: 2, y: 2, roomId: 'room:hall', buildingId: building.id };
  assert.equal(isInteriorVisible(state, taggedHall, hallRevealed), true);
  assert.equal(isInteriorVisible(state, taggedHall, bothRevealed), true);
  assert.equal(isInteriorVisible(state, taggedHall, nothingRevealed), false);
  assert.equal(isInteriorVisible(state, taggedHall, backRevealed), false);
});
