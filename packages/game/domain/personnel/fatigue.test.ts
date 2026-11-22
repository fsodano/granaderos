import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collapseRecoveryPending,
  energyAfterLimit,
  energyAfterRecovery,
  fatigueAfterGain,
  fatigueAfterRecovery,
  maximumEnergyAtFatigue,
} from './fatigue.ts';

void test('the maximum energy falls as fatigue rises and never falls below ten', () => {
  assert.equal(maximumEnergyAtFatigue(0), 100);
  assert.equal(maximumEnergyAtFatigue(25), 75);
  assert.equal(maximumEnergyAtFatigue(50), 50);
  assert.equal(maximumEnergyAtFatigue(75), 25);
  assert.equal(maximumEnergyAtFatigue(90), 10);
  assert.equal(maximumEnergyAtFatigue(100), 10);
  // Fatigue rounds to the nearest point before it sets the maximum.
  assert.equal(maximumEnergyAtFatigue(49.4), 51);
  assert.equal(maximumEnergyAtFatigue(49.5), 50);
});

void test('fatigue above one hundred and negative fatigue stay inside the range', () => {
  assert.equal(maximumEnergyAtFatigue(150), 10);
  assert.equal(maximumEnergyAtFatigue(-50), 100);
  assert.equal(fatigueAfterGain(95, 20), 100);
  assert.equal(fatigueAfterGain(10, -20), 0);
  assert.equal(fatigueAfterGain(0, 5), 5);
});

void test('a collapse still needs recovery below sixty and not at sixty or above', () => {
  assert.equal(collapseRecoveryPending(0), false);
  assert.equal(collapseRecoveryPending(39), false);
  assert.equal(collapseRecoveryPending(40), false);
  assert.equal(collapseRecoveryPending(41), true);
  assert.equal(collapseRecoveryPending(100), true);
});

void test('limiting energy leaves the smaller of the current energy and the maximum', () => {
  assert.equal(energyAfterLimit(80, 75), 75);
  assert.equal(energyAfterLimit(20, 75), 20);
});

void test('gaining fatigue rounds up and never leaves zero to one hundred', () => {
  assert.equal(fatigueAfterGain(10, 0), 10);
  assert.equal(fatigueAfterGain(10, 0.1), 11);
  assert.equal(fatigueAfterGain(10, 0.9), 11);
  assert.equal(fatigueAfterGain(95, 20), 100);
  assert.equal(fatigueAfterGain(10, -20), 0);
});

void test('recovering energy never passes the maximum and recovering fatigue never goes below zero', () => {
  assert.equal(energyAfterRecovery(70, 10, 75), 75);
  assert.equal(energyAfterRecovery(10, 10, 75), 20);
  assert.equal(energyAfterRecovery(0, 30, 50), 30);
  assert.equal(fatigueAfterRecovery(5, 10), 0);
  assert.equal(fatigueAfterRecovery(0, 5), 0);
  assert.equal(fatigueAfterRecovery(50, 10), 40);
});
