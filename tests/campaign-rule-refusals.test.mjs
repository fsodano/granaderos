import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { GameUnitOfWork } from '../packages/game/infrastructure/persistence/game-unit-of-work.ts';
import { DomainRefusal, DomainRefusalCode } from '../packages/game/domain/shared/domain-refusal.ts';
import { CampaignRuleRefusal } from '../packages/game/infrastructure/shared/campaign-rule-refusal.ts';
import { domainRefusalMessage } from '../packages/game/infrastructure/shared/domain-refusal-message.js';
import { CampaignRecruitCombatantRepository } from '../packages/game/infrastructure/personnel/campaign-recruit-combatant.repository.js';
import { CampaignRecruitmentMapper } from '../packages/game/infrastructure/personnel/campaign-recruitment-mapper.js';
import { CampaignRenewServiceContractRepository } from '../packages/game/infrastructure/personnel/campaign-renew-service-contract.repository.js';
import { CampaignTalkToCharacterRepository } from '../packages/game/infrastructure/session/talk-to-character-repository.js';
import { CreateGameSessionUseCase } from '../packages/game/application/create-game-session/create-game-session.use-case.ts';
import { RestoreGameUseCase } from '../packages/game/application/restore-game/restore-game.use-case.ts';
import { SaveGameUseCase } from '../packages/game/application/save-game/save-game.use-case.ts';
import { readyLocal } from './local-contract-fixture.mjs';

function expectCampaignRefusal(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof DomainRefusal);
    assert.ok(error instanceof CampaignRuleRefusal);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.notEqual(domainRefusalMessage(error), code);
    assert.ok(domainRefusalMessage(error).length > 0);
    return true;
  });
}

test('recruitment eligibility and service quote refusals retain typed codes without changing the model', () => {
  const campaign = initialCampaign();
  const before = structuredClone(campaign);
  const transaction = new GameUnitOfWork(campaign, structuredClone);
  expectCampaignRefusal(
    () =>
      new CampaignRecruitCombatantRepository(transaction).load({
        characterId: '999999',
        term: 'day',
      }),
    DomainRefusalCode.CandidateIneligible,
  );
  const candidate = rosterFor(campaign).find((character) => character.id === 110);
  expectCampaignRefusal(
    () =>
      new CampaignRecruitmentMapper(transaction).restore(candidate, 'unknown-term', [
        campaign.location,
      ]),
    DomainRefusalCode.ServiceTermsUnavailable,
  );
  assert.deepEqual(transaction.draft, before);
  assert.deepEqual(campaign, before);
});

test('renewal and conversation expected refusals retain their player explanations and publish no state', () => {
  const campaign = dispatchCampaign(initialCampaign(), {
    type: 'recruitCivic',
    id: 110,
    term: 'day',
  });
  assert.equal(campaign.lastError, null);
  const transaction = new GameUnitOfWork(campaign, structuredClone);
  expectCampaignRefusal(
    () =>
      new CampaignRenewServiceContractRepository(transaction).load({
        characterId: '110',
        term: 'unknown-term',
      }),
    DomainRefusalCode.ServiceTermsUnavailable,
  );
  assert.deepEqual(transaction.draft, campaign);
  const pair = readyLocal();
  const before = structuredClone(pair);
  expectCampaignRefusal(
    () =>
      new CampaignTalkToCharacterRepository(pair.campaign, pair.battle).resolve({
        characterId: 'unknown-resident',
        speakerId: pair.battle.units.find((unit) => unit.side === 'player').id,
        approach: 'recruit',
        serviceTerm: 'day',
      }),
    DomainRefusalCode.ConversationUnavailable,
  );
  assert.deepEqual(pair, before);
});

test('session and save use cases return typed refusals before repository effects', () => {
  assert.throws(
    () =>
      new CreateGameSessionUseCase({
        create() {
          assert.fail('must not create');
        },
      }).execute({ seed: -1 }),
    { code: DomainRefusalCode.InvalidGameSeed },
  );
  assert.throws(
    () =>
      new RestoreGameUseCase({
        read: () => '',
        restore() {
          assert.fail('must not restore');
        },
      }).execute(),
    { code: DomainRefusalCode.SavedGameUnavailable },
  );
  const current = { sessionId: 'session', revision: 2, requestId: 'new' };
  assert.throws(
    () =>
      new SaveGameUseCase({
        current: () => current,
        serialize() {
          assert.fail('must not serialize');
        },
        persist() {
          assert.fail('must not persist');
        },
      }).execute({ ...current, requestId: 'old' }),
    { code: DomainRefusalCode.RevisionConflict },
  );
});
