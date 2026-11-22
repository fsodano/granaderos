import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, drawCampaignRandom } from '../packages/game/campaign.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { RandomSource } from '../packages/game/domain/shared/random-source.ts';
import { GameSession } from '../packages/game/domain/session/game-session.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';

void test('a restored game repeats the random sequence it saved', () => {
  const campaign = initialCampaign(1812);
  const savedSeed = campaign.seed;
  const restored = decodeSave(encodeSave(campaign)).campaign;
  assert.equal(restored.seed, savedSeed);
  const original = RandomSource.restore({ seed: savedSeed });
  const resumed = RandomSource.restore({ seed: restored.seed });
  assert.deepEqual(
    [resumed.next(), resumed.next(), resumed.next()],
    [original.next(), original.next(), original.next()],
  );
});

void test('the campaign draws through the session the same values as the retained helper', () => {
  const legacyRandom = (campaign: CampaignSnapshot): number => {
    const source = RandomSource.restore({ seed: campaign.seed });
    const value = source.next();
    campaign.seed = source.snapshot().seed;
    return value;
  };
  const legacyDraft = initialCampaign(1812);
  const sessionDraft = initialCampaign(1812);
  const session = GameSession.create('game-1', sessionDraft.seed);
  const legacyAttackSeed = Math.floor(legacyRandom(legacyDraft) * 4294967296);
  const sessionAttackSeed = Math.floor(drawCampaignRandom(session, sessionDraft) * 4294967296);
  const legacyDelay = 4 + Math.floor(legacyRandom(legacyDraft) * 9);
  const sessionDelay = 4 + Math.floor(drawCampaignRandom(session, sessionDraft) * 9);
  assert.equal(sessionAttackSeed, legacyAttackSeed);
  assert.equal(sessionDelay, legacyDelay);
  assert.equal(sessionDraft.seed, legacyDraft.seed);
});
