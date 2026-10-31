import { validateMilitiaPatrol } from '../campaign-format/campaign-rules-schema.js';
export {
  MILITIA_PATROL_FIELDS,
  validateMilitiaPatrol,
} from '../campaign-format/campaign-rules-schema.js';
// Optional authoring preserves the content identity of older campaigns.
export const DEFAULT_MILITIA_PATROL = Object.freeze({
  enabled: true,
  waypointTicks: 8,
  energyReserve: 50,
  restEnergy: 10,
});

export const militiaPatrolRules = (s) =>
  s?.contentCampaign?.package.militiaPatrol ?? s?.militiaPatrol ?? DEFAULT_MILITIA_PATROL;

export function validateCampaignPatrol(campaign, scene) {
  if (!scene) {
    return;
  }
  const expected = campaign.contentCampaign?.package.militiaPatrol ?? DEFAULT_MILITIA_PATROL,
    actual = scene.militiaPatrol ?? DEFAULT_MILITIA_PATROL;
  if (
    validateMilitiaPatrol(scene.militiaPatrol).length ||
    !Object.keys(DEFAULT_MILITIA_PATROL).every((key) => actual[key] === expected[key])
  ) {
    throw Error('Las reglas de patrulla no coinciden con la campaña.');
  }
}
