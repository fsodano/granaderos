import type { ActiveGame } from './local-contract-fixture.ts';
import { present } from './assert-present.ts';
import { movementPackage } from './dialogue-movement-fixture.ts';
import { order, talk } from './local-contract-fixture.ts';
export function arrivalPackage() {
  const d = movementPackage();
  d.quests = [{ id: 'meeting', title: 'El encuentro', description: 'Reuní al vecino con Alma.' }];
  const nodes = present(
    present(present(d.characters.find((c) => c.id === 'alma-contract')).encounter).dialogue,
  ).nodes;
  present(present(present(nodes[0]).choices[0]).effects).push({
    type: 'quest',
    quest: 'meeting',
    status: 'active',
  });
  Object.assign(present(present(nodes[1]).choices[0]), {
    label: 'Ya estamos reunidos.',
    conditions: [{ type: 'meeting', character: 'pablo' }],
    effects: [
      { type: 'quest', quest: 'meeting', status: 'completed' },
      { type: 'treasury', operation: 'receive', amount: 100 },
    ],
  });
  return d;
}
export const finishMeeting = (p: ActiveGame): ActiveGame => ({
  ...p,
  campaign: order(p.campaign, {
    ...talk(p, undefined, 'dialogue'),
    dialogueNode: 'north',
    dialogueChoice: 'back',
  }),
});
