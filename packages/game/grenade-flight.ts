import type {BattleSnapshot, BattleBody, BattleTile, TacticalPoint} from './public/compatibility-types.ts';
import type {RayInterval, RayVolume} from './ray-intersection.ts';
interface ArcCell extends TacticalPoint, RayInterval {}
interface ArcVolume extends RayVolume {id:string;tacticalLevel:number;bottom:number;top:number}
interface ArcEvent {fraction:number;cell:ArcCell;volume:ArcVolume}
export interface GrenadeFlightResult {
 blocked:boolean;landing:TacticalPoint|null;
 impact: {kind:string;x:number;y:number;height:number|null;fraction:number;obstacleId?:string;tacticalLevel?:number};
 points:{x:number;y:number;height:number;fraction:number}[];
}
import { spacePoint, surfaceAt, surfaceHeight, tacticalLevel } from './tactical-space.js';
import { propBlocksAt } from './props.js';
import {
  absoluteBodyHeight,
  geometryCells,
  obstacleVolumesAt,
  rayHeightIntersection,
  volumeRayCell,
} from './sight-geometry.js';

// Abstract game geometry: a single lob ends at the first obstruction. Classic
// JA2 also simulates subsequent bounces; this helper does not model those.
const epsilon = 1e-9;
const lerp = (a:number, b:number, t:number) => a + (b - a) * t;
const cellAt = (p:TacticalPoint) => ({ x: Math.floor(p.x + 0.5), y: Math.floor(p.y + 0.5) });
const curve = (start:number, end:number, rise:number, t:number) => lerp(start, end, t) + 4 * rise * t * (1 - t);

function roots(start:number, end:number, rise:number, height:number) {
  const a = -4 * rise,
    b = end - start + 4 * rise,
    c = start - height;
  if (Math.abs(a) < epsilon) {
    return Math.abs(b) < epsilon ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -epsilon) {
    return [];
  }
  const d = Math.sqrt(Math.max(0, discriminant));
  return [(-b - d) / (2 * a), (-b + d) / (2 * a)];
}

function arcIntersection(start:number, end:number, rise:number, cell:RayInterval, bottom:number, top:number) {
  const entry = Math.max(0, cell.entry),
    exit = Math.min(1, cell.exit);
  if (exit < entry - epsilon) {
    return null;
  }
  const cuts = [entry, exit, ...roots(start, end, rise, bottom), ...roots(start, end, rise, top)]
    .filter((t) => t >= entry - epsilon && t <= exit + epsilon)
    .map((t) => Math.max(entry, Math.min(exit, t)))
    .sort((a, b) => a - b);
  for (const t of cuts) {
    const height = curve(start, end, rise, t);
    if (height >= bottom - epsilon && height <= top + epsilon) {
      return t;
    }
  }
  return null;
}

function supportBelow(state:BattleSnapshot, cell:TacticalPoint, height:number) {
  const surfaces = [
    surfaceAt(state, cell),
    ...(state.upperSurfaces ?? []).filter((s) => s.x === cell.x && s.y === cell.y),
  ]
    .filter((s): s is BattleTile => s !== undefined && s !== null && (s.elevation ?? 0) <= height + epsilon)
    .sort((a, b) => (b.elevation ?? 0) - (a.elevation ?? 0) || tacticalLevel(b) - tacticalLevel(a));
  // A blocked roof catches the object; never search through it for a floor.
  const support = surfaces[0];
  if (!support || support.blocked) {
    return null;
  }
  const occupied = propBlocksAt(state, cell.x, cell.y, tacticalLevel(support));
  return occupied ? null : spacePoint(support);
}

function landingBefore(state:BattleSnapshot, cells:ArcCell[], start:number, end:number, rise:number, stop:number, event:ArcEvent|undefined) {
  const height = curve(start, end, rise, stop),
    descending = end - start + 4 * rise * (1 - 2 * stop) < 0;
  const topImpact =
    event?.volume?.kind === 'slab' && descending && Math.abs(height - event.volume.top) < epsilon;
  const nearFace = event && Math.abs(stop - event.cell.entry) < epsilon && !topImpact;
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (!cell) { throw new RangeError('Missing grenade trajectory cell.'); }
    if (cell.entry > stop + epsilon || cell.exit - cell.entry < epsilon) {
      continue;
    }
    if (nearFace && cell.entry >= stop - epsilon) {
      continue;
    }
    const t = Math.min(cell.exit, stop),
      support = supportBelow(state, cell, curve(start, end, rise, t));
    if (support) {
      return support;
    }
  }
  return null;
}

// The caller enforces range, equipment, posture and AP. The launch height is
// standing because this action includes standing preparation. No bodies, RNG,
// mutations or hidden actor identities enter the public trajectory.
export function grenadeFlight(state:BattleSnapshot, attacker:TacticalPoint, target:TacticalPoint | null | undefined):GrenadeFlightResult {
  const startBase = surfaceHeight(state, attacker),
    end = surfaceHeight(state, target),
    start = startBase === null ? null : startBase + 1.4;
  const fallback = start === null ? null : supportBelow(state, cellAt(attacker), start);
  const invalid = ():GrenadeFlightResult => ({
    blocked: true,
    landing: fallback,
    impact: { kind: 'invalid', x: attacker.x, y: attacker.y, height: start, fraction: 0 },
    points: [],
  });
  if (!target || start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return invalid();
  }
  let cells;
  try {
    cells = geometryCells(attacker, target);
  } catch {
    return invalid();
  }
  const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  const rise = Math.min(4, Math.max(0.6, distance * 0.3)),
    events: ArcEvent[] = [];
  for (const cell of cells) {
    const ground = surfaceAt(state, cell),
      volumes: ArcVolume[] = obstacleVolumesAt(state, cell).map((volume) => {
        if (typeof volume.top !== 'number') { throw new TypeError('Grenade obstacle height must be numeric.'); }
        return {...volume, top: volume.top};
      });
    // The ground surface is solid below its elevation, including raised terrain.
    if (ground) {
      volumes.push({
        id: `ground:${cell.x},${cell.y}`,
        kind: 'ground',
        tacticalLevel: 0,
        bottom: -1000,
        top: ground.elevation ?? 0,
      });
    }
    for (const volume of volumes) {
      const crossed = volumeRayCell(attacker, target, cell, volume);
      if (!crossed) {
        continue;
      }
      if (typeof volume.top !== 'number') { throw new TypeError('Grenade obstacle height must be numeric.'); }
      const fraction = arcIntersection(start, end, rise, crossed, volume.bottom, volume.top);
      if (fraction === null) {
        continue;
      }
      const intendedFloor =
        (volume.kind === 'ground' && tacticalLevel(target) === 0) ||
        (volume.kind === 'slab' && volume.tacticalLevel === tacticalLevel(target));
      if (fraction >= 1 - epsilon && intendedFloor && cell.x === target.x && cell.y === target.y) {
        continue;
      }
      events.push({ fraction, cell, volume: {...volume, top:volume.top} });
    }
  }
  events.sort(
    (a, b) => a.fraction - b.fraction || String(a.volume.id).localeCompare(String(b.volume.id)),
  );
  const event = events[0],
    fraction = event?.fraction ?? 1;
  const landing = landingBefore(state, cells, start, end, rise, fraction, event) ?? fallback;
  const impact = {
    kind: event ? (event.volume.kind === 'slab' ? 'slab' : 'cover') : 'land',
    x: lerp(attacker.x, target.x, fraction),
    y: lerp(attacker.y, target.y, fraction),
    height: curve(start, end, rise, fraction),
    fraction,
    ...(event
      ? { obstacleId: event.volume.id, tacticalLevel: event.volume.tacticalLevel }
      : { tacticalLevel: tacticalLevel(target) }),
  };
  const count = Math.max(1, Math.min(128, Math.ceil(distance * 4))),
    points = [];
  for (let i = 0; i <= count; i++) {
    const t = (fraction * i) / count;
    points.push({
      x: lerp(attacker.x, target.x, t),
      y: lerp(attacker.y, target.y, t),
      height: curve(start, end, rise, t),
      fraction: t,
    });
  }
  return { blocked: Boolean(event) || !landing, landing, impact, points };
}

// Three physical rays expose the head, torso and legs separately. This is a
// bounded cover model, not classic JA2's spreading rays, destructible windows,
// blast penetration or a simulation of pressure around a corner. Edge cells
// retain a small effect; all distances and strengths are abstract game tuning.
export function grenadeBlastExposure(state:BattleSnapshot, origin:TacticalPoint | null | undefined, target:BattleBody, radius:number) {
  const base = surfaceHeight(state, origin),
    targetBase = surfaceHeight(state, target);
  const invalid = { blocked: true, distance: null, falloff: 0, exposure: 0, multiplier: 0 };
  if (
    !origin || base === null || targetBase === null || !Number.isFinite(base) ||
    !Number.isFinite(targetBase) ||
    !Number.isFinite(radius) ||
    radius < 0
  ) {
    return invalid;
  }
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y, targetBase - base);
  if (distance > radius + epsilon) {
    return { ...invalid, distance };
  }
  let cells;
  try {
    cells = geometryCells(origin, target);
  } catch {
    return { ...invalid, distance };
  }
  const start = base + 0.2,
    volumes = cells.map((cell) => ({ cell, volumes: obstacleVolumesAt(state, cell) }));
  let clear = 0;
  for (const part of ['head', 'torso', 'legs']) {
    const end: number | null = absoluteBodyHeight(state, target, part);
    const blocked = volumes.some(({ cell, volumes: column }) => {
      const ground = surfaceAt(state, cell);
      if (
        ground &&
        rayHeightIntersection(start, end ?? NaN, cell, -1000, ground.elevation ?? 0) !== null
      ) {
        return true;
      }
      return column.some((volume) => {
        const crossed = volumeRayCell(origin, target, cell, volume);
        return (
          crossed && rayHeightIntersection(start, end ?? NaN, crossed, typeof volume.bottom === 'number' ? volume.bottom : NaN, typeof volume.top === 'number' ? volume.top : NaN) !== null
        );
      });
    });
    if (!blocked) {
      clear++;
    }
  }
  const exposure = clear / 3,
    falloff = Math.max(0, (radius - distance + 1) / (radius + 1));
  return { blocked: clear === 0, distance, falloff, exposure, multiplier: falloff * exposure };
}
