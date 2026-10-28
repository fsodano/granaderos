import assert from 'node:assert/strict';
import test from 'node:test';
import {banks, sampleBank} from './character-bank-fixture.mjs';

for (const [gender, bank] of Object.entries(banks)) {
 test(`${gender} pistol-butt strike keeps a usable native wrist through contact and recovery`, () => {
  const name = 'stand.butt.short-gun';
  const spec = bank.specs.find(entry => entry.name === name);
  assert.equal(spec.duration, 1);
  assert.equal(spec.markers.contact, .42);
  const intervals = Math.ceil(spec.duration * 120);
  // sampleBank also verifies every native joint offset and bone scale. Measure
  // the real palm direction, not the hand bone's arbitrary local rotation.
  sampleBank(bank, name, Array.from({length: intervals + 1}, (_, index) => index / intervals), (point, scene, time) => {
   const wrist = point('hand_r');
   const forearm = wrist.clone().sub(point('lowerarm_r'));
   const palm = point('middle_01_r').sub(wrist);
   const bend = palm.angleTo(forearm) * 180 / Math.PI;
   assert.ok(Number.isFinite(bend) && bend < 55,
    `${name} at ${time.toFixed(6)}s: palm folds ${bend.toFixed(3)} degrees from the native forearm`);
   return {};
  });
 });
}
