import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignContentSchema } from '../packages/campaign-format/content-schema.js';
import { validateMapDocument } from '../packages/campaign-format/map-schema.js';
import { validateWorldData as validateWorldSchema } from '../packages/campaign-format/world-schema.js';
import { DEFAULT_CONTENT, DEFAULT_WORLD, DEFAULT_MAPS } from '../content/campaigns/default.js';
import { validateContentPackage } from '../packages/game/content-package.js';
import { validateMap } from '../packages/game/map-schema.js';
import { validateWorldData } from '../packages/game/campaign-world-validation.js';
import { dialoguePackage } from './dialogue-fixture.ts';
import { questPackage } from './content-quest-fixture.ts';

void test('shipped and authored dialogue packages share neutral file admission before game rules', () => {
  for (const content of [DEFAULT_CONTENT, dialoguePackage(), questPackage()]) {
    const before = structuredClone(content);
    assert.deepEqual(
      new CampaignContentSchema().validate(
        content,
        ('world' in content ? content.world : undefined) ?? DEFAULT_WORLD,
      ),
      [],
    );
    assert.deepEqual(validateContentPackage(content), []);
    assert.deepEqual(content, before);
  }
});

void test('game retains supported building and traversable map rules after shared document validation', () => {
  const map = structuredClone(DEFAULT_MAPS.retiro);
  present(map.buildings[0]).architecture = 'future-architecture';
  assert.equal(validateMapDocument(map).valid, true);
  assert.match(validateMap(map).errors.join('\n'), /Edificio no válido/);
  const unsupported = structuredClone(DEFAULT_CONTENT);
  present(unsupported.weapons[0]).template = 99999;
  assert.deepEqual(new CampaignContentSchema().validate(unsupported, DEFAULT_WORLD), []);
  assert.match(validateContentPackage(unsupported).join('\n'), /familia/);
});

void test('enemy headquarters exclusion stays a runtime campaign policy', () => {
  const base = structuredClone(DEFAULT_WORLD);
  const headquarters = base.defaultHeadquarters;
  const theater = present(base.sectors.find((sector) => sector.id === headquarters)).theater;
  const world = {
    ...base,
    enemyStrategy: {
      version: 1,
      theaters: {
        [theater]: { legHours: 1, reserve: 1, raidEveryHours: 24, axis: [headquarters] },
      },
    },
  };
  assert.deepEqual(validateWorldSchema(world), []);
  assert.match(validateWorldData(world).join('\n'), /no puede incluir el cuartel general/);
});
