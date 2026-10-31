import type { CampaignFixtureDocuments } from './campaign-library-fixture.ts';
import { fixtureManifest, fixtureMapIndex } from './campaign-library-fixture.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignPresentation as validatePresentationSchema } from '../packages/campaign-format/presentation-schema.js';
import { validateCampaignPresentation } from '../packages/game/campaign-presentation-validation.js';
import { defaultContentPackage, validateContentPackage } from '../packages/game/content-package.js';
import { DEFAULT_PRESENTATION, DEFAULT_WORLD, DEFAULT_MAPS } from '../content/campaigns/default.js';
import { compileCampaignPackage } from '../packages/game/campaign-library.js';
import { campaignDocuments, alternateCampaignDocuments } from './campaign-library-fixture.ts';

function compile(documents: CampaignFixtureDocuments, id: string) {
  const root = `/campaigns/${id}/`;
  const manifest = fixtureManifest(documents.get(`${root}manifest.json`));
  const index = fixtureMapIndex(documents.get(root + manifest.maps));
  const mapRoot = root + manifest.maps.slice(0, manifest.maps.lastIndexOf('/') + 1);
  return compileCampaignPackage(manifest, {
    content: documents.get(root + manifest.content),
    world: documents.get(root + manifest.world),
    maps: Object.fromEntries(index.maps.map((map) => [map.id, documents.get(mapRoot + map.path)])),
    presentation: documents.get(root + manifest.presentation),
    assets: documents.get(root + manifest.assets),
  });
}

void test('published presentation admission preserves compiled stock and custom campaigns', () => {
  const stock = compile(campaignDocuments, 'granaderos');
  const alternate = alternateCampaignDocuments();
  const custom = compile(alternate.docs, 'another');
  for (const campaign of [stock, custom]) {
    assert.deepEqual(validatePresentationSchema(campaign.presentation, campaign), []);
    assert.deepEqual(validateCampaignPresentation(campaign.presentation, campaign), []);
    assert.deepEqual(validateContentPackage(campaign), []);
  }
});

void test('game presentation admission retains renderer, fitting and numeric character checks', () => {
  const content = { ...defaultContentPackage(), world: DEFAULT_WORLD, maps: DEFAULT_MAPS };
  for (const change of [
    (value: typeof DEFAULT_PRESENTATION) => {
      present(value.characterPortraits[0]).spriteAppearance = 'not-a-supported-sprite';
    },
    (value: typeof DEFAULT_PRESENTATION) => {
      Reflect.set(
        present(value.officerCreation.classes[0]),
        'bladeFittingPattern',
        'not-a-supported-fitting',
      );
    },
    (value: typeof DEFAULT_PRESENTATION) => {
      value.skirmish.operativeIds = [99999];
    },
  ]) {
    const presentation = structuredClone(DEFAULT_PRESENTATION);
    change(presentation);
    assert.deepEqual(validatePresentationSchema(presentation, content), []);
    assert.ok(validateCampaignPresentation(presentation, content).length);
  }
});
