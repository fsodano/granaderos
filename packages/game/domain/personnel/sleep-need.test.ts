import test from 'node:test';
import assert from 'node:assert/strict';
import { sleepNeed, sleepRecovery, SleepNeedRules } from './sleep-need.ts';

// Profile hours come from the default catalogue. Profile 103 rests six hours
// and profile 109 rests ten; profile 200 is a fixture below the normal range
// that exercises the lower bound, which no authored profile reaches.
const profiles = Object.freeze({ 103: 6, 109: 10, 200: 4 });

void test('a healthy combatant rests their profile hours', () => {
  assert.deepEqual(sleepNeed({ id: 103, hp: 100, maxHp: 100 }, profiles), {
    base: 6,
    wounds: 0,
    nightTraining: 0,
    hours: 6,
  });
  assert.deepEqual(sleepNeed({ id: 'unknown', hp: 100, maxHp: 100 }, profiles), {
    base: 8,
    wounds: 0,
    nightTraining: 0,
    hours: 8,
  });
  assert.equal(
    sleepNeed({ id: 103, genericCharacter: true, hp: 100, maxHp: 100 }, profiles).base,
    8,
  );
  assert.deepEqual(sleepNeed({ id: 103, hp: 60 }, profiles), {
    base: 6,
    wounds: 1,
    nightTraining: 0,
    hours: 7,
  });
  assert.equal(sleepNeed({ id: 103 }, profiles).hours, 6);
});

void test('wounds rise by one, two, and four hours below 75, 50, and 25 percent health', () => {
  const thresholds = [
    { hp: 75, wounds: 0 },
    { hp: 74, wounds: 1 },
    { hp: 50, wounds: 1 },
    { hp: 49, wounds: 2 },
    { hp: 25, wounds: 2 },
    { hp: 24, wounds: 4 },
  ];
  for (const { hp, wounds } of thresholds) {
    assert.equal(sleepNeed({ id: 'unknown', hp, maxHp: 100 }, profiles).wounds, wounds, `hp ${hp}`);
  }
  assert.equal(sleepNeed({ id: 'unknown', hp: 74, maxHp: 100 }, profiles).hours, 9);
  assert.equal(sleepNeed({ id: 'unknown', hp: 49, maxHp: 100 }, profiles).hours, 10);
  assert.equal(sleepNeed({ id: 'unknown', hp: 24, maxHp: 100 }, profiles).hours, 12);
  // The whole four-hour wound adjustment adds to a profile without hitting the bound.
  assert.deepEqual(sleepNeed({ id: 103, hp: 20, maxHp: 100 }, profiles), {
    base: 6,
    wounds: 4,
    nightTraining: 0,
    hours: 10,
  });
});

void test('night training shortens the need by one hour', () => {
  assert.deepEqual(
    sleepNeed({ id: 'unknown', hp: 100, maxHp: 100, traits: ['night_vision'] }, profiles),
    {
      base: 8,
      wounds: 0,
      nightTraining: 1,
      hours: 7,
    },
  );
  assert.equal(
    sleepNeed({ id: 'unknown', hp: 100, maxHp: 100, traits: ['teacher'] }, profiles).hours,
    8,
  );
  assert.equal(
    sleepRecovery({ id: 'unknown', hp: 100, maxHp: 100, traits: ['night_vision'] }, profiles)
      .energy,
    13,
  );
  assert.equal(
    sleepRecovery({ id: 'unknown', hp: 100, maxHp: 100, traits: ['night_vision'] }, profiles)
      .fatigue,
    9,
  );
});

void test('the total stays inside the bounds of four and twelve hours', () => {
  assert.deepEqual(sleepNeed({ id: 109, hp: 20, maxHp: 100, traits: ['night_vision'] }, profiles), {
    base: 10,
    wounds: 4,
    nightTraining: 1,
    hours: 12,
  });
  assert.deepEqual(
    sleepNeed({ id: 200, hp: 100, maxHp: 100, traits: ['night_vision'] }, profiles),
    {
      base: 4,
      wounds: 0,
      nightTraining: 1,
      hours: 4,
    },
  );
  assert.equal(SleepNeedRules.MinimumHours, 4);
  assert.equal(SleepNeedRules.MaximumHours, 12);
  assert.equal(
    sleepRecovery({ id: 109, hp: 20, maxHp: 100, traits: ['night_vision'] }, profiles).fatigue,
    5,
  );
  assert.equal(
    sleepRecovery({ id: 200, hp: 100, maxHp: 100, traits: ['night_vision'] }, profiles).energy,
    24,
  );
});

void test('each hour of rest returns the same fatigue and energy as before', () => {
  const recoveries = [
    { unit: { id: 'unknown', hp: 100, maxHp: 100 }, hours: 8, fatigue: 8, energy: 12 },
    { unit: { id: 'unknown', hp: 74, maxHp: 100 }, hours: 9, fatigue: 7, energy: 10 },
    { unit: { id: 'unknown', hp: 49, maxHp: 100 }, hours: 10, fatigue: 6, energy: 9 },
    { unit: { id: 'unknown', hp: 24, maxHp: 100 }, hours: 12, fatigue: 5, energy: 8 },
    {
      unit: { id: 'unknown', hp: 100, maxHp: 100, traits: ['night_vision'] },
      hours: 7,
      fatigue: 9,
      energy: 13,
    },
    { unit: { id: 103, hp: 100, maxHp: 100 }, hours: 6, fatigue: 10, energy: 16 },
    {
      unit: { id: 103, hp: 100, maxHp: 100, traits: ['night_vision'] },
      hours: 5,
      fatigue: 12,
      energy: 19,
    },
    {
      unit: { id: 200, hp: 100, maxHp: 100, traits: ['night_vision'] },
      hours: 4,
      fatigue: 16,
      energy: 24,
    },
  ];
  for (const { unit, hours, fatigue, energy } of recoveries) {
    assert.deepEqual(sleepRecovery(unit, profiles), {
      ...sleepNeed(unit, profiles),
      hours,
      fatigue,
      energy,
    });
  }
  assert.deepEqual(sleepRecovery({ id: 103, hp: 20, maxHp: 100 }, profiles), {
    base: 6,
    wounds: 4,
    nightTraining: 0,
    hours: 10,
    fatigue: 6,
    energy: 9,
  });
});
