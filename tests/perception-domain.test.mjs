import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldOfView } from '../packages/game/domain/perception/field-of-view.ts';
import { VisionObserver } from '../packages/game/domain/perception/vision-observer.ts';
import { VisibilityPolicy } from '../packages/game/domain/perception/visibility-policy.ts';
import { IlluminationPolicy } from '../packages/game/domain/perception/illumination-policy.ts';
import { KnownSectorPolicy } from '../packages/game/domain/perception/known-sector-policy.ts';
import { GetVisibleCharactersUseCase } from '../packages/game/application/perception/get-visible-characters/get-visible-characters.use-case.ts';
import { SectorGetVisibleCharactersRepository } from '../packages/game/infrastructure/perception/get-visible-characters.repository.js';
import {
  createBattle,
  canSee,
  visibleDistance,
  visibleEnemies,
  firearmKnownTerrain,
  shotChance,
} from '../packages/game/tactical.js';

const origin = { x: 2, y: 3 };
const conditions = {
  night: true,
  nightSightBonus: 0,
  targetIllumination: 0.08,
  coverPenalty: 0,
  stealthTraining: 0,
  concealedMovement: false,
  mounted: false,
};

test('field of view preserves peripheral proximity, compass arc and invalid input refusals', () => {
  const view = new FieldOfView(2);
  assert.equal(view.includes(origin, { x: 0, y: 3 }), true);
  assert.equal(view.includes(origin, { x: -1, y: 3 }), false);
  assert.equal(view.includes(origin, { x: 2, y: 8 }), true);
  assert.equal(view.includes(origin, { x: 8, y: 3 }), true);
  assert.throws(() => new FieldOfView(8));
  assert.throws(() => new FieldOfView(0, -1));
  assert.throws(() => view.includes(origin, { x: Infinity, y: 0 }));
});

test('visibility owns night, illumination, concealment and smoke thresholds', () => {
  const policy = new VisibilityPolicy();
  assert.equal(policy.range(conditions), 6);
  assert.equal(policy.range({ ...conditions, nightSightBonus: 2 }), 8);
  assert.equal(policy.range({ ...conditions, concealedMovement: true, stealthTraining: 20 }), 5);
  assert.equal(
    policy.range({ ...conditions, concealedMovement: true, stealthTraining: 20, mounted: true }),
    6,
  );
  assert.equal(policy.range({ ...conditions, targetIllumination: 0.25, coverPenalty: 2 }), 14);
  assert.equal(policy.smokeIsTransparent(4), true);
  assert.equal(policy.smokeIsTransparent(5), false);
  const light = new IlluminationPolicy();
  assert.equal(light.night([]), 0.08);
  assert.equal(light.night([{ distance: 0, radius: 4, intensity: 2 }]), 1);
  assert.equal(light.night([{ distance: 5, radius: 4, intensity: 1 }]), 0.08);
});

test('incapable, departed and rear targets cannot trigger private geometry inspection', () => {
  const unused = { range: assert.fail, lineOfSightClear: assert.fail, smokeCells: assert.fail };
  const disabled = new VisionObserver(origin, false, new FieldOfView(2));
  assert.equal(disabled.canObserve({ x: 6, y: 3, departed: false }, unused), false);
  const observer = new VisionObserver(origin, true, new FieldOfView(2));
  assert.equal(observer.canObserve({ x: 6, y: 3, departed: true }, unused), false);
  assert.equal(observer.canObserve({ x: -2, y: 3, departed: false }, unused), false);
  const environment = { range: () => 6, lineOfSightClear: () => true, smokeCells: () => 5 };
  assert.equal(observer.canObserve({ x: 6, y: 3, departed: false }, environment), false);
  assert.equal(
    observer.canObserve({ x: 6, y: 3, departed: false }, { ...environment, smokeCells: () => 4 }),
    true,
  );
});

test('known-sector policy and query publish only admitted character identities', () => {
  const policy = new KnownSectorPolicy();
  assert.equal(
    policy.admitsCharacter({ friendly: false, visible: true, interiorKnown: false }),
    false,
  );
  assert.equal(
    policy.admitsCharacter({ friendly: true, visible: false, interiorKnown: false }),
    true,
  );
  assert.equal(policy.retainsReflectingCover(true, false), false);
  const records = [
    { id: 'visible', ammunition: 12 },
    { id: 'hidden', ammunition: 8 },
    { id: 'visible', ammunition: 99 },
  ];
  const before = structuredClone(records);
  const repository = new SectorGetVisibleCharactersRepository(
    records,
    (character) => character.id === 'visible',
  );
  assert.deepEqual(new GetVisibleCharactersUseCase(repository).execute(), {
    characterIds: ['visible'],
  });
  assert.deepEqual(records, before);
});

test('live perception preserves night range and excludes hidden reflecting terrain without source mutation', () => {
  const width = 20,
    height = 8;
  const tiles = Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
  const state = createBattle([{ id: 'p', x: 2, y: 3, facing: 2 }], {
    width,
    height,
    tiles,
    hour: 0,
    enemies: [
      { id: 'near', x: 7, y: 3 },
      { id: 'far', x: 15, y: 3 },
    ],
  });
  state.units[0].traits = [];
  const [observer, near, far] = state.units;
  assert.equal(visibleDistance(state, observer, near), 6);
  assert.equal(canSee(state, observer, near), true);
  assert.equal(canSee(state, observer, far), false);
  assert.deepEqual(
    visibleEnemies(state).map((character) => character.id),
    ['near'],
  );
  state.units[0].traits = ['night_vision'];
  assert.equal(visibleDistance(state, observer, near), 8);
  assert.equal(Number.isFinite(shotChance(state, observer, near)), true);
  const stone = state.tiles.find((tile) => tile.x === 16 && tile.y === 6);
  Object.assign(stone, {
    type: 'stone',
    material: 'stone',
    blocked: true,
    obstacleHeight: 2,
    projectileResistance: 50,
    cover: 40,
  });
  const before = structuredClone(state);
  const known = firearmKnownTerrain(state, observer).tiles.find(
    (tile) => tile.x === stone.x && tile.y === stone.y,
  );
  assert.equal(known.obstacleHeight, 0);
  assert.equal(known.projectileResistance, 0);
  assert.equal(known.cover, 0);
  assert.deepEqual(state, before);
});
