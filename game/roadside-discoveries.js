import { validateRoadsideDiscoveries } from '../campaign-format/roadside-discovery-schema.js';
import { DEFAULT_CATALOGUE } from '../campaigns/default.js';
import { canonicalContent } from './content-identity.js';

export const ROADSIDE_DISCOVERY_CHEST = 'roadside:cell-24-27:clothing-tools';
export const ROADSIDE_CROWBAR_ID = 'cache:cell-24-27:crowbar';
export const ROADSIDE_SHIRT_ID = 'cache:cell-24-27:linen-shirt';
// This small fictional cache is game tuning. Only an explicit pinned record
// enables it; an omitted collection in an older campaign stays disabled.
export function freshDefaultRoadsideDiscoveries() {
  return structuredClone(DEFAULT_CATALOGUE.roadsideDiscoveries);
}
export function roadsideDiscoveryIds(definition) {
  if (definition.id === 'roadside-clothing-tools' && definition.cell === 'cell-24-27')
    return {
      chest: ROADSIDE_DISCOVERY_CHEST,
      crowbar: ROADSIDE_CROWBAR_ID,
      shirt: ROADSIDE_SHIRT_ID,
    };
  return {
    chest: `roadside:${definition.cell}:${definition.id}`,
    crowbar: `cache:${definition.cell}:${definition.id}:crowbar`,
    shirt: `cache:${definition.cell}:${definition.id}:linen-shirt`,
  };
}
export function roadsideDiscoveriesFor(campaign) {
  const definitions = campaign.contentCampaign
    ? campaign.contentCampaign.package.roadsideDiscoveries
    : campaign.roadsideDiscoveryDefinitions;
  return definitions === undefined ? [] : definitions;
}
export function validateRoadsideDiscoveryContext(campaign, scene) {
  const definitions = roadsideDiscoveriesFor(campaign);
  if (
    !scene ||
    validateRoadsideDiscoveries(definitions).length ||
    validateRoadsideDiscoveries(scene.roadsideDiscoveryDefinitions).length ||
    canonicalContent(scene.roadsideDiscoveryDefinitions ?? []) !== canonicalContent(definitions)
  )
    throw Error('Los hallazgos de camino del despliegue no coinciden con la campaña.');
}
export function roadsideDiscoveryProps(cell, definitions) {
  if (validateRoadsideDiscoveries(definitions).length)
    throw Error('Los hallazgos de camino no son válidos.');
  return (definitions ?? [])
    .filter((d) => d.cell === cell)
    .map((d) => ({
      id: roadsideDiscoveryIds(d).chest,
      type: 'chest',
      x: d.x,
      y: d.y,
      blocksMovement: true,
    }));
}
export function roadsideDiscoveryForMap(cell, map) {
  const definitions = map.roadsideDiscoveryDefinitions;
  if (validateRoadsideDiscoveries(definitions).length)
    throw Error('Los hallazgos de camino no son válidos.');
  // The admitted prop identifies the selected physical cell, including a
  // named locality whose map is keyed by its locality ID.
  return (
    (definitions ?? []).find((d) =>
      (map.props ?? []).some((p) => p.id === roadsideDiscoveryIds(d).chest && p.type === 'chest'),
    ) ?? null
  );
}

export { validateRoadsideDiscoveries } from '../campaign-format/roadside-discovery-schema.js';
