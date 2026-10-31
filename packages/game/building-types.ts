import type { BuildingAppearance } from '../campaign-format/types.ts';
import type { BattleBuilding, CampaignContext } from './public/compatibility-types.ts';
import { campaignWorld } from './campaign-definition.js';

// Shared construction catalogue. Styles are interpretations of 1810–1820 architecture.
export const buildingTypes = (context: CampaignContext = null) =>
  campaignWorld(context).buildings.types;
export const buildingFootprints = (context: CampaignContext = null) =>
  campaignWorld(context).buildings.footprints;
export const BUILDING_TYPES = Object.freeze(buildingTypes());
export const BUILDING_FOOTPRINTS = Object.freeze(buildingFootprints());
export function buildingStyle(
  building: Pick<BattleBuilding, 'architecture' | 'campaignStyle'> | null | undefined,
  context: CampaignContext = null,
): BuildingAppearance {
  const styles = buildingTypes(context);
  const base =
    (building?.architecture ? styles[building.architecture] : undefined) ?? styles['house'];
  if (!base) {
    throw new Error('La campaña necesita un estilo de casa.');
  }
  return { ...base, ...building?.campaignStyle };
}
export function sectorBuildingType(
  id: string,
  index = 0,
  landmark = false,
  context: CampaignContext = null,
): string {
  const expansion = campaignWorld(context).expansion;
  if (landmark) {
    return expansion.buildingLandmarks?.[id] ?? 'house';
  }
  const types = expansion.buildingSelections?.[id] ?? expansion.defaultBuildingSelection;
  const selected = types[index % types.length];
  if (!selected) {
    throw new Error('La campaña necesita un tipo de edificio.');
  }
  return selected;
}
