import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave } from '../packages/game/save.js';
import { GameSnapshotMapper } from '../packages/game/infrastructure/persistence/game-snapshot-mapper.js';
import { enterAssault } from './assault-fixture.mjs';
import { visit, leave } from './local-contract-fixture.mjs';
import { initialCampaign as legacyCampaign } from './legacy-campaign-fixture.mjs';
import { scriptedBattleReport } from './scripted-battle-report.mjs';
import { RetainedSectorPresence } from '../packages/game/infrastructure/world/retained-sector-presence.js';

function order(campaign, action) {
  const next = dispatchCampaign(campaign, action);
  assert.equal(next.lastError, null, next.lastError);
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

test('restoration owns the current inventory once after a character leaves one sector and enters another', () => {
  const campaign = returnedFromRetiro();
  const archivalUnits = structuredClone(campaign.sectorStates.retiro.units);
  const pair = prepareCampaignBattle(enterAssault(campaign, 'buenos_aires'));
  assert.equal(pair.error, null);
  const mapper = new GameSnapshotMapper(() => 'retained-ownership');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const inventory = game.inventory(pair.battle.sectorSession.id, '110');
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
  assert.equal(restored.inventory(pair.battle.sectorSession.id, '110').quantityOf('primary'), 0);
  assert.deepEqual(restored.snapshot().campaign.sectorStates.retiro.units, archivalUnits);
  assert.equal(
    restored.snapshot().battle.units.find((unit) => unit.id === '110').weaponDropped,
    true,
  );
  assert.throws(() => restored.sectorSession(campaign.sectorStates.retiro.sectorSession.id));
});

test('a travelling character does not occupy the archived departure position', () => {
  const campaign = dispatchCampaign(returnedFromRetiro(), {
    type: 'attack',
    sector: 'buenos_aires',
    queue: true,
  });
  assert.equal(campaign.lastError, null);
  assert.ok(campaign.squads.find((squad) => squad.id === campaign.activeSquadId).journey);
  const game = new GameSnapshotMapper().restore(encodeSave(campaign));
  assert.equal(game.world.object('Sector', 'retiro').toSnapshot().participants.length, 0);
  assert.deepEqual(game.snapshot().campaign.sectorStates.retiro, campaign.sectorStates.retiro);
});

test('a transferred militia member owns inventory only at the current garrison and visit', () => {
  let campaign = legacyCampaign(12);
  campaign.sectors.retiro.militia = [1, 0, 0];
  campaign = leave(visit(campaign));
  const militiaId = campaign.garrisons.retiro[0].id;
  const archivalUnits = structuredClone(campaign.sectorStates.retiro.units);
  campaign = order(campaign, {
    type: 'transferMilitia',
    from: 'retiro',
    to: 'buenos_aires',
    rank: 0,
    count: 1,
  });
  assert.equal(campaign.garrisons.retiro.length, 0);
  assert.equal(campaign.garrisons.buenos_aires[0].id, militiaId);
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
  const inventory = game.inventory(pair.battle.sectorSession.id, String(militiaId));
  assert.equal(
    game.identities.obtain('Inventory', `character:${militiaId}`, () =>
      assert.fail('duplicate militia inventory'),
    ),
    inventory,
  );
  const character = game.participant(pair.battle.sectorSession.id, String(militiaId)).character;
  const previousHealth = character.health.toSnapshot().current;
  character.health.sufferInjury(7, 1);
  inventory.take('primary', 1);
  game.session.acceptRevision(pair.campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  assert.equal(
    restored.inventory(pair.battle.sectorSession.id, String(militiaId)).quantityOf('primary'),
    0,
  );
  assert.equal(
    restored
      .participant(pair.battle.sectorSession.id, String(militiaId))
      .character.health.toSnapshot().current,
    previousHealth - 7,
  );
  const restoredMilitia = restored
    .snapshot()
    .battle.units.find((unit) => unit.id === String(militiaId));
  assert.equal(restoredMilitia.hp, previousHealth - 7);
  assert.equal(restoredMilitia.bleeding, 1);
  assert.deepEqual(restored.snapshot().campaign.sectorStates.retiro.units, archivalUnits);
  assert.deepEqual(pair, input);
});

test('mission ally archives follow canonical location and retain their historical equipment', () => {
  let campaign = legacyCampaign(12);
  campaign.phase = 1;
  campaign.flags.academy = true;
  campaign.sectors.san_nicolas.owner = 'patriot';
  campaign = order(campaign, { type: 'travel', sector: 'san_nicolas' });
  campaign = order(campaign, { type: 'attack', sector: 'san_lorenzo' });
  campaign = order(campaign, scriptedBattleReport(campaign));
  const ally = campaign.sectorStates.san_lorenzo.units.find((unit) => unit.missionAlly);
  assert.equal(ally.id, '57');
  const beforeRelocation = new RetainedSectorPresence(campaign);
  assert.equal(beforeRelocation.includes(ally, campaign.sectorStates.san_lorenzo), true);
  campaign.operativeState[57].location = 'cordoba';
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
    game.snapshot().campaign.sectorStates.san_lorenzo.units,
    input.sectorStates.san_lorenzo.units,
  );
  assert.deepEqual(campaign, input);
});

test('active and suspended auxiliary registrations exclude only living archive copies', () => {
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
