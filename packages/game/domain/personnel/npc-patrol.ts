// The civilian patrol mirrors the militia patrol: a decision, a direction for
// the turn, and one cell among the cells the tactical simulation reports. The
// reachable cells and the sight of the civilian stay with the map.

/** The only fields of a civilian a patrol decision reads. */
export type CivilianPatrolUnit = Readonly<{
  id: string | number;
  hp: number;
  unconscious?: boolean | undefined;
  routed?: boolean | undefined;
  departure?: unknown;
  knockedDown?: boolean | undefined;
  entangled?: boolean | undefined;
  patrol?: boolean | undefined;
  patrolTurn?: number | undefined;
  patrolOrigin?: CivilianPatrolPoint | null | undefined;
  x: number;
  y: number;
}>;

export type CivilianPatrolPoint = Readonly<{ x: number; y: number }>;

/** A reachable cell the tactical simulation reports, with its cost and path. */
export type CivilianPatrolReachableCell = CivilianPatrolPoint &
  Readonly<{ cost: number; path: readonly unknown[] }>;

const distance = (a: CivilianPatrolPoint, b: CivilianPatrolPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

// A civilian bound covers four cells per round, cycling through the four fixed
// directions so it orbits its post instead of wandering.
export const CIVILIAN_PATROL_BOUND = 4;

export const CIVILIAN_PATROL_DIRECTIONS = Object.freeze([
  Object.freeze([0, -CIVILIAN_PATROL_BOUND] as const),
  Object.freeze([CIVILIAN_PATROL_BOUND, 0] as const),
  Object.freeze([0, CIVILIAN_PATROL_BOUND] as const),
  Object.freeze([-CIVILIAN_PATROL_BOUND, 0] as const),
]);

// A long turn costs a short path and a reserved share of the movement, and the
// civilian never leaves the ground it patrols around its post.
const CIVILIAN_PATROL_COST_LIMIT = 24;
const CIVILIAN_PATROL_PATH_LIMIT = 3;
const CIVILIAN_PATROL_ROAM = 6;

// Two civilians posted on the same cell must not walk the same way, so the
// direction starts from the turn plus the sum of the character codes of the
// identity.
const identityOffset = (unit: CivilianPatrolUnit): number =>
  Array.from(String(unit.id)).reduce((sum, character) => sum + character.charCodeAt(0), 0);

export const civilianPatrolDirection = (
  unit: CivilianPatrolUnit,
  turn: number,
): readonly [number, number] => {
  const index = (turn + identityOffset(unit)) % CIVILIAN_PATROL_DIRECTIONS.length;
  const direction = CIVILIAN_PATROL_DIRECTIONS[index];
  if (!direction) {
    throw new RangeError('The civilian patrol turn is invalid.');
  }
  return direction;
};

export const civilianPatrolAim = (unit: CivilianPatrolUnit, turn: number): CivilianPatrolPoint => {
  const origin = unit.patrolOrigin;
  if (!origin) {
    throw new RangeError('A civilian without a patrol origin has no aim.');
  }
  const [dx, dy] = civilianPatrolDirection(unit, turn);
  return { x: origin.x + dx, y: origin.y + dy };
};

// A civilian patrols only while it keeps a patrol origin, its own order and its
// footing allow it, and it has not already patrolled this turn.
export function civilianPatrolsThisTurn(unit: CivilianPatrolUnit, turn: number): boolean {
  return !(
    !unit.patrolOrigin ||
    unit.patrol === false ||
    unit.patrolTurn === turn ||
    unit.hp <= 0 ||
    unit.unconscious ||
    unit.routed ||
    unit.departure ||
    unit.knockedDown ||
    unit.entangled
  );
}

// Among the cells the civilian can reach within a short bound of its post, the
// patrol takes the one closest to its aim, moving only when that brings it
// nearer. Ties go to the cheaper cell, then the upper row, then the left column.
export function civilianPatrolDestination<T extends CivilianPatrolReachableCell>(
  unit: CivilianPatrolUnit,
  turn: number,
  reachable: readonly T[],
): T | undefined {
  const origin = unit.patrolOrigin;
  if (!origin) {
    return undefined;
  }
  const aim = civilianPatrolAim(unit, turn);
  return reachable
    .filter(
      (cell) =>
        cell.cost > 0 &&
        cell.cost <= CIVILIAN_PATROL_COST_LIMIT &&
        cell.path.length <= CIVILIAN_PATROL_PATH_LIMIT &&
        distance(cell, origin) <= CIVILIAN_PATROL_ROAM &&
        distance(cell, aim) < distance(unit, aim),
    )
    .sort(
      (a, b) => distance(a, aim) - distance(b, aim) || a.cost - b.cost || a.y - b.y || a.x - b.x,
    )[0];
}
