import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignStory, defaultCampaignStory } from '../packages/game/campaign-story.js';
import { validateCampaignEvents } from '../packages/game/campaign-events.js';
import { defaultContentPackage, validateContentPackage } from '../packages/game/content-package.js';
import { campaignWorld } from '../packages/game/campaign-definition.js';

function authoredContent() {
  const content = defaultContentPackage();
  content.errands = [];
  content.world = structuredClone(present(campaignWorld()));
  content.campaignStory = defaultCampaignStory();
  present(content.campaignStory.chapters[0]).conditions = [
    { type: 'sector', sector: 'retiro', owner: 'patriot' },
  ];
  content.campaignEvents = [
    {
      id: 'funding',
      atHour: 24,
      text: 'Llegan recursos.',
      conditions: [{ type: 'sector', sector: 'retiro', owner: 'patriot' }],
      effects: [{ type: 'treasury', operation: 'receive', amount: 20 }],
    },
  ];
  return content;
}

void test('game content admission uses shared story and event references with explicit world context', () => {
  const content = authoredContent();
  assert.deepEqual(validateContentPackage(content), []);
  const condition = present(present(present(content.campaignEvents)[0]).conditions[0]);
  assert.ok(condition.type === 'sector');
  condition.sector = 'missing';
  assert.match(validateContentPackage(content).join('\n'), /localidad/);
});

void test('legacy story and event validation retains its default world context', () => {
  const content = authoredContent();
  delete content.world;
  assert.doesNotThrow(() =>
    validateCampaignStory(content.campaignStory, new Set(), new Set(), content),
  );
  assert.deepEqual(validateCampaignEvents(content.campaignEvents, content), []);
});
