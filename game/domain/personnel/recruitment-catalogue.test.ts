import test from 'node:test';
import assert from 'node:assert/strict';
import { RecruitmentCandidate, RecruitmentAvailability } from './recruitment-candidate.ts';
import { RecruitmentCatalogue } from './recruitment-catalogue.ts';
import { CharacterAbilities } from './character-abilities.ts';

const candidates = [
  new RecruitmentCandidate({
    characterId: 'ana',
    name: 'Ana',
    nickname: 'Médica',
    role: 'Cirujana',
    availability: RecruitmentAvailability.Available,
    dailyPay: 30,
    abilities: new CharacterAbilities({
      ratings: { medical: 80, marksmanship: 40 },
      traits: [],
      capabilities: [],
    }),
  }),
  new RecruitmentCandidate({
    characterId: 'juan',
    name: 'Juan',
    nickname: 'El jinete',
    role: 'Soldado',
    availability: RecruitmentAvailability.Serving,
    dailyPay: 20,
    abilities: new CharacterAbilities({
      ratings: { medical: 20, marksmanship: 80 },
      traits: ['expert_rider'],
      capabilities: [],
    }),
  }),
  new RecruitmentCandidate({
    characterId: 'luis',
    name: 'Luis',
    nickname: 'Guía',
    role: 'Explorador',
    availability: RecruitmentAvailability.Captured,
    dailyPay: 10,
    abilities: new CharacterAbilities({
      ratings: { medical: 69, marksmanship: 70 },
      traits: ['guerrilla_tactician'],
      capabilities: [],
    }),
  }),
];

test('recruitment filters use text normalization, skill thresholds, traits and availability', () => {
  const catalogue = new RecruitmentCatalogue(candidates);
  const ids = (criteria: Parameters<RecruitmentCatalogue['select']>[0]) =>
    catalogue.select(criteria).map((candidate) => candidate.characterId);
  assert.deepEqual(ids({ query: 'medica' }), ['ana']);
  assert.deepEqual(ids({ specialty: 'medic' }), ['ana']);
  assert.deepEqual(ids({ specialty: 'rider' }), ['juan']);
  assert.deepEqual(ids({ specialty: 'scout' }), ['luis']);
  assert.deepEqual(ids({ specialty: 'marksman', availability: 'available' }), []);
  assert.deepEqual(ids({ availability: 'available' }), ['ana']);
});

test('ordering is stable and does not mutate the source collection', () => {
  const catalogue = new RecruitmentCatalogue(candidates);
  assert.deepEqual(
    catalogue.select({ sort: 'price' }).map((candidate) => candidate.characterId),
    ['luis', 'juan', 'ana'],
  );
  assert.deepEqual(
    catalogue.select({ sort: 'marksmanship' }).map((candidate) => candidate.characterId),
    ['juan', 'luis', 'ana'],
  );
  assert.deepEqual(
    catalogue.select({ sort: 'medical' }).map((candidate) => candidate.characterId),
    ['ana', 'luis', 'juan'],
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.characterId),
    ['ana', 'juan', 'luis'],
  );
});
