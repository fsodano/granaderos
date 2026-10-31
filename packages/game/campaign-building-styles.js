import { campaignDefinitions } from './campaign-definition.js';
import { hasGenericCharacterDefinitions } from './content-character-ids.ts';
import { canonicalContent } from './content-identity.js';

const styleKey = (building) =>
  building.architecture ??
  { palace: 'mansion', townhall: 'cabildo' }[building.kind] ??
  building.kind;
const selectedStyle = (types, building) => types[styleKey(building)] ?? types.house;

// Only explicit generic worlds use their authored visual defaults. Stock
// scenes retain the renderer's established catalogue profiles and finishes.
export function applyCampaignBuildingStyles(map, context) {
  const definitions = campaignDefinitions(context),
    types = definitions?.world?.buildings?.types;
  if (!types) {
    return map;
  }
  const generic = hasGenericCharacterDefinitions(definitions);
  for (const building of map.buildings ?? []) {
    building.campaignStyle = {
      ...(generic ? selectedStyle(types, building) : (types[building.architecture] ?? types.house)),
    };
    if (generic) {
      building.campaignStyleMode = 'selected';
    }
  }
  return map;
}

export function validateCampaignBuildingStyles(context, scene) {
  const definitions = campaignDefinitions(context),
    types = definitions?.world?.buildings?.types;
  const generic = Boolean(types && hasGenericCharacterDefinitions(definitions));
  if (scene.buildings !== undefined && !Array.isArray(scene.buildings)) {
    throw Error('La lista de edificios tácticos no es válida.');
  }
  for (const building of scene.buildings ?? []) {
    if (!building || typeof building !== 'object' || Array.isArray(building)) {
      throw Error('El edificio táctico no es válido.');
    }
    if (!generic) {
      if (building.campaignStyleMode !== undefined) {
        throw Error('El estilo táctico seleccionado no corresponde a la campaña.');
      }
      continue;
    }
    const expected = selectedStyle(types, building);
    // Older pinned generic saves predate this presentation marker. Restore the
    // admitted defaults, without changing an explicit roof or tactical slab.
    if (building.campaignStyle === undefined) {
      building.campaignStyle = { ...expected };
    }
    if (building.campaignStyleMode === undefined) {
      building.campaignStyleMode = 'selected';
    }
    if (
      building.campaignStyleMode !== 'selected' ||
      canonicalContent(building.campaignStyle) !== canonicalContent(expected)
    ) {
      throw Error(`El estilo táctico del edificio ${building.id} no corresponde a la campaña.`);
    }
  }
}
