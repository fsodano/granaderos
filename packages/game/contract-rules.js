export {
  CONTRACT_RULE_FIELDS,
  validateContractRules,
} from '../campaign-format/campaign-rules-schema.js';
// Optional content keeps existing campaign packages and their saved identities intact.
export const DEFAULT_CONTRACT_RULES = Object.freeze({
  days: Object.freeze({ day: 1, week: 7, month: 30 }),
  salaryMonthDays: 30,
  xpStep: 100,
  xpRaisePercent: 10,
  warningHours: 2,
});

export const contractRules = (s) =>
  s?.contentCampaign?.package.contractRules ?? DEFAULT_CONTRACT_RULES;
