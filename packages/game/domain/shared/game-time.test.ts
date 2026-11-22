import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainRefusal, DomainRefusalCode } from './domain-refusal.ts';
import { GameTime, gameSecondsFromCampaignClock } from './game-time.ts';
import { STRATEGIC_CLOCK_SPEEDS, campaignSeconds } from '../../strategic-clock.ts';

void test('a campaign clock becomes the accepted game second without refusing an unusual clock', () => {
  assert.equal(gameSecondsFromCampaignClock({ hour: 2, secondOfHour: 30 }), 7230);
  assert.equal(gameSecondsFromCampaignClock({ hour: 0, secondOfHour: 0 }), 0);
  assert.equal(gameSecondsFromCampaignClock({ hour: 49, secondOfHour: 59 }), 176459);
  assert.equal(gameSecondsFromCampaignClock({ hour: 1, secondOfHour: 3600 }), 7200);
});

void test('a missing second of the hour counts as zero', () => {
  assert.equal(gameSecondsFromCampaignClock({ hour: 3 }), 10800);
  assert.equal(gameSecondsFromCampaignClock({ hour: 0 }), 0);
});

void test('GameTime keeps its validation and derives the same accepted second', () => {
  const time = GameTime.fromCampaignClock(2, 30);
  assert.equal(time.seconds, 7230);
  assert.equal(time.hour, 2);
  assert.equal(time.secondOfHour, 30);
  const invalidClocks: [number, number][] = [
    [1, 3600],
    [-1, 0],
    [1, -1],
    [1.5, 0],
    [1, 0.5],
  ];
  for (const [hour, secondOfHour] of invalidClocks) {
    assert.throws(
      () => GameTime.fromCampaignClock(hour, secondOfHour),
      (error: unknown) =>
        error instanceof DomainRefusal && error.code === DomainRefusalCode.InvalidValue,
    );
  }
  assert.equal(gameSecondsFromCampaignClock({ hour: 1, secondOfHour: 3600 }), 7200);
});

void test('the campaign clock module keeps its speeds and its campaign seconds', () => {
  assert.deepEqual([...STRATEGIC_CLOCK_SPEEDS], [60, 300, 900, 3600]);
  assert.equal(Object.isFrozen(STRATEGIC_CLOCK_SPEEDS), true);
  assert.equal(campaignSeconds({ hour: 2, secondOfHour: 30 }), 7230);
  assert.equal(campaignSeconds({ hour: 2 }), 7200);
});
