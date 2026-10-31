import { approachNPC } from './approach-npc.ts';
import { completeTestTravel } from './campaign-test-helpers.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import '../packages/game/tactical.js';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
const step = (s: CampaignSnapshot, a: CampaignAction) => {
  const n = dispatchCampaign(s, a);
  if (n.lastError) {
    throw Error(n.lastError);
  }
  return n;
};
export function attendYatasto(s: CampaignSnapshot) {
  if (s.location !== 'tucuman') {
    s = completeTestTravel(s, { sector: 'tucuman' });
  }
  s = step(s, { type: 'visitMission', mission: 'yatasto' });
  let b = enterSector(s.pendingBattle, s.sceneStates['yatasto']);
  const actor = present(b.units.find((u) => u.side === 'player' && !u.militia));
  for (const npcId of ['yatasto-belgrano', 'yatasto-san-martin', 'yatasto-san-martin']) {
    b = approachNPC(b, actor.id, npcId);
    s = step(s, {
      type: 'talkNPC',
      npcId,
      approach: 'mission',
      unitId: Number(actor.id),
      sectorState: b,
    });
  }
  return step(s, {
    type: 'finishMission',
    battleId: present(s.pendingBattle).id,
    sectorState: b,
    survivors: b.units.filter((u) => u.side === 'player').map((u) => ({ ...u, id: Number(u.id) })),
  });
}
