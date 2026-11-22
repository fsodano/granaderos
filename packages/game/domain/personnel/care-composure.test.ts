import assert from 'node:assert/strict';
import test from 'node:test';
import { CARE_COMPOSURE_RELIEF, careComposureRelief } from './care-composure.ts';

const observedCare = { targetKind: 'unit', observed: true } as const;

const caregiver = (overrides = {}) => ({
  id: 'u2',
  side: 'player',
  abilities: ['care_composure'],
  shock: 8,
  ...overrides,
});

const patient = (overrides = {}) => ({
  id: 'u1',
  side: 'player',
  hp: 40,
  bleeding: 1,
  bandaged: 20,
  ...overrides,
});

// A completed bandage that stops the bleeding without restoring health.
const bandage = (overrides = {}) => ({
  valid: true,
  dressingsUsed: 1,
  hpAfter: 40,
  bleedingAfter: 0,
  bandagedAfter: 20,
  ...overrides,
});

void test('an observed effective treatment by an able caregiver gives the relief', () => {
  assert.equal(CARE_COMPOSURE_RELIEF, 2);
  assert.equal(
    careComposureRelief(caregiver(), patient(), bandage(), observedCare),
    CARE_COMPOSURE_RELIEF,
  );
});

void test('an observed effective treatment of a civilian gives the relief', () => {
  assert.equal(
    careComposureRelief(caregiver(), patient({ id: 'npc1' }), bandage(), {
      targetKind: 'npc',
      observed: true,
    }),
    CARE_COMPOSURE_RELIEF,
  );
});

void test('a treatment that restored health counts even when no wound improved', () => {
  assert.equal(
    careComposureRelief(
      caregiver(),
      patient(),
      bandage({ hpAfter: 42, bleedingAfter: 1, bandagedAfter: 20 }),
      observedCare,
    ),
    CARE_COMPOSURE_RELIEF,
  );
});

void test('a treatment that did not improve the patient gives none', () => {
  assert.equal(
    careComposureRelief(caregiver(), patient(), bandage({ bleedingAfter: 1 }), observedCare),
    0,
  );
});

void test('an unobserved treatment gives none', () => {
  assert.equal(
    careComposureRelief(caregiver(), patient(), bandage(), {
      targetKind: 'unit',
      observed: false,
    }),
    0,
  );
  assert.equal(careComposureRelief(caregiver(), patient(), bandage(), { targetKind: 'unit' }), 0);
});

void test('a caregiver without the care composure ability gives none', () => {
  assert.equal(
    careComposureRelief(caregiver({ abilities: [] }), patient(), bandage(), observedCare),
    0,
  );
  assert.equal(
    careComposureRelief(caregiver({ abilities: undefined }), patient(), bandage(), observedCare),
    0,
  );
});

void test('a caregiver treating themselves gives none', () => {
  assert.equal(careComposureRelief(caregiver({ id: 'u1' }), patient(), bandage(), observedCare), 0);
});

void test('a caregiver treating an opposing unit gives none', () => {
  assert.equal(
    careComposureRelief(caregiver(), patient({ side: 'enemy' }), bandage(), observedCare),
    0,
  );
});

void test('a caregiver with no shock, or shock above the cap, gives none', () => {
  assert.equal(careComposureRelief(caregiver({ shock: 0 }), patient(), bandage(), observedCare), 0);
  assert.equal(
    careComposureRelief(caregiver({ shock: undefined }), patient(), bandage(), observedCare),
    0,
  );
  assert.equal(
    careComposureRelief(caregiver({ shock: 21 }), patient(), bandage(), observedCare),
    0,
  );
});

void test('the relief is capped at the caregiver shock', () => {
  for (let shock = 1; shock <= 20; shock += 1) {
    const relief = careComposureRelief(caregiver({ shock }), patient(), bandage(), observedCare);
    assert.equal(relief, Math.min(2, shock), `shock ${String(shock)}`);
    assert.ok(relief <= shock, `relief exceeds shock ${String(shock)}`);
  }
});
