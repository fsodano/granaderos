import type { ActiveGame } from './local-contract-fixture.ts';
import { present } from './assert-present.ts';
import { dialoguePackage } from './dialogue-fixture.ts';
import { A, order, talk } from './local-contract-fixture.ts';
import { projectDialogueMovements } from '../packages/game/dialogue-movement.js';
export function movementPackage() {
  const d = dialoguePackage(),
    speaker = present(d.characters.find((c) => c.id === 'alma-contract')),
    guest = structuredClone(speaker);
  guest.id = 'pablo';
  guest.name = 'Pablo';
  guest.nickname = 'Pablo';
  delete present(guest.encounter).dialogue;
  d.characters.push(guest);
  d.placements.push({
    id: 'pablo-location',
    character: 'pablo',
    mode: 'fixed',
    sectors: [A],
    moveChance: 100,
    afterDeath: null,
    delayMin: 0,
    delayMax: 0,
  });
  present(present(present(present(speaker.encounter).dialogue).nodes[0]).choices[0]).effects = [
    { type: 'movement', character: 'pablo', destination: 'speaker' },
  ];
  return d;
}
export const guest = (p: ActiveGame) => p.battle.npcs.find((n) => n.contentId === 'pablo');
export function callGuest(p: ActiveGame): ActiveGame {
  const campaign = order(p.campaign, {
    ...talk(p, undefined, 'dialogue'),
    dialogueNode: 'start',
    dialogueChoice: 'north',
  });
  return { campaign, battle: projectDialogueMovements(campaign, p.battle) };
}
