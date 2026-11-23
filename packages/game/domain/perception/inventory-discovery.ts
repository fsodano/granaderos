import { atHand } from '../sector-sessions/tactical-planning-space.ts';

// Discovery survives losing sight. It grants knowledge of loose equipment,
// not of hidden bodies, living opponents' packs or unopened containers. The
// map answers whether an interior is known and whether an observer sees a
// point; the rule owns which observers count and what their sight reveals.

/** A point on the battlefield, with its ground level when it has one. */
export type DiscoveryPoint = Readonly<{
  x: number;
  y: number;
  tacticalLevel?: number;
}>;

/** The fields of a combatant that decide whether it observes the field. */
export type DiscoveryObserver = DiscoveryPoint &
  Readonly<{
    side: string;
    hp: number;
    unconscious?: boolean | undefined;
    departure?: unknown;
    routed?: boolean | undefined;
    surrendered?: boolean | undefined;
  }>;

/** What the map reports about a point: its interior, and who sees it. */
export type DiscoverySight = Readonly<{
  interiorVisible(point: DiscoveryPoint): boolean;
  observerSees(observer: DiscoveryObserver, point: DiscoveryPoint): boolean;
}>;

export type DiscoveryGroundItem = DiscoveryPoint &
  Readonly<{
    count: number;
    heldBy?: unknown;
  }>;

export type DiscoveryDroppedWeapon = DiscoveryPoint &
  Readonly<{
    taken?: boolean | undefined;
  }>;

export type DiscoveryBody = DiscoveryPoint &
  Readonly<{
    hp: number;
    departure?: unknown;
  }>;

/** A container the rule reads, with the cells its footprint covers. */
export type DiscoveryChest = Readonly<{
  type: string;
  open?: boolean | undefined;
  cells: readonly DiscoveryPoint[];
}>;

// Only a living, conscious, present player combatant observes the field. A
// departing or surrendered one has left the fight and reports nothing.
export function discoveryObservers<T extends DiscoveryObserver>(units: readonly T[]): readonly T[] {
  return units.filter(
    (unit) =>
      unit.side === 'player' &&
      unit.hp > 0 &&
      !unit.unconscious &&
      !unit.departure &&
      !unit.routed &&
      !unit.surrendered,
  );
}

// A point is seen when its interior is known and some observer sees it. A body
// lies at arm's length only when the observer stands within reach of it.
export function isPointSeen(
  sight: DiscoverySight,
  observers: readonly DiscoveryObserver[],
  point: DiscoveryPoint,
  atArmsLength = false,
): boolean {
  return (
    sight.interiorVisible(point) &&
    observers.some(
      (observer) =>
        sight.observerSees(observer, point) && (!atArmsLength || atHand(observer, point)),
    )
  );
}

// Loose equipment counts while some of it remains and nobody holds it.
export function isGroundItemFound(
  item: DiscoveryGroundItem,
  observers: readonly DiscoveryObserver[],
  sight: DiscoverySight,
): boolean {
  return item.count > 0 && !item.heldBy && isPointSeen(sight, observers, item);
}

export function isDroppedWeaponFound(
  weapon: DiscoveryDroppedWeapon,
  observers: readonly DiscoveryObserver[],
  sight: DiscoverySight,
): boolean {
  return !weapon.taken && isPointSeen(sight, observers, weapon);
}

// A body is found by coming upon it, never by sight alone.
export function isBodyFound(
  body: DiscoveryBody,
  observers: readonly DiscoveryObserver[],
  sight: DiscoverySight,
): boolean {
  return body.hp <= 0 && !body.departure && isPointSeen(sight, observers, body, true);
}

// An opened chest is found once any cell of it is seen; a closed one stays shut.
export function isOpenChestFound(
  chest: DiscoveryChest,
  observers: readonly DiscoveryObserver[],
  sight: DiscoverySight,
): boolean {
  return (
    chest.type === 'chest' &&
    Boolean(chest.open) &&
    chest.cells.some((cell) => isPointSeen(sight, observers, cell))
  );
}
