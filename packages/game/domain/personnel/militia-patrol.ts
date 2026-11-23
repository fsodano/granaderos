// The tuning a militia patrol follows: whether patrols are on, how many turns a
// waypoint takes, how much energy a patrol keeps, and how much a rest returns. A
// campaign may author its own values; these are the defaults used when it
// authors none.
export type MilitiaPatrolRules = Readonly<{
  enabled: boolean;
  waypointTicks: number;
  energyReserve: number;
  restEnergy: number;
}>;

export const DEFAULT_MILITIA_PATROL: MilitiaPatrolRules = Object.freeze({
  enabled: true,
  waypointTicks: 8,
  energyReserve: 50,
  restEnergy: 10,
});

// A campaign states its automated patrols in the content package. Only the
// patrol rules matter to this validation, so the domain declares that shape.
export type MilitiaPatrolCampaign = Readonly<{
  contentCampaign?:
    | Readonly<{
        package: Readonly<{ militiaPatrol?: MilitiaPatrolRules | undefined }>;
      }>
    | undefined;
}>;

const PATROL_RULE_RANGES: ReadonlyArray<
  readonly ['waypointTicks' | 'energyReserve' | 'restEnergy', number, number]
> = Object.freeze([
  Object.freeze(['waypointTicks', 1, 60] as const),
  Object.freeze(['energyReserve', 0, 95] as const),
  Object.freeze(['restEnergy', 1, 100] as const),
]);

const PATROL_RULE_KEYS = ['enabled', ...PATROL_RULE_RANGES.map(([key]) => key)] as const;

function isCompletePatrolRules(value: unknown): value is MilitiaPatrolRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const rules = value as Partial<Record<(typeof PATROL_RULE_KEYS)[number], unknown>>;
  return (
    Object.keys(value).length === PATROL_RULE_KEYS.length &&
    PATROL_RULE_KEYS.every((key) => Object.hasOwn(value, key)) &&
    typeof rules.enabled === 'boolean' &&
    PATROL_RULE_RANGES.every(([key, minimum, maximum]) => {
      const amount = rules[key];
      return (
        typeof amount === 'number' &&
        Number.isSafeInteger(amount) &&
        amount >= minimum &&
        amount <= maximum
      );
    })
  );
}

function authoredPatrolRules(scene: unknown): unknown {
  return typeof scene === 'object' && scene !== null && !Array.isArray(scene)
    ? (scene as { militiaPatrol?: unknown }).militiaPatrol
    : undefined;
}

// A saved scene carries the patrol rules it was written with. Refuse a scene
// whose rules disagree with the campaign's, or whose rules are incomplete.
export function validateCampaignPatrol(campaign: MilitiaPatrolCampaign, scene: unknown): void {
  if (!scene) {
    return;
  }
  const authored = authoredPatrolRules(scene);
  let actual: MilitiaPatrolRules = DEFAULT_MILITIA_PATROL;
  if (authored !== undefined) {
    if (!isCompletePatrolRules(authored)) {
      throw Error('Las reglas de patrulla no coinciden con la campaña.');
    }
    actual = authored;
  }
  const expected = campaign.contentCampaign?.package.militiaPatrol ?? DEFAULT_MILITIA_PATROL;
  if (!PATROL_RULE_KEYS.every((key) => actual[key] === expected[key])) {
    throw Error('Las reglas de patrulla no coinciden con la campaña.');
  }
}
