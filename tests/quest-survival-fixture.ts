import { present } from './assert-present.ts';
import { questPackage } from './content-quest-fixture.ts';
export function survivalPackage() {
  const d = questPackage(),
    pablo = {
      ...structuredClone(present(d.characters.at(-1))),
      id: 'pablo',
      name: 'Pablo',
      nickname: 'Pablo',
      attributes: { ...present(d.characters.at(-1)).attributes, maxHp: 30 },
      traits: [],
      abilities: [],
    };
  delete present(pablo.encounter).dialogue;
  d.characters.push(pablo);
  d.placements.push({
    ...structuredClone(present(d.placements.at(-1))),
    id: 'pablo-place',
    character: 'pablo',
  });
  present(present(d.quests)[0]).requiredAlive = ['pablo'];
  return d;
}
