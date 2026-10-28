import {
  CARE_RULE_FIELDS,
  STRATEGIC_BLEEDING_FIELD,
  validateCareRules,
} from '../campaign-format/campaign-rules-schema.js';
export {
  CARE_RULE_FIELDS,
  STRATEGIC_BLEEDING_FIELD,
  validateCareRules,
} from '../campaign-format/campaign-rules-schema.js';
export const DEFAULT_CARE_RULES = Object.freeze({
  minimumSkill: 20,
  baseHealing: 2,
  skillStep: 20,
  dressingPrice: 10,
  energyCost: 3,
  fatigueCost: 2,
  restEnergy: 12,
  restFatigue: 8,
  restHealingHours: 6,
});

export const DEFAULT_STRATEGIC_BLEEDING_PERCENT = 25;

export const strategicBleedingPercent = (s) =>
  careRules(s).bleedingDamagePercent ?? DEFAULT_STRATEGIC_BLEEDING_PERCENT;

export const careRules = (s) => s?.contentCampaign?.package.careRules ?? DEFAULT_CARE_RULES;
