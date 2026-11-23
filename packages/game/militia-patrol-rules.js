export {
  MILITIA_PATROL_FIELDS,
  validateMilitiaPatrol,
} from '../campaign-format/campaign-rules-schema.js';
import {
  DEFAULT_MILITIA_PATROL,
  validateCampaignPatrol,
} from './domain/personnel/militia-patrol.ts';
export { DEFAULT_MILITIA_PATROL, validateCampaignPatrol };

// Optional authoring preserves the content identity of older campaigns.
export const militiaPatrolRules = (s) =>
  s?.contentCampaign?.package.militiaPatrol ?? s?.militiaPatrol ?? DEFAULT_MILITIA_PATROL;
