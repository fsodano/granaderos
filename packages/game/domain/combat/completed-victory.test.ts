import assert from 'node:assert/strict';
import test from 'node:test';
import { completedTacticalVictory } from './completed-victory.ts';
import type { TacticalVictoryBattle } from './completed-victory.ts';

function battle(overrides: Partial<TacticalVictoryBattle> = {}): TacticalVictoryBattle {
  return {
    phase: 'player',
    status: 'victory',
    units: [
      { side: 'player', hp: 100 },
      { side: 'enemy', hp: 0 },
    ],
    ...overrides,
  };
}

void test('the field is won when only the player can still act', () => {
  assert.equal(completedTacticalVictory(battle()), true);
  assert.equal(
    completedTacticalVictory(
      battle({
        units: [
          { side: 'player', hp: 15 },
          { side: 'enemy', hp: 14 },
        ],
      }),
    ),
    true,
  );
});

void test('a cleared exploration sector is a won field', () => {
  assert.equal(
    completedTacticalVictory(
      battle({ status: 'active', mode: 'exploration', sectorCleared: true }),
    ),
    true,
  );
  assert.equal(
    completedTacticalVictory(
      battle({ status: 'active', mode: 'exploration', sectorCleared: false }),
    ),
    false,
  );
  assert.equal(completedTacticalVictory(battle({ status: 'active', sectorCleared: true })), false);
  assert.equal(completedTacticalVictory(battle({ status: 'defeat' })), false);
});

void test('an unfinished or interrupted battle is not a won field', () => {
  assert.equal(completedTacticalVictory(null), false);
  assert.equal(completedTacticalVictory(undefined), false);
  assert.equal(completedTacticalVictory(battle({ phase: 'enemy' })), false);
  assert.equal(completedTacticalVictory(battle({ enemyTurn: true })), false);
  assert.equal(completedTacticalVictory(battle({ alliedTurn: true })), false);
  assert.equal(completedTacticalVictory(battle({ interrupt: {} })), false);
  assert.equal(completedTacticalVictory(battle({ reactionStack: [] })), false);
});

void test('the field is not won while the player cannot act or the enemy still can', () => {
  assert.equal(
    completedTacticalVictory(
      battle({
        units: [
          { side: 'player', hp: 14 },
          { side: 'enemy', hp: 0 },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    completedTacticalVictory(
      battle({
        units: [
          { side: 'player', hp: 100 },
          { side: 'enemy', hp: 15 },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    completedTacticalVictory(
      battle({
        units: [
          { side: 'player', hp: 100 },
          { side: 'enemy', hp: 100, fled: true },
        ],
      }),
    ),
    true,
  );
});
