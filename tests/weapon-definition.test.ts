import assert from 'node:assert/strict';
import test from 'node:test';
import type { WeaponDefinition } from '../packages/campaign-format/types.ts';
import {
  compileWeaponDefinition,
  restoreWeaponReferences,
  validateWeaponDefinition,
  validateWeaponReferences,
  weaponSaveReplacer,
  weaponSpecification,
} from '../packages/game/weapon-definition.ts';

const authored: WeaponDefinition = {
  id: 'test-musket',
  name: 'Mosquete de prueba',
  template: 1800,
  damage: 54,
  fireAP: 12,
  aimAP: 5,
  reloadAP: 42,
  range: 20,
  projectileEnergy: { model: 'kinetic-energy-v1', massGrams: 20, muzzleVelocityMps: 300 },
  materialRangeSlope: 0.4,
  alternativeLoads: [{ family: 'ammoShot', damage: 30, range: 8, pattern: 'cone' }],
};
const campaign = { contentCampaign: { package: { weapons: [authored] } } };

await test('compiled weapons keep authored combat values and apply family defaults', () => {
  const weapon = compileWeaponDefinition(authored);
  assert.equal(weapon.damage, 54);
  assert.equal(weapon.capacity, 1);
  assert.equal(weapon.readyAP, 0);
  assert.equal(weapon.weight, 4);
  assert.equal(weapon.price, 240);
  assert.throws(() => validateWeaponDefinition({ ...weapon, template: 1801 }, 1800), /familia/);
  assert.throws(() => validateWeaponDefinition({ ...weapon, price: Number.NaN }, 1800), /manejo/);
});

await test('alternative ammunition owns its penetration profile', () => {
  const weapon = compileWeaponDefinition(authored);
  const carrier = { weapon: 1800, weaponMetadata: { contentWeapon: weapon } };
  const primary = weaponSpecification(carrier);
  const alternative = weaponSpecification({ ...carrier, ammunitionChoice: 'ammoShot' });
  assert.equal(primary?.materialRangeSlope, 0.4);
  assert.deepEqual(primary?.projectileEnergy, authored.projectileEnergy);
  assert.ok(alternative);
  assert.equal(alternative.damage, 30);
  assert.equal(alternative.range, 8);
  assert.equal(alternative.loadPattern, 'cone');
  assert.equal(alternative.materialRangeSlope, undefined);
  assert.equal(alternative.projectileEnergy, undefined);
  assert.equal(weapon.materialRangeSlope, 0.4);
});

await test('saved weapon references restore only from their pinned campaign', () => {
  const weapon = compileWeaponDefinition(authored);
  const serialized = JSON.stringify(
    { inventory: [{ contentWeapon: weapon }] },
    weaponSaveReplacer(campaign),
  );
  assert.match(serialized, /definitionRef/);
  const restored: unknown = JSON.parse(serialized);
  restoreWeaponReferences(campaign, restored);
  assert.deepEqual(restored, { inventory: [{ contentWeapon: weapon }] });
  assert.doesNotThrow(() => validateWeaponReferences(campaign, restored));
  assert.throws(
    () => restoreWeaponReferences(campaign, { contentWeapon: { definitionRef: 'missing' } }),
    /referencia/,
  );
  assert.throws(
    () =>
      restoreWeaponReferences(campaign, {
        contentWeapon: { definitionRef: weapon.id, extra: true },
      }),
    /referencia/,
  );
  assert.throws(
    () => validateWeaponReferences(campaign, { contentWeapon: { ...weapon, damage: 1 } }),
    /contenido/,
  );
});
