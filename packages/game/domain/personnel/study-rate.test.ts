import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterTrait } from './character-abilities.ts';
import { StudyRateRules, studyRate } from './study-rate.ts';

void test('a learner without an instructor earns the base rate for a low skill', () => {
  assert.equal(studyRate({ marksmanship: 20, wisdom: 50 }, 'marksmanship'), 1667);
  // A missing wisdom value uses the neutral midpoint, so the rate does not move.
  assert.equal(studyRate({ marksmanship: 20 }, 'marksmanship'), 1667);
});

void test('practice slows at each band of the learner skill', () => {
  const bands = [
    { skill: 45, rate: 1667 },
    { skill: 46, rate: 833 },
    { skill: 60, rate: 833 },
    { skill: 61, rate: 167 },
    { skill: 75, rate: 167 },
    { skill: 76, rate: 111 },
  ] as const;
  for (const { skill, rate } of bands) {
    assert.equal(
      studyRate({ marksmanship: skill, wisdom: 50 }, 'marksmanship'),
      rate,
      `skill ${skill}`,
    );
  }
});

void test('a teacher with a higher skill in the practiced skill teaches faster', () => {
  const learner = { marksmanship: 70, wisdom: 50 };
  assert.equal(studyRate(learner, 'marksmanship'), 167);
  // A teacher below the learner teaches at the same base as one at the same skill.
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 50 }), 333);
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 70 }), 333);
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 80 }), 500);
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 90 }), 667);
  // The advantage stops growing after three steps.
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 100 }), 833);
  // The teacher's skill decides; their wisdom does not.
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 80, wisdom: 100 }), 500);
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 90, wisdom: 0 }), 667);
  // Through skill 60 any teacher earns the same fixed multiplier.
  const lowLearner = { marksmanship: 40, wisdom: 50 };
  assert.equal(studyRate(lowLearner, 'marksmanship', { marksmanship: 40 }), 2500);
  assert.equal(studyRate(lowLearner, 'marksmanship', { marksmanship: 100 }), 2500);
});

void test('the teaching trait adds its bonus to the teacher multiplier', () => {
  const learner = { marksmanship: 70, wisdom: 50 };
  assert.equal(studyRate(learner, 'marksmanship', { marksmanship: 70 }), 333);
  assert.equal(
    studyRate(learner, 'marksmanship', { marksmanship: 70, traits: [CharacterTrait.Teacher] }),
    417,
  );
  assert.equal(
    studyRate(learner, 'marksmanship', {
      marksmanship: 70,
      traits: [CharacterTrait.NightVision],
    }),
    333,
  );
  // The bonus also applies to the fixed multiplier below skill 61.
  const lowLearner = { marksmanship: 40, wisdom: 50 };
  assert.equal(studyRate(lowLearner, 'marksmanship', { marksmanship: 40 }), 2500);
  assert.equal(
    studyRate(lowLearner, 'marksmanship', { marksmanship: 40, traits: [CharacterTrait.Teacher] }),
    3333,
  );
});

void test('the credit is never below one', () => {
  // Zero wisdom with the slowest band is the least a valid learner earns.
  assert.equal(studyRate({ marksmanship: 100, wisdom: 0 }, 'marksmanship'), 67);
  for (const skill of [0, 45, 60, 75, 100]) {
    assert.ok(studyRate({ marksmanship: skill, wisdom: 0 }, 'marksmanship') >= 1, `skill ${skill}`);
  }
  // Valid ratings never reach the floor; malformed wisdom still cannot earn less.
  assert.equal(studyRate({ marksmanship: 100, wisdom: -1000 }, 'marksmanship'), 1);
  assert.equal(StudyRateRules.MinimumCredit, 1);
});
