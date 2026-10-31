import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonRoundTrip } from '../../../../tests/json-round-trip.ts';
import {
  CharacterAbilities,
  CharacterCapability,
  CharacterRating,
  CharacterTrait,
} from './character-abilities.ts';
import { Character } from './character.ts';

void test('ability ratings retain zero aptitude and the full authored range', () => {
  const abilities = new CharacterAbilities({
    ratings: { medical: 0, marksmanship: 100 },
    traits: [],
    capabilities: [],
  });
  assert.equal(abilities.rating(CharacterRating.Medical), 0);
  assert.equal(abilities.meetsRating(CharacterRating.Marksmanship, 100), true);
  assert.equal(abilities.meetsRating(CharacterRating.Medical, 1), false);
  assert.equal(abilities.rating(CharacterRating.Stealth), 0);
  for (const value of [-1, 101, 1.5, NaN, Infinity]) {
    assert.throws(
      () => new CharacterAbilities({ ratings: { medical: value }, traits: [], capabilities: [] }),
    );
  }
  const invalidRatings = { medical: 50, invalid: 50 };
  assert.throws(
    () => new CharacterAbilities({ ratings: invalidRatings, traits: [], capabilities: [] }),
  );
});

void test('training respects the lifetime gain and rating limits without changing the source value', () => {
  const abilities = new CharacterAbilities({
    ratings: { strength: 65, medical: 98 },
    traits: [],
    capabilities: [],
  });
  const trained = abilities.withTraining({ strength: 3, medical: 5 }, 75);
  assert.equal(trained.rating(CharacterRating.Medical), 100);
  assert.equal(trained.rating(CharacterRating.Strength), 75);
  assert.equal(abilities.rating(CharacterRating.Medical), 98);
  assert.equal(abilities.rating(CharacterRating.Strength), 65);
  for (const gain of [-1, 11, 0.5]) {
    assert.throws(() => abilities.withTraining({ medical: gain }));
  }
  assert.throws(() => abilities.withTraining({}, 101));
  assert.throws(() => abilities.withTraining({ wisdom: 1 }));
});

void test('named abilities are immutable and repeated officer traits have one meaning', () => {
  const input = {
    ratings: { medical: 80 },
    traits: [CharacterTrait.Teacher, CharacterTrait.Teacher],
    capabilities: [CharacterCapability.RapidFirstAid],
  };
  const abilities = new CharacterAbilities(input);
  input.ratings.medical = 0;
  input.traits.length = 0;
  input.capabilities.length = 0;
  const snapshot = abilities.toSnapshot();
  Object.assign(snapshot.ratings, { medical: 1 });
  assert.equal(abilities.rating(CharacterRating.Medical), 80);
  assert.equal(abilities.hasTrait(CharacterTrait.Teacher), true);
  assert.equal(abilities.hasCapability(CharacterCapability.RapidFirstAid), true);
  assert.deepEqual(abilities.toSnapshot().traits, [CharacterTrait.Teacher]);
  assert.throws(
    () => new CharacterAbilities({ ratings: {}, traits: ['unknown'], capabilities: [] }),
  );
  assert.throws(
    () => new CharacterAbilities({ ratings: {}, traits: [], capabilities: ['unknown'] }),
  );
});

void test('character restoration owns one ability value and preserves its behavior', () => {
  const character = Character.restore({
    id: 'medic',
    health: 70,
    maximumHealth: 80,
    alive: true,
    captured: false,
    locationId: 'retreat',
    abilities: {
      ratings: { medical: 85 },
      traits: [CharacterTrait.FieldRescuer],
      capabilities: [CharacterCapability.RapidFirstAid],
    },
  });
  assert.equal(character.abilities, character.abilities);
  const restored = Character.restore(jsonRoundTrip(character.snapshot()));
  assert.equal(restored.abilities.meetsRating(CharacterRating.Medical, 80), true);
  assert.equal(restored.abilities.hasTrait(CharacterTrait.FieldRescuer), true);
  assert.equal(restored.abilities.hasCapability(CharacterCapability.RapidFirstAid), true);
  assert.deepEqual(restored.snapshot(), character.snapshot());
});
