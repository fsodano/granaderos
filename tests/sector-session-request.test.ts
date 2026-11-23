import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { enterSector } from '../packages/game/world.js';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { completeTestTravel } from './campaign-test-helpers.ts';
import { approachNPC } from './approach-npc.ts';
import { present } from './assert-present.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';

const order = (s: CampaignSnapshot, a: CampaignAction) => {
  const next = dispatchCampaign(s, a);
  assert.equal(next.lastError, null, next.lastError ?? undefined);
  return next;
};

function visiting(): { campaign: CampaignSnapshot; battle: BattleSnapshot } {
  let campaign = order(initialCampaign(12), { type: 'recruitCombatant', id: 110, term: 'week' });
  campaign = order(campaign, { type: 'visitSector' });
  const pair = prepareCampaignBattle(campaign);
  assert.equal(pair.error, null, pair.error ?? undefined);
  return { campaign: pair.campaign, battle: present(pair.battle) };
}

function conference(): { campaign: CampaignSnapshot; battle: BattleSnapshot } {
  let campaign = initialCampaign(45);
  campaign.phase = 2;
  campaign.flags['sanLorenzo'] = true;
  campaign.flags['northPact'] = true;
  for (const id of ['cordoba', 'tucuman', 'salta']) {
    present(campaign.sectors[id]).owner = 'patriot';
  }
  campaign = completeTestTravel(campaign, { sector: 'tucuman' });
  campaign = order(campaign, { type: 'visitMission', mission: 'yatasto' });
  let battle = enterSector(campaign.sectorEntryRequest, campaign.sceneSnapshots['yatasto']);
  const actor = present(battle.units.find((unit) => unit.side === 'player' && !unit.militia));
  for (const npcId of ['yatasto-belgrano', 'yatasto-san-martin', 'yatasto-san-martin']) {
    battle = approachNPC(battle, actor.id, npcId);
    campaign = order(campaign, {
      type: 'talkNPC',
      npcId,
      approach: 'mission',
      unitId: Number(actor.id),
      sectorSession: battle,
    });
  }
  return { campaign, battle };
}

void test('a leaveSector order applies the sector view carried as sectorSession', () => {
  const pair = visiting();
  const view = structuredClone(pair.battle);
  const wounded = present(view.units.find((unit) => unit.side === 'player'));
  const woundedId = Number(wounded.id);
  wounded.hp = wounded.maxHp - 1;
  assert.notEqual(present(pair.campaign.characters[woundedId]).hp, wounded.hp);
  const next = order(pair.campaign, {
    type: 'leaveSector',
    battleId: present(pair.campaign.sectorEntryRequest).id,
    sectorSession: view,
    survivors: view.units.filter((unit) => unit.side === 'player'),
  });
  assert.equal(next.sectorEntryRequest, null);
  assert.equal(present(next.characters[woundedId]).hp, wounded.hp);
  assert.ok(Object.hasOwn(next.sectorSnapshots, present(pair.campaign.sectorEntryRequest).sector));
});

void test('a finishMission order applies the sector view carried as sectorSession', () => {
  const pair = conference();
  const view = structuredClone(pair.battle);
  const wounded = present(view.units.find((unit) => unit.side === 'player' && !unit.militia));
  const woundedId = Number(wounded.id);
  wounded.hp = wounded.maxHp - 1;
  assert.notEqual(present(pair.campaign.characters[woundedId]).hp, wounded.hp);
  const next = order(pair.campaign, {
    type: 'finishMission',
    battleId: present(pair.campaign.sectorEntryRequest).id,
    sectorSession: view,
    survivors: view.units
      .filter((unit) => unit.side === 'player')
      .map((unit) => ({ ...unit, id: Number(unit.id) })),
  });
  assert.equal(present(next.missions['yatasto']).completed, true);
  assert.equal(present(next.characters[woundedId]).hp, wounded.hp);
  assert.equal(next.sectorEntryRequest, null);
});

void test('a deployment report that carries the view only as sectorState is refused', () => {
  const pair = visiting();
  const view = pair.battle;
  const retired = Object.assign(
    {
      type: 'leaveSector' as const,
      battleId: present(pair.campaign.sectorEntryRequest).id,
      survivors: view.units.filter((unit) => unit.side === 'player'),
    },
    { sectorState: view },
  );
  const refused = dispatchCampaign(pair.campaign, retired);
  assert.match(present(refused.lastError), /estado táctico/);
  assert.equal(
    present(refused.sectorEntryRequest).id,
    present(pair.campaign.sectorEntryRequest).id,
  );
});
