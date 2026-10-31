import assert from 'node:assert/strict';
import { parseJsonObject } from '../packages/campaign-format/json-value.ts';
import test from 'node:test';
import { defaultContentPackage } from '../packages/game/content-package.js';
import {
  createCampaignSandbox,
  dispatchCampaignSandbox,
  encodeCampaignSandbox,
  decodeCampaignSandbox,
} from '../packages/game/public/campaign-playtest-api.ts';

void test('editor sandbox preserves an admitted game and its action receipts', () => {
  const content = defaultContentPackage();
  const initial = createCampaignSandbox(content, 18130203);
  const advanced = dispatchCampaignSandbox(initial, { type: 'wait', hours: 1 });
  assert.equal(advanced.lastError, null);
  assert.equal(advanced.history.length, 1);
  const restored = decodeCampaignSandbox(encodeCampaignSandbox(advanced), content);
  assert.deepEqual(restored.history, advanced.history);
  assert.equal(restored.campaign.hour, advanced.campaign.hour);
  assert.equal(restored.campaign.resources.treasury, advanced.campaign.resources.treasury);
});

void test('editor sandbox rejects malformed receipts before displaying imported history', () => {
  const content = defaultContentPackage();
  const encoded = encodeCampaignSandbox(createCampaignSandbox(content));
  const valid = { action: { type: 'wait', hours: 1 }, hour: 0, second: 0, treasury: 100 };
  for (const entry of [
    null,
    {},
    { ...valid, action: [] },
    { ...valid, action: { type: '' } },
    { ...valid, hour: -1 },
    { ...valid, second: 3600 },
    { ...valid, treasury: -1 },
  ]) {
    const malformed = parseJsonObject(encoded);
    malformed['history'] = [entry];
    assert.throws(() => decodeCampaignSandbox(JSON.stringify(malformed), content), /historial/);
  }
});
