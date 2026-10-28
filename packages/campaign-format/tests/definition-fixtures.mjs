import publishedWorld from '../../../content/campaigns/granaderos/world.json' with { type: 'json' };
import { maps as publishedMaps } from '../../../content/campaigns/granaderos/maps/library.js';

export function definitionWorld() {
  const world = structuredClone(publishedWorld);
  world.defaultRoles = { foundryEngineer: null, marchCommander: null };
  return world;
}

export function definitionMaps() {
  const maps = structuredClone(publishedMaps);
  for (const map of Object.values(maps)) {
    for (const building of [...map.buildings, ...(map.decor ?? [])]) {
      if (building.asset) building.asset = 'data:image/png;base64,AA==';
    }
  }
  return maps;
}
