import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRENADE_TYPES,
  isGrenadeStack,
  makeGrenadeStack,
  validateGrenadeStack,
} from '../packages/game/grenades.ts';
import type { GrenadeStack } from '../packages/game/grenades.ts';
import { jsonRoundTrip } from './json-round-trip.ts';

void test('grenade stacks preserve finite quantities and survive JSON restoration', () => {
  for (const count of [0, 1, 2, 1_000_000]) {
    const stack = makeGrenadeStack('arsenal', count);
    assert.deepEqual(stack, {
      kind: 'grenade',
      grenadeType: 'arsenal',
      count,
      weight: GRENADE_TYPES.arsenal.weight,
      name: GRENADE_TYPES.arsenal.name,
      condition: 100,
    });
    const restored = jsonRoundTrip(stack);
    assert.equal(validateGrenadeStack(restored), true);
    assert.deepEqual(restored, stack);
  }
});

void test('grenade construction preserves independent admitted metadata', () => {
  const metadata = {
    name: 'Granada de la guardia',
    condition: 47,
    instanceId: 'guardia-1',
    history: { source: 'arsenal', owners: ['guardia'] },
    obsolete: undefined,
  };
  const before = structuredClone(metadata);
  const stack = makeGrenadeStack('arsenal', 1, metadata);
  metadata.history.owners.push('changed');
  assert.deepEqual(stack, {
    ...before,
    kind: 'grenade',
    grenadeType: 'arsenal',
    count: 1,
    weight: 1,
  });
});

function identityAfterPresenceCheck(stack: GrenadeStack): string | undefined {
  if ('instanceId' in stack) {
    const identity = stack.instanceId;
    // This assignment must compile even after the property-presence check.
    const missingIdentity: typeof identity = undefined;
    if (identity === missingIdentity) {
      return missingIdentity;
    }
    return identity.toUpperCase();
  }
  return undefined;
}

void test('grenades preserve an own undefined identity without treating it as a string', () => {
  const stack = makeGrenadeStack('arsenal', 1, { instanceId: undefined });
  assert.equal(Object.hasOwn(stack, 'instanceId'), true);
  assert.equal(stack.instanceId, undefined);
  assert.equal(validateGrenadeStack(stack), true);
  assert.equal(identityAfterPresenceCheck(stack), undefined);
  assert.equal(identityAfterPresenceCheck(makeGrenadeStack()), undefined);
  assert.equal(
    identityAfterPresenceCheck(makeGrenadeStack('arsenal', 1, { instanceId: 'guardia-1' })),
    'GUARDIA-1',
  );
  const restored: unknown = JSON.parse(JSON.stringify(stack));
  assert.ok(validateGrenadeStack(restored));
  assert.equal(Object.hasOwn(restored, 'instanceId'), false);
  assert.equal(identityAfterPresenceCheck(restored), undefined);
});

void test('grenade recognition keeps unrelated inventory outside grenade validation', () => {
  for (const value of [null, undefined, 0, [], {}, { kind: 'outfit' }]) {
    assert.equal(isGrenadeStack(value), false);
    assert.equal(validateGrenadeStack(value), false);
  }
  const malformed = { kind: 'grenade' };
  assert.equal(isGrenadeStack(malformed), true);
  assert.throws(() => validateGrenadeStack(malformed), /tipo de granada/);
});

void test('grenade validation refuses invalid quantities and catalogue fields', () => {
  const stack = makeGrenadeStack();
  for (const count of [-1, 0.5, 1_000_001, NaN, Infinity, '1', null]) {
    assert.throws(() => validateGrenadeStack({ ...stack, count }), /cantidad/);
  }
  for (const grenadeType of ['unknown', '__proto__', 0, null]) {
    assert.throws(() => validateGrenadeStack({ ...stack, grenadeType }), /tipo de granada/);
  }
  for (const weight of [0, 2, '1', null]) {
    assert.throws(() => validateGrenadeStack({ ...stack, weight }), /peso/);
  }
  for (const name of ['', ' ', '<arsenal>', 'a\u0000b', 'a'.repeat(101), 1, null]) {
    assert.throws(() => validateGrenadeStack({ ...stack, name }), /nombre/);
  }
  for (const condition of [-1, 101, NaN, Infinity, '100', null]) {
    assert.throws(() => validateGrenadeStack({ ...stack, condition }), /condición/);
  }
});

void test('identified grenades cannot share one identity across multiple units', () => {
  const stack = makeGrenadeStack('arsenal', 1, { instanceId: 'guardia-1' });
  assert.equal(validateGrenadeStack(stack), true);
  assert.throws(() => validateGrenadeStack({ ...stack, count: 2 }), /identificada/);
  for (const instanceId of [
    '',
    'a'.repeat(101),
    '<id>',
    'a\u0000b',
    '__proto__',
    'constructor',
    'prototype',
    1,
    null,
  ]) {
    assert.throws(() => validateGrenadeStack({ ...stack, instanceId }), /identificada/);
  }
});

void test('grenades refuse foreign equipment and explosion overrides', () => {
  const stack = makeGrenadeStack();
  for (const key of [
    'weapon',
    'loaded',
    'reloadProgress',
    'loadedAmmoType',
    'reloadAmmoType',
    'ammoType',
    'jammed',
    'fittings',
    'fittingPattern',
    'toolKey',
    'itemType',
    'outfit',
    'damage',
    'radius',
    'blastDamage',
    'blastRadius',
    'fuse',
    'fuseSeconds',
  ]) {
    assert.throws(() => validateGrenadeStack({ ...stack, [key]: 0 }), /otro equipo/);
    assert.equal(validateGrenadeStack({ ...stack, [key]: undefined }), true);
  }
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => validateGrenadeStack({ ...stack, [key]: 'invalid' }), /datos/);
  }
});

void test('grenade construction refuses invalid input without changing metadata', () => {
  const metadata = { condition: -1, history: ['arsenal'] };
  const before = structuredClone(metadata);
  assert.throws(() => makeGrenadeStack('unknown'), /tipo de granada/);
  assert.throws(() => makeGrenadeStack('arsenal', -1), /cantidad/);
  assert.throws(() => makeGrenadeStack('arsenal', 1, metadata), /condición/);
  assert.deepEqual(metadata, before);
  for (const value of [null, 0, [], 'metadata']) {
    assert.throws(() => makeGrenadeStack('arsenal', 1, value), /datos/);
  }
});
