import { CRITICAL_HEALTH, isUnconscious } from './actor-condition.ts';

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

/** The only fields of a unit a patrol decision reads. */
export type PatrolUnit = Readonly<{
  hp: number;
  energy?: number;
  routed?: boolean | undefined;
  fled?: boolean | undefined;
  surrendered?: boolean | undefined;
  departure?: unknown;
  militia?: boolean | undefined;
  knockedDown?: boolean | undefined;
  entangled?: boolean | undefined;
  patrol?: boolean | undefined;
  ap: number;
  x: number;
  y: number;
}>;

/** The map extent a patrol waypoint is placed on. Only its size matters here. */
export type PatrolMapSize = Readonly<{ width: number; height: number }>;

export type PatrolPoint = Readonly<{ x: number; y: number }>;

/** A reachable cell the tactical simulation reports, with its movement cost. */
export type PatrolReachableCell = PatrolPoint & Readonly<{ cost: number }>;

const distance = (a: PatrolPoint, b: PatrolPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

// A unit can act while it keeps at least the critical health and is neither
// unconscious, routed, fled, surrendered nor departing.
export const canAct = (unit: PatrolUnit): boolean =>
  unit.hp >= CRITICAL_HEALTH &&
  !isUnconscious(unit) &&
  !unit.routed &&
  !unit.fled &&
  !unit.surrendered &&
  !unit.departure;

// The six fixed map points a patrol cycles through, as fractions of the map.
export const MILITIA_PATROL_WAYPOINTS = Object.freeze([
  Object.freeze([0.55, 0.5] as const),
  Object.freeze([0.75, 0.25] as const),
  Object.freeze([0.85, 0.5] as const),
  Object.freeze([0.75, 0.75] as const),
  Object.freeze([0.4, 0.75] as const),
  Object.freeze([0.4, 0.25] as const),
]);

export const militiaPatrolWaypointPoint = (
  rules: MilitiaPatrolRules,
  turn: number,
): readonly [number, number] => {
  const index = Math.floor((turn - 1) / rules.waypointTicks) % MILITIA_PATROL_WAYPOINTS.length;
  const point = MILITIA_PATROL_WAYPOINTS[index];
  if (!point) {
    throw new RangeError('The militia patrol turn is invalid.');
  }
  return point;
};

export const militiaPatrolWaypoint = (
  rules: MilitiaPatrolRules,
  turn: number,
  map: PatrolMapSize,
): PatrolPoint => {
  const [horizontal, vertical] = militiaPatrolWaypointPoint(rules, turn);
  return {
    x: Math.floor((map.width - 1) * horizontal),
    y: Math.floor((map.height - 1) * vertical),
  };
};

// A militia patrols only while it can still act, its rules and its own order
// allow it, and no enemy is in sight of its side. It stops once it stands close
// enough to the waypoint of the turn.
export function militiaPatrolsThisTurn(
  rules: MilitiaPatrolRules,
  unit: PatrolUnit,
  turn: number,
  map: PatrolMapSize,
  enemyInSight: boolean,
): boolean {
  if (
    !rules.enabled ||
    !unit.militia ||
    !canAct(unit) ||
    unit.knockedDown ||
    unit.entangled ||
    unit.patrol === false ||
    unit.ap < 25
  ) {
    return false;
  }
  if (enemyInSight) {
    return false;
  }
  return distance(unit, militiaPatrolWaypoint(rules, turn, map)) > 3;
}

// Among the cells the unit can reach, the patrol takes the one closest to its
// waypoint and breaks ties by cost, then row, then column.
export function militiaPatrolDestination<T extends PatrolReachableCell>(
  unit: PatrolUnit,
  waypoint: PatrolPoint,
  reachable: readonly T[],
): T | undefined {
  const budget = Math.min(32, unit.ap - 20);
  return reachable
    .filter(
      (cell) =>
        cell.cost > 0 && cell.cost <= budget && distance(cell, waypoint) < distance(unit, waypoint),
    )
    .sort(
      (a, b) =>
        distance(a, waypoint) - distance(b, waypoint) || a.cost - b.cost || a.y - b.y || a.x - b.x,
    )[0];
}

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
