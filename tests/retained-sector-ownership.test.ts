import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave } from '../packages/game/save.ts';
import { GameSnapshotMapper } from '../packages/game/infrastructure/persistence/game-snapshot-mapper.js';
import { enterAssault } from './assault-fixture.ts';
import { visit, leave } from './local-contract-fixture.ts';
import { initialCampaign as legacyCampaign } from './legacy-campaign-fixture.ts';
import { scriptedBattleReport } from './scripted-battle-report.ts';
import { RetainedSectorPresence } from '../packages/game/infrastructure/world/retained-sector-presence.js';

function order(campaign: CampaignSnapshot, action: CampaignAction) {
  const next = dispatchCampaign(campaign, action);
  assert.equal(next.lastError, null, next.lastError ?? undefined);
  return next;
}

function returnedFromRetiro() {
  const recruited = dispatchCampaign(initialCampaign(12), {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'week',
  });
  assert.equal(recruited.lastError, null);
  return leave(visit(recruited));
}

void test('restoration owns the current inventory once after a character leaves one sector and enters another', () => {
  const campaign = returnedFromRetiro();
  const archivalUnits = structuredClone(present(campaign.sectorStates['retiro']).units);
  const pair = prepareCampaignBattle(enterAssault(campaign, 'buenos_aires'));
  assert.equal(pair.error, null);
  const mapper = new GameSnapshotMapper(() => 'retained-ownership');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const inventory = game.inventory(present(present(pair.battle).sectorSession).id, '110');
  assert.equal(
    game.identities.obtain('Inventory', 'character:110', () => assert.fail('duplicate inventory')),
    inventory,
  );
  const sector = game.world.object('Sector', 'retiro').toSnapshot();
  assert.equal(
    sector.participants.some((unit) => unit.characterId === 'character:110'),
    false,
  );
  inventory.take('primary', 1);
  game.session.acceptRevision(pair.campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  assert.equal(
    restored.inventory(present(present(pair.battle).sectorSession).id, '110').quantityOf('primary'),
    0,
  );
  assert.deepEqual(
    present(restored.snapshot().campaign.sectorStates['retiro']).units,
    archivalUnits,
  );
  assert.equal(
    present(present(restored.snapshot().battle).units.find((unit: BattleUnit) => unit.id === '110'))
      .weaponDropped,
    true,
  );
  assert.throws(() =>
    restored.sectorSession(present(present(campaign.sectorStates['retiro']).sectorSession).id),
  );
});

void test('a travelling character does not occupy the archived departure position', () => {
  const campaign = dispatchCampaign(returnedFromRetiro(), {
    type: 'attack',
    sector: 'buenos_aires',
    queue: true,
  });
  assert.equal(campaign.lastError, null);
  assert.ok(present(campaign.squads.find((squad) => squad.id === campaign.activeSquadId)).journey);
  const game = new GameSnapshotMapper().restore(encodeSave(campaign));
  assert.equal(game.world.object('Sector', 'retiro').toSnapshot().participants.length, 0);
  assert.deepEqual(
    game.snapshot().campaign.sectorStates['retiro'],
    campaign.sectorStates['retiro'],
  );
});

void test('a transferred militia member owns inventory only at the current garrison and visit', () => {
  let campaign = legacyCampaign(12);
  present(campaign.sectors['retiro']).militia = [1, 0, 0];
  campaign = leave(visit(campaign));
  const militiaId = present(present(campaign.garrisons['retiro'])[0]).id;
  const archivalUnits = structuredClone(present(campaign.sectorStates['retiro']).units);
  campaign = order(campaign, {
    type: 'transferMilitia',
    from: 'retiro',
    to: 'buenos_aires',
    rank: 0,
    count: 1,
  });
  assert.equal(present(campaign.garrisons['retiro']).length, 0);
  assert.equal(present(present(campaign.garrisons['buenos_aires'])[0]).id, militiaId);
  const mapper = new GameSnapshotMapper();
  const transferred = mapper.restore(encodeSave(campaign));
  assert.equal(
    transferred.world
      .object('Sector', 'retiro')
      .toSnapshot()
      .participants.some((participant) => participant.characterId === `character:${militiaId}`),
    false,
  );

  campaign = order(campaign, { type: 'travel', sector: 'buenos_aires' });
  const pair = visit(campaign);
  const input = structuredClone(pair);
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const inventory = game.inventory(
    present(present(pair.battle).sectorSession).id,
    String(militiaId),
  );
  assert.equal(
    game.identities.obtain('Inventory', `character:${militiaId}`, () =>
      assert.fail('duplicate militia inventory'),
    ),
    inventory,
  );
  const character = game.participant(
    present(present(pair.battle).sectorSession).id,
    String(militiaId),
  ).character;
  const previousHealth = character.health.toSnapshot().current;
  character.health.sufferInjury(7, 1);
  inventory.take('primary', 1);
  game.session.acceptRevision(pair.campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  assert.equal(
    restored
      .inventory(present(present(pair.battle).sectorSession).id, String(militiaId))
      .quantityOf('primary'),
    0,
  );
  assert.equal(
    restored
      .participant(present(present(pair.battle).sectorSession).id, String(militiaId))
      .character.health.toSnapshot().current,
    previousHealth - 7,
  );
  const restoredMilitia = present(restored.snapshot().battle).units.find(
    (unit: BattleUnit) => unit.id === String(militiaId),
  );
  assert.equal(present(restoredMilitia).hp, previousHealth - 7);
  assert.equal(present(restoredMilitia).bleeding, 1);
  assert.deepEqual(
    present(restored.snapshot().campaign.sectorStates['retiro']).units,
    archivalUnits,
  );
  assert.deepEqual(pair, input);
});

void test('mission ally archives follow canonical location and retain their historical equipment', () => {
  let campaign = legacyCampaign(12);
  campaign.phase = 1;
  campaign.flags['academy'] = true;
  present(campaign.sectors['san_nicolas']).owner = 'patriot';
  campaign = order(campaign, { type: 'travel', sector: 'san_nicolas' });
  campaign = order(campaign, { type: 'attack', sector: 'san_lorenzo' });
  campaign = order(campaign, scriptedBattleReport(campaign));
  const ally = present(campaign.sectorStates['san_lorenzo']).units.find((unit) => unit.missionAlly);
  assert.equal(present(ally).id, '57');
  const beforeRelocation = new RetainedSectorPresence(campaign);
  assert.equal(beforeRelocation.includes(ally, campaign.sectorStates['san_lorenzo']), true);
  present(campaign.operativeState[57]).location = 'cordoba';
  const input = structuredClone(campaign);
  const game = new GameSnapshotMapper().restore(encodeSave(campaign));
  assert.equal(
    game.world
      .object('Sector', 'san_lorenzo')
      .toSnapshot()
      .participants.some((participant) => participant.characterId === 'character:57'),
    false,
  );
  assert.deepEqual(
    present(game.snapshot().campaign.sectorStates['san_lorenzo']).units,
    present(input.sectorStates['san_lorenzo']).units,
  );
  assert.deepEqual(campaign, input);
});

void test('active and suspended auxiliary registrations exclude only living archive copies', () => {
  const ally = { id: '57', side: 'player', hp: 88, missionAlly: true };
  const militia = { id: '20000', side: 'player', hp: 60, militia: true };
  const field = { sectorId: 'retiro' };
  const request = {
    id: 'active',
    sector: 'buenos_aires',
    squad: [],
    missionAllies: [ally],
    garrison: [militia],
  };
  for (const visit of [{ pendingBattle: request }, { suspendedSectorSessions: [{ request }] }]) {
    const presence = new RetainedSectorPresence({
      ...visit,
      squads: [],
      operativeState: { 57: { alive: true, location: 'retiro' } },
      garrisons: { retiro: [militia] },
    });
    assert.equal(presence.includes(ally, field), false);
    assert.equal(presence.includes(militia, field), false);
    assert.equal(presence.includes({ ...ally, hp: 0 }, field), true);
    assert.equal(presence.includes({ ...militia, hp: 0 }, field), true);
  }
});
