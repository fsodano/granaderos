import { gridLine as line } from './grid-line.ts';
import type { BattleSnapshot, BattleUnit, BattleArtillery, TacticalPoint } from './public/compatibility-types.ts';
import { artilleryProfile } from './artillery-definitions.ts';
import { hasCharacterAbility } from './character-abilities.js';
import { sameSurface, sameCell, surfaceAt, surfaceHeight, tacticalLevel } from './tactical-space.js';
import { wallEdgeId } from './wall-geometry.js';
import { hasLineOfSight } from './tactical.js';
import { geometryCells, rayHeightIntersection, volumeRayCell, obstacleVolumesAt } from './sight-geometry.js';
import { physicalBodies } from './physical-bodies.ts';

export type ArtilleryTraceEvent =
  | { type: 'impact'; unitId: string; victimKind?: 'npc'; damage: number }
  | ({ type: 'stop'; edgeId?: string; height?: number } & Partial<TacticalPoint>)
  | ({ type: 'breach'; edgeId?: string; height?: number; stone: boolean } & TacticalPoint);
export interface ArtilleryShotTrace { events: ArtilleryTraceEvent[]; cells: TacticalPoint[] }
const dist = (a: TacticalPoint, b: TacticalPoint) => Math.hypot(a.x - b.x, a.y - b.y);
function tile(s: BattleSnapshot, x: number, y: number, level = 0) {
  if (level) {
    return surfaceAt(s, { x, y, tacticalLevel: level });
  }
  const at = s.tiles[y * s.width + x];
  return at?.x === x && at?.y === y ? at : s.tiles.find((t) => t.x === x && t.y === y);
}
// Read-only geometry shared by actual cannon fire and autonomous aiming.
// Callers may supply a perceived roster; execution always uses the full field.
export function artilleryCanisterContains(s: BattleSnapshot, gun: BattleArtillery, point: TacticalPoint, body: TacticalPoint)  {
  const spec = artilleryProfile(s, gun),
    length = dist(gun, point);
  if (!length || !sameSurface(gun, body)) {
    return false;
  }
  const dx = (point.x - gun.x) / length,
    dy = (point.y - gun.y) / length,
    vx = body.x - gun.x,
    vy = body.y - gun.y,
    forward = vx * dx + vy * dy,
    across = Math.abs(vx * dy - vy * dx);
  return (
    forward > 1 &&
    forward <= spec.radius * 2 &&
    across <= Math.max(1, forward * 0.5) &&
    hasLineOfSight(s, gun, body)
  );
}
export function artilleryShotTrace(s: BattleSnapshot, u: BattleUnit, gun: BattleArtillery, point: TacticalPoint, mode = 'solid'): ArtilleryShotTrace {
  const spec = artilleryProfile(s, gun),
    events: ArtilleryTraceEvent[] = [],
    cells: TacticalPoint[] = [],
    bodies = physicalBodies(s);
  if (mode === 'canister') {
    const length = dist(gun, point),
      dx = (point.x - gun.x) / length,
      dy = (point.y - gun.y) / length;
    for (const { body, kind } of bodies) {
      if (artilleryCanisterContains(s, gun, point, body)) {
        const forward = (body.x - gun.x) * dx + (body.y - gun.y) * dy;
        events.push({
          type: 'impact',
          unitId: body.id,
          ...(kind === 'npc' ? { victimKind: 'npc' } : {}),
          damage:
            spec.damage *
            Math.max(0.35, 1 - forward / (spec.radius * 3)) *
            (hasCharacterAbility(u, 'artillery_fire') ? 1.15 : 1),
        });
      }
    }
  } else {
    let energy = spec.damage,
      penetration = spec.penetration + (hasCharacterAbility(u, 'artillery_loading') ? 1 : 0);
    const crossed = new Map<string, { edgeId: string; fraction: number }>(),
      sourceHeight = (surfaceHeight(s, gun) ?? 0) + 0.65,
      endHeight = (surfaceHeight(s, point) ?? 0) + 0.65;
    for (const cell of geometryCells(gun, point)) {
      for (const volume of obstacleVolumesAt(s, cell)) {
        if (volume.kind !== 'edge' || !('edgeId' in volume) || typeof volume.edgeId !== 'string') {
          continue;
        }
        if (typeof volume.top !== 'number' || typeof volume.bottom !== 'number') {
          throw new TypeError('Artillery obstacle height must be numeric.');
        }
        const clipped = volumeRayCell(gun, point, cell, volume),
          hit =
            clipped &&
            rayHeightIntersection(sourceHeight, endHeight, clipped, volume.bottom, volume.top);
        const previous = crossed.get(volume.edgeId);
        if (hit && (!previous || hit.entry < previous.fraction)) {
          crossed.set(volume.edgeId, { edgeId: volume.edgeId, fraction: hit.entry });
        }
      }
    }
    const barriers = [...crossed.values()].sort(
      (a, b) => a.fraction - b.fraction || a.edgeId.localeCompare(b.edgeId),
    );
    let barrierIndex = 0,
      stopped = false;
    for (const p of line(gun, point)) {
      cells.push(p);
      const ground = tile(s, p.x, p.y);
      const dx = point.x - gun.x,
        dy = point.y - gun.y,
        progress = ((p.x - gun.x) * dx + (p.y - gun.y) * dy) / (dx * dx + dy * dy);
      while (
        barrierIndex < barriers.length &&
        (barriers[barrierIndex]?.fraction ?? Infinity) <= progress + 1e-10
      ) {
        const barrier = barriers[barrierIndex++];
        if (!barrier) { throw new Error('Expected the crossed artillery barrier.'); }
        const edge = (s.wallEdges ?? []).find((edge) => wallEdgeId(edge) === barrier.edgeId);
        if (!edge) { throw new Error('Expected the artillery barrier wall.'); }
        const stone = edge.material === 'stone',
          resistance = stone ? 3 : 1;
        const contact = {
          x: gun.x + dx * barrier.fraction,
          y: gun.y + dy * barrier.fraction,
          height: sourceHeight + (endHeight - sourceHeight) * barrier.fraction,
          tacticalLevel: tacticalLevel(edge),
        };
        if (penetration < resistance) {
          events.push({ type: 'stop', edgeId: barrier.edgeId, ...contact });
          stopped = true;
          break;
        }
        penetration -= resistance;
        events.push({ type: 'breach', edgeId: barrier.edgeId, ...contact, stone });
      }
      if (stopped) {
        break;
      }
      if (ground?.blocked) {
        if (ground.type === 'water' || ground.type === 'cliff') {
          break;
        }
        const stone = ground.material === 'stone' || ground.type === 'stone',
          resistance = stone ? 3 : 1;
        if (penetration < resistance) {
          events.push({ type: 'stop' });
          break;
        }
        penetration -= resistance;
        events.push({ type: 'breach', ...p, stone });
      }
      for (const { body, kind } of bodies.filter(
        ({ body }) => sameSurface(body, gun) && sameCell(body, p),
      )) {
        events.push({
          type: 'impact',
          unitId: body.id,
          ...(kind === 'npc' ? { victimKind: 'npc' } : {}),
          damage: energy,
        });
        energy *= 0.75;
        penetration--;
      }
      if (penetration < 0 || energy < 20) {
        break;
      }
    }
  }
  return { events, cells };
}

