import test from 'node:test';
import assert from 'node:assert/strict';
import { readyLocal, localNPC, localId } from './local-contract-fixture.mjs';
import { TalkToCharacterUseCase } from '../game/application/talk-to-character/talk-to-character.use-case.ts';
import { CampaignTalkToCharacterRepository } from '../game/infrastructure/session/talk-to-character-repository.js';
import { ConversationParticipantProjection } from '../game/infrastructure/session/conversation-participant-projection.js';
import { encodeSave, decodeSave } from '../game/save.js';
import { dispatchCampaignSandbox } from '../game/public/campaign-playtest-api.js';

function conversationRequest(pair) {
  return {
    characterId: localNPC(pair.battle).id,
    speakerId: pair.battle.units.find((participant) => participant.side === 'player').id,
    approach: 'recruit',
    serviceTerm: 'day',
  };
}

test('local recruitment publishes one character at the same position and survives save restoration', () => {
  const pair = readyLocal();
  const before = structuredClone(pair);
  const resident = localNPC(pair.battle);
  const result = new TalkToCharacterUseCase(
    new CampaignTalkToCharacterRepository(pair.campaign, pair.battle),
  ).execute(conversationRequest(pair));
  const identifier = localId(result.campaign);
  assert.equal(result.campaign.gameRevision, (pair.campaign.gameRevision ?? 0) + 1);
  assert.equal(
    result.sectorSession.npcs.some((character) => character.id === resident.id),
    false,
  );
  const participants = result.sectorSession.units.filter(
    (character) => Number(character.id) === identifier,
  );
  assert.equal(participants.length, 1);
  assert.equal(participants[0].x, resident.x);
  assert.equal(participants[0].y, resident.y);
  assert.equal(participants[0].tacticalLevel ?? 0, resident.tacticalLevel ?? 0);
  assert.deepEqual(pair, before);
  const restored = decodeSave(encodeSave(result.campaign, result.sectorSession));
  assert.equal(
    restored.battle.units.filter((character) => Number(character.id) === identifier).length,
    1,
  );
  assert.ok(restored.campaign.recruited.includes(identifier));
});

test('live and editor conversations resolve through the same projection and revision', () => {
  const pair = readyLocal();
  const request = conversationRequest(pair);
  const live = new TalkToCharacterUseCase(
    new CampaignTalkToCharacterRepository(pair.campaign, pair.battle),
  ).execute(request);
  const editor = dispatchCampaignSandbox(
    { ...pair, version: 1, history: [], lastError: null },
    {
      type: 'talk',
      npcId: request.characterId,
      unitId: request.speakerId,
      approach: request.approach,
      term: request.serviceTerm,
    },
  );
  assert.equal(editor.lastError, null);
  assert.deepEqual(editor.campaign, live.campaign);
  assert.deepEqual(editor.battle, live.sectorSession);
});

test('projection failure and stale source revisions cannot publish a partially paid recruitment', () => {
  const pair = readyLocal();
  const before = structuredClone(pair);
  const failedProjection = {
    apply() {
      throw new Error('Projection unavailable');
    },
  };
  assert.throws(
    () =>
      new TalkToCharacterUseCase(
        new CampaignTalkToCharacterRepository(pair.campaign, pair.battle, failedProjection),
      ).execute(conversationRequest(pair)),
    /Projection unavailable/,
  );
  assert.deepEqual(pair, before);
  const repository = new CampaignTalkToCharacterRepository(
    pair.campaign,
    pair.battle,
    new ConversationParticipantProjection(),
  );
  repository.resolve(conversationRequest(pair));
  repository.projectParticipants();
  pair.campaign.gameRevision = (pair.campaign.gameRevision ?? 0) + 1;
  assert.throws(() => repository.commit(), /revision-conflict/);
  assert.equal(pair.campaign.resources.treasury, before.campaign.resources.treasury);
  assert.deepEqual(pair.campaign.recruited, before.campaign.recruited);
});
