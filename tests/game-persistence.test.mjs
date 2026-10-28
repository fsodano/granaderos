import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import { encodeSave, decodeSave } from '../packages/game/save.js';
import { Money } from '../packages/game/domain/finance/money.ts';
import { Character } from '../packages/game/domain/personnel/character.ts';
import { ServiceContract } from '../packages/game/domain/personnel/service-contract.ts';
import { GameSnapshotMapper } from '../packages/game/infrastructure/persistence/game-snapshot-mapper.js';
import { RestoreGameUseCase } from '../packages/game/application/restore-game/restore-game.use-case.ts';
import { SerializedRestoreGameRepository } from '../packages/game/infrastructure/persistence/restore-game.repository.js';
import { createNewGameSession, restoreGameSnapshot } from '../packages/game/public/game-persistence-api.js';

function recruited() {
  const campaign = dispatchCampaign(initialCampaign(12), {
    type: 'recruitCivic',
    id: 110,
    term: 'week',
  });
  assert.equal(campaign.lastError, null);
  return campaign;
}

test('restoration migrates legacy identity and restores behavior without recruitment effects or time', () => {
  const campaign = recruited();
  const before = structuredClone(campaign);
  const mapper = new GameSnapshotMapper(() => 'restored-session');
  const useCase = new RestoreGameUseCase(
    new SerializedRestoreGameRepository(encodeSave(campaign), mapper),
  );
  const game = useCase.execute();
  const character = game.personnel.character('110');
  assert.ok(character instanceof Character);
  assert.ok(character.service instanceof ServiceContract);
  assert.throws(() => character.assertAvailableForService());
  assert.equal(
    game.identities.obtain('Character', '110', () => assert.fail('duplicate character')),
    character,
  );
  const restored = game.snapshot().campaign;
  const { gameSessionId, ...state } = restored;
  assert.equal(gameSessionId, 'restored-session');
  assert.deepEqual(state, before);
  assert.deepEqual(campaign, before);
  assert.equal(character.service.payment.pesos, campaign.contracts[110].paid);
});

test('restored objects project accepted behavior back into one versioned snapshot', () => {
  const campaign = recruited();
  const mapper = new GameSnapshotMapper(() => 'mapped-session');
  const game = mapper.restore(encodeSave(campaign));
  game.personnel.treasury.pay(Money.pesos(7));
  game.session.acceptRevision(campaign.gameRevision);
  const saved = mapper.serialize(game);
  const envelope = JSON.parse(saved);
  assert.deepEqual(envelope.mapping, {
    version: 1,
    sessionId: 'mapped-session',
    revision: campaign.gameRevision + 1,
  });
  const restored = mapper.restore(saved);
  assert.equal(restored.personnel.treasury.balance.pesos, campaign.resources.treasury - 7);
  assert.deepEqual(
    restored.personnel.character('110').service.snapshot(),
    game.personnel.character('110').service.snapshot(),
  );
});

test('active sector participants use the canonical character identity and retain paid action points', () => {
  const campaign = dispatchCampaign(recruited(), { type: 'visitSector' });
  const pair = prepareCampaignBattle(campaign);
  assert.equal(pair.error, null);
  const mapper = new GameSnapshotMapper(() => 'sector-session');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const unit = pair.battle.units.find((unit) => unit.side === 'player');
  const participation = game.participant(pair.battle.sectorSession.id, String(unit.id));
  assert.equal(participation.character, game.personnel.character(String(unit.id)));
  participation.participant.spend(1);
  const projected = game.snapshot();
  assert.equal(
    projected.battle.units.find((candidate) => candidate.id === unit.id).ap,
    unit.ap - 1,
  );
  assert.equal(projected.campaign.hour, pair.campaign.hour);
  assert.deepEqual(projected.campaign.contracts, pair.campaign.contracts);
  assert.deepEqual(projected.campaign.ammunition, pair.campaign.ammunition);
});

test('save metadata refuses unsupported versions, missing metadata, and mismatched identity or revision', () => {
  const campaign = createNewGameSession(27);
  const valid = JSON.parse(encodeSave(campaign));
  for (const mutate of [
    (value) => {
      value.mapping.version = 99;
    },
    (value) => {
      value.mapping.sessionId = 'another-session';
    },
    (value) => {
      value.mapping.revision += 1;
    },
    (value) => {
      delete value.mapping;
    },
  ]) {
    const malformed = structuredClone(valid);
    mutate(malformed);
    assert.throws(() => restoreGameSnapshot(JSON.stringify(malformed)));
  }
  assert.equal(decodeSave(JSON.stringify(valid)).campaign.gameSessionId, campaign.gameSessionId);
  assert.notEqual(createNewGameSession(27).gameSessionId, campaign.gameSessionId);
});

test('restored active squad and force roster share membership ownership', () => {
  const campaign = recruited();
  const mapper = new GameSnapshotMapper(() => 'squad-session');
  const game = mapper.restore(encodeSave(campaign));
  const squad = game.personnel.squad(campaign.activeSquadId);
  assert.equal(
    game.identities.obtain('Squad', campaign.activeSquadId, () => assert.fail('duplicate squad')),
    squad,
  );
  squad.replaceMembers([]);
  assert.deepEqual(game.personnel.roster.squadMembers, []);
  game.session.acceptRevision(campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  const snapshot = restored.snapshot().campaign;
  assert.deepEqual(snapshot.squad, []);
  assert.deepEqual(
    snapshot.squads.find((record) => record.id === campaign.activeSquadId).members,
    [],
  );
  assert.ok(snapshot.recruited.includes(110));
  assert.deepEqual(snapshot.contracts, campaign.contracts);
});

test('restored tactical inventory projects depleted equipment without creation effects', () => {
  const campaign = dispatchCampaign(recruited(), { type: 'visitSector' });
  const pair = prepareCampaignBattle(campaign);
  const mapper = new GameSnapshotMapper(() => 'inventory-session');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const unit = pair.battle.units.find((unit) => unit.side === 'player');
  const inventory = game.inventory(pair.battle.sectorSession.id, String(unit.id));
  assert.equal(
    game.identities.obtain('Inventory', `character:${unit.id}`, () =>
      assert.fail('duplicate inventory'),
    ),
    inventory,
  );
  assert.equal(inventory.quantityOf('primary'), 1);
  inventory.take('primary', 1);
  game.session.acceptRevision(pair.campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  assert.equal(
    restored.inventory(pair.battle.sectorSession.id, String(unit.id)).quantityOf('primary'),
    0,
  );
  assert.equal(restored.snapshot().campaign.resources.treasury, pair.campaign.resources.treasury);
  assert.deepEqual(restored.snapshot().campaign.contracts, pair.campaign.contracts);
  assert.equal(restored.snapshot().campaign.hour, pair.campaign.hour);
});

test('restored character health projects to both campaign and active physical participation', () => {
  const pair = prepareCampaignBattle(dispatchCampaign(recruited(), { type: 'visitSector' }));
  const mapper = new GameSnapshotMapper(() => 'health-session');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const character = game.personnel.character('110');
  const before = character.health.toSnapshot();
  character.health.sufferInjury(7, 2);
  game.session.acceptRevision(pair.campaign.gameRevision);
  const restored = mapper.restore(mapper.serialize(game));
  const snapshot = restored.snapshot();
  assert.equal(restored.personnel.character('110').health.toSnapshot().current, before.current - 7);
  assert.equal(snapshot.campaign.operativeState[110].hp, before.current - 7);
  assert.equal(
    snapshot.battle.units.find((unit) => String(unit.id) === '110').hp,
    before.current - 7,
  );
  assert.equal(snapshot.battle.units.find((unit) => String(unit.id) === '110').bleeding, 2);
});
