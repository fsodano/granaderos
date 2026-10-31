import {
  parseEditorJson,
  requireJsonDocument,
  readBuildingTemplate,
  isJsonValue,
} from '../apps/campaign-editor/web/lib/editor-documents.ts';
import type { SectorMapCommand } from '../apps/campaign-editor/domain/sector-map-command.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILDING_TEMPLATES } from '../packages/game/map-templates.js';
import { blankMap } from '../packages/game/map-schema.js';
import { editSectorMapDocument } from '../apps/campaign-editor/public/map-editing-api.js';

const fixtures = requireJsonDocument(
  parseEditorJson(
    readFileSync(
      new URL(
        '../apps/web/app/renderer-sandbox/generated-architecture-documents.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);

void test('renderer fixture documents match the independently packaged editor at every template rotation', () => {
  for (const [identifier, rawTemplate] of Object.entries(BUILDING_TEMPLATES)) {
    assert.ok(isJsonValue(rawTemplate));
    const template = readBuildingTemplate(rawTemplate);
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
          ...Array.from({ length: rotation / 90 }, (): SectorMapCommand => ({
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
