import { present } from './assert-present.ts';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { DEFAULT_CHARACTER_SUPPLIES } from '../packages/game/character-supplies.ts';
import { initialCampaign } from '../packages/game/campaign.js';
import { order, visit } from './local-contract-fixture.ts';
// Declared carried dressings and one-time service cartridges isolate finite
// physical transfers; no workshop, refill or purchase supplies this scenario.
export function supplyCareField({ criticalResident = false } = {}) {
  const d = defaultContentPackage();
  if (criticalResident) {
    present(d.characters.find((c) => c.id === 'person-3')).startingCondition = {
      hp: 14,
      energy: 100,
      fatigue: 0,
      bleeding: 0,
      bandaged: 0,
    };
  }
  for (const id of [110, 111, 112]) {
    present(d.characters.find((c) => c.id === `person-${id}`)).arrivalHours = 0;
  }
  present(d.characters.find((c) => c.id === 'person-110')).startingSupplies = {
    ...DEFAULT_CHARACTER_SUPPLIES,
    medkits: 4,
  };
  const doc = present(d.characters.find((c) => c.id === 'person-111'));
  doc.attributes.medical = 80;
  doc.startingSupplies = { ...DEFAULT_CHARACTER_SUPPLIES, medkits: 0 };
  present(d.characters.find((c) => c.id === 'person-112')).startingCondition = {
    hp: 1,
    energy: 100,
    fatigue: 0,
    bleeding: 0,
    bandaged: 0,
  };
  let s = initialCampaign(42, d);
  for (const id of [110, 111, 112]) {
    s = order(s, { type: 'recruitCivic', id, term: 'week' });
  }
  return visit(s);
}
