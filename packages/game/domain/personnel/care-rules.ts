// The tuning a wound treatment follows: the skill it needs, how much it heals,
// what a dressing costs, and what a rest returns. A campaign may author its own
// values; these are the defaults used when it authors none.
export type CareRuleValues = Readonly<{
  minimumSkill: number;
  baseHealing: number;
  skillStep: number;
  dressingPrice: number;
  energyCost: number;
  fatigueCost: number;
  restEnergy: number;
  restFatigue: number;
  restHealingHours: number;
}>;

export const DEFAULT_CARE_RULES: CareRuleValues = Object.freeze({
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

// The percentage of a wounded combatant's health that strategic bleeding takes
// each hour when the campaign authors no value.
export const DEFAULT_STRATEGIC_BLEEDING_PERCENT = 25;
