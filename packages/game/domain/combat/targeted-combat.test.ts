import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HIT_LOCATIONS,
  canChooseShotLocation,
  getHitLocationProfile,
  shotLocationEffects,
  shotLocationPenalty,
  shotLocationsFor,
} from './targeted-combat.ts';
import type { ShotTarget } from './targeted-combat.ts';

function shotTarget(overrides: Partial<ShotTarget> = {}): ShotTarget {
  return { hp: 100, energy: 100, stance: 'standing', ...overrides };
}

void test('a standing, conscious target may be aimed at', () => {
  assert.equal(canChooseShotLocation(shotTarget()), true);
  assert.equal(canChooseShotLocation({ hp: 100 }), true);
  assert.equal(canChooseShotLocation(shotTarget({ stance: 'crouched' })), true);
});

void test('a target without health, unconscious, knocked down or prone may not be aimed at', () => {
  for (const unable of [
    shotTarget({ hp: 0 }),
    shotTarget({ hp: -5 }),
    shotTarget({ hp: 10 }),
    shotTarget({ hp: 50, energy: 0 }),
    shotTarget({ unconscious: true }),
    shotTarget({ knockedDown: true }),
    shotTarget({ stance: 'prone' }),
  ]) {
    assert.equal(canChooseShotLocation(unable), false, JSON.stringify(unable));
  }
  assert.equal(canChooseShotLocation(null), false);
  assert.equal(canChooseShotLocation(undefined), false);
});

void test('an aimable target offers the body regions and any other only the torso', () => {
  assert.deepEqual(HIT_LOCATIONS, ['torso', 'head', 'legs']);
  assert.deepEqual(shotLocationsFor(shotTarget()), ['torso', 'head', 'legs']);
  assert.deepEqual(shotLocationsFor(shotTarget({ stance: 'prone' })), ['torso']);
  assert.deepEqual(shotLocationsFor(shotTarget({ hp: 0 })), ['torso']);
});

void test('a region carries its label and its modifiers', () => {
  assert.deepEqual(getHitLocationProfile('torso'), {
    id: 'torso',
    chancePenaltyPerTile: 0,
    damageMultiplier: 1,
    breathMultiplier: 0.5,
    balanceMultiplier: 0,
    label: 'Torso',
  });
  assert.deepEqual(getHitLocationProfile('head'), {
    id: 'head',
    chancePenaltyPerTile: 3,
    damageMultiplier: 1.5,
    breathMultiplier: 0.5,
    balanceMultiplier: 0,
    label: 'Cabeza',
  });
  assert.deepEqual(getHitLocationProfile('legs'), {
    id: 'legs',
    chancePenaltyPerTile: 1,
    damageMultiplier: 0.65,
    breathMultiplier: 1.2,
    balanceMultiplier: 0.5,
    label: 'Piernas',
  });
  assert.deepEqual(getHitLocationProfile(), getHitLocationProfile('torso'));
});

void test('the aiming penalty of a region follows its range', () => {
  const ranges = [0, 1, 2, 2.5, 5, 7];
  for (const location of ['torso', 'head', 'legs'] as const) {
    assert.deepEqual(
      ranges.map((range) => shotLocationPenalty(location, range)),
      {
        torso: [0, 0, 0, 0, 0, 0],
        head: [0, 3, 6, 8, 15, 21],
        legs: [0, 1, 2, 3, 5, 7],
      }[location],
      location,
    );
  }
});

void test('the effects of a region are the ones they were', () => {
  assert.deepEqual(shotLocationEffects('torso', 20, shotTarget()), {
    damage: 20,
    breathLoss: 10,
    balanceLoss: 0,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('head', 20, shotTarget()), {
    damage: 30,
    breathLoss: 15,
    balanceLoss: 0,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('legs', 20, shotTarget()), {
    damage: 13,
    breathLoss: 16,
    balanceLoss: 10,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('legs', 40, shotTarget()), {
    damage: 26,
    breathLoss: 32,
    balanceLoss: 20,
    knockedDown: true,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('legs', 40, shotTarget({ mounted: true })), {
    damage: 26,
    breathLoss: 32,
    balanceLoss: 20,
    knockedDown: true,
    unhorse: true,
  });
  assert.deepEqual(shotLocationEffects('legs', 40, shotTarget({ stance: 'prone' })), {
    damage: 26,
    breathLoss: 32,
    balanceLoss: 20,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('legs', 20, shotTarget({ hp: 5 })), {
    damage: 13,
    breathLoss: 6,
    balanceLoss: 10,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('head', 100, shotTarget({ hp: 50 })), {
    damage: 150,
    breathLoss: 25,
    balanceLoss: 0,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('torso', 0), {
    damage: 0,
    breathLoss: 0,
    balanceLoss: 0,
    knockedDown: false,
    unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('head', 25), {
    damage: 38,
    breathLoss: 19,
    balanceLoss: 0,
    knockedDown: false,
    unhorse: false,
  });
});
