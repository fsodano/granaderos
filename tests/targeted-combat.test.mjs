import test from 'node:test';
import assert from 'node:assert/strict';
import {HIT_LOCATIONS, getHitLocationProfile, shotLocationPenalty, shotLocationEffects} from '../game/targeted-combat.js';

test('body-location profiles are immutable and default to the existing torso shot', () => {
  assert.deepEqual(HIT_LOCATIONS, ['torso', 'head', 'legs']);
  assert.equal(getHitLocationProfile().id, 'torso');
  assert.equal(Object.isFrozen(HIT_LOCATIONS), true);
  for (const location of HIT_LOCATIONS) assert.equal(Object.isFrozen(getHitLocationProfile(location)), true);
  for (const location of ['toString', '__proto__', 'arm', '', null]) {
    assert.throws(() => getHitLocationProfile(location), RangeError);
  }
});

test('head and leg accuracy costs grow with sight range; torso has no location cost', () => {
  assert.equal(shotLocationPenalty('torso', 12), 0);
  assert.equal(shotLocationPenalty('head', 5), 15);
  assert.equal(shotLocationPenalty('legs', 5), 5);
  assert.equal(shotLocationPenalty('head', 10), 30);
  assert.equal(shotLocationPenalty('legs', 10), 10);
  assert.equal(shotLocationPenalty('head', Math.SQRT2), 4);
  assert.equal(shotLocationPenalty(undefined, 10), 0);
});

test('ordinary torso impacts preserve rounded damage and breath based on actual HP loss', () => {
  assert.deepEqual(shotLocationEffects(undefined, 21.4, {hp: 100}), {
    damage: 21, breathLoss: 11, balanceLoss: 0, knockedDown: false, unhorse: false,
  });
  assert.deepEqual(shotLocationEffects('torso', 45, {hp: 5}), {
    damage: 45, breathLoss: 3, balanceLoss: 0, knockedDown: false, unhorse: false,
  });
});

test('head shots increase injury while leg shots trade injury for breath loss', () => {
  const torso = shotLocationEffects('torso', 40, {hp: 100});
  const head = shotLocationEffects('head', 40, {hp: 100});
  const legs = shotLocationEffects('legs', 40, {hp: 100});
  assert.equal(torso.damage, 40);
  assert.equal(head.damage, 60);
  assert.equal(head.breathLoss, 30);
  assert.equal(legs.damage, 26);
  assert.equal(legs.breathLoss, 32);
  assert.ok(legs.breathLoss > torso.breathLoss);
});

test('a strong leg impact can topple an upright survivor and unhorse a rider', () => {
  const rider = shotLocationEffects('legs', 40, {hp: 100, mounted: true, stance: 'standing'});
  assert.equal(rider.balanceLoss, 20);
  assert.equal(rider.knockedDown, true);
  assert.equal(rider.unhorse, true);
  const crouched = shotLocationEffects('legs', 40, {hp: 100, mounted: false, stance: 'crouched'});
  assert.equal(crouched.knockedDown, true);
  assert.equal(crouched.unhorse, false);
  assert.equal(shotLocationEffects('legs', 30, {hp: 100}).knockedDown, false);
  assert.equal(shotLocationEffects('head', 80, {hp: 150, mounted: true}).unhorse, false);
});

test('prone targets and lethal leg hits do not produce a second fall', () => {
  assert.equal(shotLocationEffects('legs', 40, {hp: 100, stance: 'prone'}).knockedDown, false);
  assert.equal(shotLocationEffects('legs', 40, {hp: 26, mounted: true}).knockedDown, false);
  assert.equal(shotLocationEffects('legs', 40, {hp: 20, mounted: true}).unhorse, false);
});

test('a zero impact and a hit on a dead target produce no breath or balance effects', () => {
  for (const location of HIT_LOCATIONS) {
    assert.deepEqual(shotLocationEffects(location, 0, {hp: 100, mounted: true}), {
      damage: 0, breathLoss: 0, balanceLoss: 0, knockedDown: false, unhorse: false,
    });
    const dead = shotLocationEffects(location, 50, {hp: 0, mounted: true});
    assert.equal(dead.breathLoss, 0);
    assert.equal(dead.balanceLoss, 0);
    assert.equal(dead.knockedDown, false);
    assert.equal(dead.unhorse, false);
  }
});

test('impact calculations are deterministic, have no random draws, and do not mutate targets', () => {
  const target = Object.freeze({hp: 83, energy: 12, mounted: true, stance: 'standing'});
  const first = shotLocationEffects('legs', 44.4, target);
  assert.deepEqual(shotLocationEffects('legs', 44.4, target), first);
  assert.deepEqual(target, {hp: 83, energy: 12, mounted: true, stance: 'standing'});
  assert.equal(shotLocationEffects('head', 12).damage, 18);
});

test('invalid ranges, impacts, and health fail before the caller can mutate combat state', () => {
  for (const invalid of [-1, NaN, Infinity, -Infinity, '12', null]) {
    assert.throws(() => shotLocationPenalty('head', invalid), RangeError);
    assert.throws(() => shotLocationEffects('head', invalid), RangeError);
    assert.throws(() => shotLocationEffects('head', 12, {hp: invalid}), RangeError);
  }
  assert.throws(() => shotLocationEffects('head', Number.MAX_VALUE), RangeError);
});
