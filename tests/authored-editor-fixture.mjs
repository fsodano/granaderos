import { defaultContentPackage } from '../packages/game/content-package.js';
import { DEFAULT_FOUNDRY } from '../packages/game/campaign-foundry.js';
import { DEFAULT_ALTERNATIVE_LOADS } from '../packages/game/firearm-loads.js';
import { DEFAULT_MATERIAL_RANGE_SLOPE } from '../packages/game/material-range-penetration.js';

// Explicit authoring options used by editor capability tests. These are not
// the installed campaign's starting rules or a shipped gameplay baseline.
export function authoredEditorPackage() {
  const content = defaultContentPackage();
  content.foundry = structuredClone(DEFAULT_FOUNDRY);
  for (const character of content.characters) {
    if (Number(character.id.slice(7)) >= 100) {
      character.arrivalHours = 6;
    }
    if (character.id === 'person-126') {
      character.abilities = ['enclosed_room_fear'];
    }
    if (character.id === 'person-130') {
      character.abilities = ['care_composure', 'nervous_isolation', 'low_morale_refusal'];
    }
    if (character.id === 'person-107') {
      character.abilities = ['civilian_conscience'];
    }
  }
  for (const weapon of content.weapons.filter((weapon) => weapon.id.startsWith('firearm-'))) {
    weapon.readyAP = 0;
    weapon.materialRangeSlope = DEFAULT_MATERIAL_RANGE_SLOPE;
    weapon.alternativeLoads = (DEFAULT_ALTERNATIVE_LOADS[weapon.template] ?? []).map((load) => ({
      ...load,
      materialRangeSlope: DEFAULT_MATERIAL_RANGE_SLOPE,
      ...(weapon.template === 1800 && load.family === 'ammoShot'
        ? {
            projectileEnergy: { model: 'kinetic-energy-v1', massGrams: 16, muzzleVelocityMps: 265 },
            projectileAirDrag: { model: 'range-energy-retention-v1', retentionAtRange: 0.65 },
          }
        : {}),
    }));
    if (weapon.template === 1800) {
      weapon.projectileEnergy = {
        model: 'kinetic-energy-v1',
        massGrams: 32,
        muzzleVelocityMps: 265,
      };
      weapon.projectileAirDrag = { model: 'range-energy-retention-v1', retentionAtRange: 0.8 };
    }
  }
  return content;
}
