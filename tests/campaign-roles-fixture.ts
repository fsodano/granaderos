import { present } from './assert-present.ts';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { DEFAULT_FOUNDRY } from '../packages/game/campaign-foundry.js';
import { defaultCampaignStory } from '../packages/game/campaign-story.js';
export function rolePackage() {
  const d = defaultContentPackage();
  d.foundry = structuredClone(DEFAULT_FOUNDRY);
  const base = present(d.characters.find((c) => c.id === 'person-110'));
  d.characters = [
    {
      ...structuredClone(base),
      id: 'vanguard',
      name: 'Lucía de la Guardia',
      nickname: 'Lucía',
      arrivalHours: 0,
    },
    {
      ...structuredClone(base),
      id: 'engineer',
      name: 'Elena del Taller',
      nickname: 'Elena',
      arrivalHours: 6,
    },
  ];
  d.placements = [];
  d.errands = [];
  d.includeOriginalResidents = false;
  d.campaignStory = defaultCampaignStory();
  present(d.campaignStory.chapters[0]).conditions = [{ type: 'day', min: 100, max: null }];
  present(d.rules).startingHour = 0;
  present(d.rules).startingTreasury = 10000;
  present(present(d.startingTerritory)['mendoza']).owner = 'patriot';
  present(present(d.startingTerritory)['buenos_aires']).owner = 'patriot';
  d.campaignRoles = { foundryEngineer: 'engineer', marchCommander: 'engineer' };
  return d;
}
