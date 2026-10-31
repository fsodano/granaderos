import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDraftPatch, selectValue } from '../web/lib/editor-values.ts';
import {
  isJsonValue,
  parseEditorJson,
  replaceCampaignContentField,
  readBuildingTemplate,
} from '../web/lib/editor-documents.ts';
import {
  defaultContentPackage,
  BUILDING_TEMPLATES,
} from '../../../packages/game/public/campaign-editor-api.ts';

await test('optional draft removal preserves the original and removes the saved key', () => {
  const original = { id: 'character', nickname: 'Kerr', skinTone: 'brown' };
  const result = applyDraftPatch(original, { nickname: 'Alistair', skinTone: undefined });
  assert.deepEqual(result, { id: 'character', nickname: 'Alistair' });
  assert.equal(original.skinTone, 'brown');
  assert.equal(Object.hasOwn(result, 'skinTone'), false);
});

await test('selection values must belong to their declared options', () => {
  assert.equal(selectValue('active', ['active', 'completed']), 'active');
  assert.throws(() => selectValue('missing', ['active', 'completed']), /no válido/);
});

await test('raw document parsing accepts JSON and rejects non-JSON values', () => {
  assert.deepEqual(parseEditorJson('{"chapters": [], "title": "Campaña"}'), {
    chapters: [],
    title: 'Campaña',
  });
  assert.equal(isJsonValue({ missing: undefined }), false);
  assert.equal(isJsonValue({ value: Infinity }), false);
  assert.throws(() => parseEditorJson('{ broken }'), SyntaxError);
});

await test('structured campaign sections reject invalid JSON before replacing the content', () => {
  const content = defaultContentPackage();
  assert.throws(
    () => replaceCampaignContentField(content, 'roadsideDiscoveries', 'invalid'),
    /Hallazgo|Hallazgos|hallazgo/,
  );
  assert.equal(typeof content.roadsideDiscoveries, 'object');
  const result = replaceCampaignContentField(content, 'roadsideDiscoveries', []);
  assert.deepEqual(result.roadsideDiscoveries, []);
  assert.notEqual(result, content);
});

await test('published building templates remain valid in the typed editor admission boundary', () => {
  for (const [id, value] of Object.entries(BUILDING_TEMPLATES)) {
    const template = readBuildingTemplate(value);
    assert.equal(template.version, 1, id);
    assert.equal(template.building.id, value.building.id, id);
    assert.deepEqual(template.props, value.props, id);
  }
  assert.throws(() => readBuildingTemplate({ version: 1, building: {} }), /edificio|Objeto|mapa/i);
});
