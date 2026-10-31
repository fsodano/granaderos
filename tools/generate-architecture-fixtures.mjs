import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BUILDING_TEMPLATES } from '../packages/game/map-templates.js';
import { blankMap } from '../packages/game/map-schema.js';
import { editSectorMapDocument } from '../apps/campaign-editor/public/map-editing-api.js';

const documents = {};
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
    if (result.errors.length) {
      throw new Error(result.errors.join('; '));
    }
    documents[`${identifier}:${rotation}`] = result.document;
  }
}
const roof = editSectorMapDocument(
  blankMap({ id: 'roof-climb', title: 'Roof climb', width: 18, height: 18 }),
  [
    { type: 'stampTemplate', id: 'climb-house', template: BUILDING_TEMPLATES.casa, x: 5, y: 5 },
    { type: 'setObject', id: 'climb-house', values: { roof: 'terrace' } },
  ],
);
if (roof.errors.length) {
  throw new Error(roof.errors.join('; '));
}
documents['roof-climb'] = roof.document;
const output = fileURLToPath(
  new URL(
    '../apps/web/app/renderer-sandbox/generated-architecture-documents.json',
    import.meta.url,
  ),
);
await writeFile(output, JSON.stringify(documents));
console.log(`Generated ${Object.keys(documents).length} architecture fixture documents.`);
