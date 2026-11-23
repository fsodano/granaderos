import assert from 'node:assert/strict';
import test from 'node:test';
import { medicalPatientAvailable, medicalPatientPresent } from './medical-patient.ts';
import type { MedicalPatient } from './medical-patient.ts';

function patient(overrides: Partial<MedicalPatient> = {}): MedicalPatient {
  return { hp: 40, ...overrides };
}

void test('a wounded person on the field is present for care', () => {
  assert.equal(medicalPatientPresent(patient()), true);
  assert.equal(medicalPatientPresent(patient({ hp: 1 })), true);
  assert.equal(medicalPatientPresent(patient({ detention: { freed: true } })), true);
});

void test('a dead, departed, fled or surrendered person is not present for care', () => {
  assert.equal(medicalPatientPresent(patient({ hp: 0 })), false);
  assert.equal(medicalPatientPresent(patient({ departure: {} })), false);
  assert.equal(medicalPatientPresent(patient({ fled: true })), false);
  assert.equal(medicalPatientPresent(patient({ surrendered: true })), false);
});

void test('a captured or detained person is not present for care', () => {
  assert.equal(medicalPatientPresent(patient({ captured: true })), false);
  assert.equal(medicalPatientPresent(patient({ captive: true })), false);
  assert.equal(medicalPatientPresent(patient({ detention: { freed: false } })), false);
  assert.equal(medicalPatientPresent(patient({ detention: {} })), false);
  assert.equal(medicalPatientPresent(null), false);
  assert.equal(medicalPatientPresent(undefined), false);
});

void test('a routed conscious person refuses care', () => {
  assert.equal(medicalPatientAvailable(patient({ routed: true })), false);
  assert.equal(medicalPatientAvailable(patient({ routed: true, hp: 15 })), false);
  assert.equal(medicalPatientAvailable(patient({ routed: true, energy: 1 })), false);
});

void test('an unconscious routed person does not refuse care', () => {
  assert.equal(medicalPatientAvailable(patient({ routed: true, hp: 14 })), true);
  assert.equal(medicalPatientAvailable(patient({ routed: true, energy: 0 })), true);
});

void test('a person present for care accepts it when not routed', () => {
  assert.equal(medicalPatientAvailable(patient()), true);
  assert.equal(medicalPatientAvailable(patient({ hp: 0 })), false);
  assert.equal(medicalPatientAvailable(patient({ captured: true })), false);
});
