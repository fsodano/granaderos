import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILDING_TEMPLATES } from '../game/map-templates.js';
import { blankMap } from '../game/map-schema.js';
import { editSectorMapDocument } from '../campaign-editor/public/map-editing-api.js';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../web/app/renderer-sandbox/generated-architecture-documents.json', import.meta.url),
    'utf8',
  ),
);

test('renderer fixture documents match the independently packaged editor at every template rotation', () => {
  for (const [identifier, template] of Object.entries(BUILDING_TEMPLATES)) {
    for (const rotation of [0, 90, 180, 270]) {
      const size = Math.max(template.building.width, template.building.height) + 10;
      const result = editSectorMapDocument(
        blankMap({
          id: `review-${identifier}-${rotation}`,
          title: template.name,
          width: size,
          height: size,
        }),
        [
          { type: 'stampTemplate', id: `review-${identifier}`, template, x: 4, y: 4 },
          ...Array.from({ length: rotation / 90 }, () => ({
            type: 'rotateObject',
            id: `review-${identifier}`,
          })),
        ],
      );
      assert.deepEqual(result.errors, [], `${identifier}:${rotation}`);
      assert.deepEqual(
        result.document,
        fixtures[`${identifier}:${rotation}`],
        `Regenerate renderer fixture ${identifier}:${rotation}`,
      );
    }
  }
});
