import { present } from './assert-present.ts';
import { readyLocal, localPackage, localNPC } from './local-contract-fixture.ts';
export function civilianWeaponContent({ critical = true } = {}) {
  const d = localPackage(),
    c = present(d.characters.at(-1));
  c.weapon = 'firearm-1800';
  c.blade = 'blade-1810';
  if (critical) {
    c.startingCondition = { hp: 1, energy: 100, fatigue: 0, bleeding: 0, bandaged: 0 };
  }
  present(d.weapons.find((w) => w.id === c.weapon)).name = 'Mosquete de Alma';
  present(d.weapons.find((w) => w.id === c.blade)).name = 'Sable de Alma';
  present(d.characters.find((c) => c.id === 'person-110')).attributes.medical = 90;
  return d;
}
export const civilianWeaponField = () => readyLocal({}, civilianWeaponContent());
export { localNPC };
