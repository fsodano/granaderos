import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from '../packages/game/campaign.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { RandomSource } from '../packages/game/domain/shared/random-source.ts';

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
