import type { ActiveGame } from './local-contract-fixture.ts';
import { present } from './assert-present.ts';
import { arrivalPackage, finishMeeting } from './meeting-arrival-fixture.ts';
import { projectDialogueMovements } from '../packages/game/dialogue-movement.js';
export function releasePackage() {
  const d = arrivalPackage(),
    nodes = present(
      present(present(d.characters.find((c) => c.id === 'alma-contract')).encounter).dialogue,
    ).nodes;
  present(present(present(nodes[1]).choices[0]).effects).push({
    type: 'movement',
    character: 'pablo',
    destination: 'routine',
  });
  return d;
}
export function releaseMeeting(p: ActiveGame): ActiveGame {
  const next = finishMeeting(p);
  return { ...next, battle: projectDialogueMovements(next.campaign, next.battle) };
}
