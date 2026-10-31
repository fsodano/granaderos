import assert from 'node:assert/strict';
import type { PhysicalMap } from '../types.ts';
import { validateMapDocument } from '../map-schema.js';
import publishedWorld from '../../../content/campaigns/granaderos/world.json' with { type: 'json' };
import { maps as publishedMaps } from '../../../content/campaigns/granaderos/maps/library.js';

export function definitionWorld() {
  const world = structuredClone(publishedWorld);
  return { ...world, defaultRoles: { foundryEngineer: null, marchCommander: null } };
}

export function definitionMaps(): Record<string, PhysicalMap> {
  const maps = structuredClone(publishedMaps);
  for (const map of Object.values(maps)) {
    for (const building of [...map.buildings, ...(map.decor ?? [])]) {
      if ('asset' in building && building.asset) {
        building.asset = 'data:image/png;base64,AA==';
      }
    }
  }
  const result: Record<string, PhysicalMap> = {};
  for (const [id, value] of Object.entries(maps)) {
    assertMap(value);
    result[id] = value;
  }
  return result;
}

function assertMap(value: unknown): asserts value is PhysicalMap {
  assert.deepEqual(validateMapDocument(value).errors, []);
}
