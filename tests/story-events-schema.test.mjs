import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignStory, defaultCampaignStory } from '../game/campaign-story.js';
import { validateCampaignEvents } from '../game/campaign-events.js';
import { defaultContentPackage, validateContentPackage } from '../game/content-package.js';
import { DEFAULT_WORLD } from '../campaigns/default.js';

function authoredContent() {
  const content = defaultContentPackage();
  content.errands = [];
  content.world = structuredClone(DEFAULT_WORLD);
  content.campaignStory = defaultCampaignStory();
  content.campaignStory.chapters[0].conditions = [
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

test('game content admission uses shared story and event references with explicit world context', () => {
  const content = authoredContent();
  assert.deepEqual(validateContentPackage(content), []);
  content.campaignEvents[0].conditions[0].sector = 'missing';
  assert.match(validateContentPackage(content).join('\n'), /localidad/);
});

test('legacy story and event validation retains its default world context', () => {
  const content = authoredContent();
  delete content.world;
  assert.doesNotThrow(() =>
    validateCampaignStory(content.campaignStory, new Set(), new Set(), content),
  );
  assert.deepEqual(validateCampaignEvents(content.campaignEvents, content), []);
});
