import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
// Mirrors the live dialogue handler when a campaign-issued recruit joins the field.
import assert from 'node:assert/strict';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import { createBattle } from '../packages/game/tactical.js';
import { addIssuedGriefParticipant } from '../packages/game/companion-grief.js';
import { syncBattleTime } from '../packages/game/time.js';
import { approachNPC } from './approach-npc.ts';
export function meetRecruits(
  start:CampaignSnapshot,
  npcIds:readonly string[],
  actor = 4,
  { optionalHistoricalContacts = false } = {},
) {
  let c = structuredClone(start);
  const order = (a:CampaignAction) => {
    c = dispatchCampaign(c, a);
    assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
  };
  order({ type: 'visitSector' });
  let b = enterSector(c.pendingBattle, c.sectorStates[c.location]);
  for (const npcId of npcIds) {
    // Only the explicit Cuyo meeting treats these two historical recruits as optional.
    // Use the actual entered scene; permanent civilian losses remain in its report.
    const local = b.npcs.find((npc) => npc.id === npcId);
    if (
      optionalHistoricalContacts &&
      ['guemes', 'macacha'].includes(npcId) &&
      (!local || (local.hp ?? 100) <= 0)
    ) {
      continue;
    }
    b = approachNPC(b, String(actor), npcId);
    const sync = syncBattleTime(c, b);
    assert.equal(sync.error, null);
    c = sync.campaign;
    b = sync.battle;
    order({ type: 'talkNPC', unitId: actor, npcId, approach: 'recruit', sectorState: b });
    assert.equal(present(c.lastConversation).outcome, 'recruited');
    const id = present(c.lastConversation).operativeId,
      npc = b.npcs.find((n) => n.id === npcId),
      record = present(c.pendingBattle).squad.find((o) => o.id === id);
    b.npcs = b.npcs.filter((n) => n.id !== npcId);
    if (record) {
      const unit = createBattle([record], {
        width: b.width,
        height: b.height,
        enemies: [],
        exploration: true,
      }).units.find((u) => u.side === 'player');
      const deployed = { ...present(unit), x: present(npc).x, y: present(npc).y };
      b.units.push(deployed);
      addIssuedGriefParticipant(b, deployed);
    }
  }
  const sync = syncBattleTime(c, b);
  assert.equal(sync.error, null);
  c = sync.campaign;
  b = sync.battle;
  order({
    type: 'leaveSector',
    battleId: present(c.pendingBattle).id,
    sectorState: b,
    survivors: b.units.filter((u) => u.side === 'player'),
  });
  return c;
}
