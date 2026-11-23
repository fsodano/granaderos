export {
  CARE_RULE_FIELDS,
  STRATEGIC_BLEEDING_FIELD,
  validateCareRules,
} from '../campaign-format/campaign-rules-schema.js';
import {
  DEFAULT_CARE_RULES,
  DEFAULT_STRATEGIC_BLEEDING_PERCENT,
} from './domain/personnel/care-rules.ts';
export { DEFAULT_CARE_RULES, DEFAULT_STRATEGIC_BLEEDING_PERCENT };

export const strategicBleedingPercent = (s) =>
  careRules(s).bleedingDamagePercent ?? DEFAULT_STRATEGIC_BLEEDING_PERCENT;

/** @returns {import("../campaign-format/types.ts").CareRules} */
export const careRules = (s) => s?.contentCampaign?.package.careRules ?? DEFAULT_CARE_RULES;
