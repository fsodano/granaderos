import { required } from './required';
import type { ActorRuntime } from './actor-runtime';
import type { ActorVisual } from './presentation';
import type { CombatEffectEvent, EffectPoint } from './combat-effects';
import { TILE_METRES } from './projection';
type Entry = {
  visual?: ActorVisual;
  runtime?: ActorRuntime;
  pending?: boolean;
  error?: boolean;
};
type Actor = {
  visual: ActorVisual;
  runtime: ActorRuntime;
  cell: {
    x: number;
    y: number;
    level: number;
    floor: number;
    top: number;
  };
};
const EPS = 1e-8;
const finite = (p: EffectPoint | undefined): p is EffectPoint =>
  Boolean(p) && [required(p).x, required(p).y, required(p).height].every(Number.isFinite);
const same = (a: EffectPoint, b: EffectPoint) =>
  a.x === b.x && a.y === b.y && a.height === b.height;
const levelMatches = (p: EffectPoint, a: Actor) =>
  p.tacticalLevel === undefined || p.tacticalLevel === a.cell.level;
const vertical = (p: EffectPoint, a: Actor) =>
  p.height >= a.cell.floor - EPS && p.height <= a.cell.top + EPS;
const local = (p: EffectPoint, a: Actor) =>
  levelMatches(p, a) &&
  vertical(p, a) &&
  Math.abs(p.x - a.cell.x) <= 0.5 + EPS &&
  Math.abs(p.y - a.cell.y) <= 0.5 + EPS;
/** Native geometry owns every point outside this admitted body's cell. An
 * endpoint connector is permitted only inside its own level/body envelope.
 * A long barrel outside that cell binds the discharge, not the bead path. */
export function withActorEffectAnchors(
  event: CombatEffectEvent,
  admitted: readonly ActorVisual[],
  entry: (key: string) => Entry | undefined,
): CombatEffectEvent {
  if (event.kind !== 'firearm') {
    return event;
  }
  const actor = (key: string | undefined): Actor | undefined => {
    if (!key) {
      return;
    }
    const matches = admitted.filter((v) => v.key === key),
      v = matches.length === 1 ? matches[0] : undefined;
    if (!v) {
      return;
    }
    const e = entry(key),
      r = e?.runtime;
    if (
      !e ||
      e.visual !== v ||
      e.pending ||
      e.error ||
      !r?.root.visible ||
      r.asset.appearance.id !== v.appearance
    ) {
      return;
    }
    const [x, floor, y] = v.position,
      heights = Object.values(v.bodyHeights ?? {}).filter(Number.isFinite),
      height = Math.max(0, ...heights);
    if (
      ![x, floor, y, v.tacticalLevel, height].every(Number.isFinite) ||
      !Number.isInteger(v.tacticalLevel) ||
      v.tacticalLevel < 0 ||
      !heights.length ||
      height <= 0
    ) {
      return;
    }
    return {
      visual: v,
      runtime: r,
      cell: {
        x: Math.floor(x / TILE_METRES + 0.5),
        y: Math.floor(y / TILE_METRES + 0.5),
        level: v.tacticalLevel,
        floor,
        top: floor + height,
      },
    };
  };
  const point = (
    p: {
      x: number;
      y: number;
      z: number;
    },
    a: Actor,
  ): EffectPoint => ({
    x: p.x / TILE_METRES,
    y: p.z / TILE_METRES,
    height: p.y,
    tacticalLevel: a.cell.level,
  });
  const v = event.visual,
    native = v.points ?? [v.source, v.impact];
  if (
    !finite(v.source) ||
    !finite(v.impact) ||
    native.length < 2 ||
    native.length > 256 ||
    !native.every(finite) ||
    !same(required(native[0]), v.source) ||
    !same(required(native.at(-1)), v.impact)
  ) {
    return event;
  }
  const sourceActor = actor(v.discharge === false ? v.sourceBodyKey : event.actorKey),
    targetActor = v.outcome === 'hit' ? actor(v.bodyTargetKey) : undefined;
  const sourceRaw =
      sourceActor &&
      (v.discharge === false
        ? sourceActor.runtime.bodyAnchor(v.source.height)
        : sourceActor.runtime.anchor(
            'muzzle',
            v.shotHand === 'offhand'
              ? 'handLeft'
              : v.shotHand === 'primary'
                ? 'handRight'
                : undefined,
          )),
    targetRaw = targetActor?.runtime.bodyAnchor(v.impact.height);
  const sourceAnchor = sourceRaw && sourceActor ? point(sourceRaw, sourceActor) : undefined,
    targetAnchor = targetRaw && targetActor ? point(targetRaw, targetActor) : undefined;
  // Finite, currently loaded admitted socket identity validates the separate
  // muzzle discharge. Its height must still belong to that actor's floor.
  const dischargeAnchor =
    v.discharge !== false &&
    sourceAnchor &&
    sourceActor &&
    finite(sourceAnchor) &&
    local(v.source, sourceActor) &&
    vertical(sourceAnchor, sourceActor)
      ? sourceAnchor
      : undefined;
  function endConnector(
    points: readonly EffectPoint[],
    a: Actor | undefined,
    anchor: EffectPoint | undefined,
  ): readonly EffectPoint[] {
    if (
      !a ||
      !anchor ||
      !finite(anchor) ||
      !local(anchor, a) ||
      !local(required(points[0]), a) ||
      same(anchor, required(points[0]))
    ) {
      return points;
    }
    const exit = points.findIndex((p) => !local(p, a));
    if (exit <= 0) {
      return points;
    }
    const before = required(points[exit - 1]),
      after = required(points[exit]);
    // A floor/level transition cannot be inferred from coincident XY values.
    if (!levelMatches(before, a) || !levelMatches(after, a)) {
      return points;
    }
    let t = 1;
    for (const [key, lo, hi] of [
      ['x', a.cell.x - 0.5, a.cell.x + 0.5],
      ['y', a.cell.y - 0.5, a.cell.y + 0.5],
      ['height', a.cell.floor, a.cell.top],
    ] as const) {
      const delta = after[key] - before[key];
      if (delta > EPS) {
        t = Math.min(t, (hi - before[key]) / delta);
      } else if (delta < -EPS) {
        t = Math.min(t, (lo - before[key]) / delta);
      }
    }
    if (!Number.isFinite(t) || t < -EPS || t > 1 + EPS) {
      return points;
    }
    t = Math.max(0, Math.min(1, t));
    const boundary: EffectPoint =
      t <= EPS
        ? before
        : t >= 1 - EPS
          ? after
          : {
              x: before.x + (after.x - before.x) * t,
              y: before.y + (after.y - before.y) * t,
              height: before.height + (after.height - before.height) * t,
              tacticalLevel: a.cell.level,
              ...(Number.isFinite(before.fraction) && Number.isFinite(after.fraction)
                ? {
                    fraction:
                      required(before.fraction) +
                      (required(after.fraction) - required(before.fraction)) * t,
                  }
                : {}),
            };
    const next = points.find((p) => !same(p, required(points[0])));
    if (!next) {
      return points;
    }
    const dx = next.x - required(points[0]).x,
      dy = next.y - required(points[0]).y,
      dh = next.height - required(points[0]).height,
      progress =
        (boundary.x - anchor.x) * dx +
        (boundary.y - anchor.y) * dy +
        (boundary.height - anchor.height) * dh;
    // Crop the old cell-local prefix, including samples behind the muzzle.
    // The convex cell envelope contains the whole replacement connector.
    const horizontal = dx * dx + dy * dy,
      forwardXY = (boundary.x - anchor.x) * dx + (boundary.y - anchor.y) * dy;
    if (!same(anchor, boundary) && (progress <= EPS || (horizontal > EPS && forwardXY <= EPS))) {
      return points;
    }
    const candidate = [
      anchor,
      ...(same(anchor, boundary) || boundary === after ? [] : [boundary]),
      ...points.slice(exit),
    ];
    // Never deduplicate the native outside tail: equal XYZ samples can carry
    // distinct admitted level/fraction values and are still native records.
    return candidate.length >= 2 && candidate.length <= 256 ? candidate : points;
  }
  let points: readonly EffectPoint[] = native;
  const sharedCell =
    sourceActor &&
    targetActor &&
    sourceActor.cell.x === targetActor.cell.x &&
    sourceActor.cell.y === targetActor.cell.y &&
    sourceActor.cell.level === targetActor.cell.level;
  if (!sharedCell) {
    points = endConnector(points, sourceActor, sourceAnchor);
    const reversed = [...points].reverse(),
      target = endConnector(reversed, targetActor, targetAnchor);
    if (target !== reversed) {
      points = [...target].reverse();
    }
  }
  const changed = points !== native;
  if (!changed && !dischargeAnchor) {
    return event;
  }
  return {
    ...event,
    ...(dischargeAnchor ? { dischargeAnchor } : {}),
    ...(changed
      ? {
          renderedPath: {
            source: required(points[0]),
            impact: required(points.at(-1)),
            points,
          },
        }
      : {}),
  };
}
