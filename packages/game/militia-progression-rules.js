import {
  MILITIA_PROGRESSION_FIELDS,
  validateMilitiaProgression,
} from '../campaign-format/campaign-rules-schema.js';
export {
  MILITIA_PROGRESSION_FIELDS,
  validateMilitiaProgression,
} from '../campaign-format/campaign-rules-schema.js';
// Optional package field: old campaigns retain their original content identity.
export const DEFAULT_MILITIA_PROGRESSION = Object.freeze({
  regularThreshold: 2,
  veteranThreshold: 5,
  marksmanshipGain: 8,
  leadershipGain: 5,
  levelGain: 1,
});

export const militiaProgression = (s) =>
  s?.contentCampaign?.package.militiaProgression ?? DEFAULT_MILITIA_PROGRESSION;
