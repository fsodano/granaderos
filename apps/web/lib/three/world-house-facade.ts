import {
  worldWallRecords,
  buildingWallAtPoint,
  wallFrameRecords,
} from './world-wall-records';
import { Group, Vector3 } from 'three';
import {
  entranceFrame,
  getBuildingProfile,
} from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { BUILDING_OPENINGS } from '../../../../packages/game/building-scale.js';
import { WorldBatch } from './world-geometry';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput, WorldTile } from './world-types';

/** Two supported front piers and a shallow timber door hood follow the
 * current house sprite. They never change authored openings or occupancy. */
export function houseFacade(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  legacy = false,
) {
  const root = new Group();
  root.name = `building-house-facade:${b.id}`;
  if (legacy && b.wallFinish === undefined) {
    return root;
  }
  const walls = worldWallRecords(input).filter(
      (tile) => tile.buildingId === b.id,
    ),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    inset = buildingArtInset(b, input),
    V = 25.066666666666666,
    appearance = buildingAppearance(b),
    profile = getBuildingProfile(b),
    light = illuminationAt(input, b);
  const wall = materials.get(appearance['wallFinish'], {
      architectureRole: 'volume',
    }),
    stone = materials.get('stone', {
      architectureRole: 'volume',
      colour: '#a99a79',
    }),
    wood = materials.get('wood'),
    copingColours: Record<string, string> = {
      adobe: '#cab48e',
      limewash: '#eee6d1',
      ochre: '#e4d3ab',
      stone: '#c5bd9f',
      brick: '#cfb490',
    },
    coping = materials.get('house-pier-coping', {
      colour: copingColours[appearance['wallFinish']] ?? copingColours['adobe'],
    });
  const at = (u: number, v: number) => {
    const p = frame.at(u, v);
    return new Vector3((p.x + inset) * T, 0, (p.y + inset) * T);
  };
  const rectangle = (u0: number, v0: number, u1: number, v1: number) => {
    const a = at(u0, v0),
      c = at(u1, v1);
    return {
      minX: Math.min(a.x, c.x),
      maxX: Math.max(a.x, c.x),
      minZ: Math.min(a.z, c.z),
      maxZ: Math.max(a.z, c.z),
    };
  };
  const walking = (rect: ReturnType<typeof rectangle>, top: number) =>
    (input.terrain.upperSurfaces ?? []).some(
      (surface) =>
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        (surface.elevation ?? 3) <= base + top + 0.01 &&
        (surface.x + 0.5) * T > rect.minX + 1e-6 &&
        (surface.x - 0.5) * T < rect.maxX - 1e-6 &&
        (surface.y + 0.5) * T > rect.minZ + 1e-6 &&
        (surface.y - 0.5) * T < rect.maxZ - 1e-6,
    );
  const feature = (name: string, draw: (batch: WorldBatch) => void) => {
    const batch = new WorldBatch(geometry);
    draw(batch);
    const node = batch.finish(`building-detail:${b.id}:${name}`);
    if (node.children.length) {
      root.add(node);
    }
  };
  const box = (
    batch: WorldBatch,
    rect: ReturnType<typeof rectangle>,
    bottom: number,
    top: number,
    material: ReturnType<WorldMaterialSource['get']>,
  ) =>
    batch.box(
      material,
      (rect.minX + rect.maxX) * 0.5,
      base + (bottom + top) * 0.5,
      (rect.minZ + rect.maxZ) * 0.5,
      rect.maxX - rect.minX,
      top - bottom,
      rect.maxZ - rect.minZ,
      light,
    );
  const supported = (tile: WorldTile, rect: ReturnType<typeof rectangle>) => ({
    minX: Math.max(rect.minX, (tile.x - 0.49) * T),
    maxX: Math.min(rect.maxX, (tile.x + 0.49) * T),
    minZ: Math.max(rect.minZ, (tile.y - 0.49) * T),
    maxZ: Math.min(rect.maxZ, (tile.y + 0.49) * T),
  });
  const capitalBottom = height - 5.5 / V,
    capitalTop = height - 0.5 / V,
    foot = Math.min(profile.plinthHeight / V, capitalBottom * 0.35);
  if (capitalBottom > foot + 0.2) {
    feature('house-corner-piers', (batch) => {
      for (const u of [0, frame.width]) {
        const p = frame.at(u, 0),
          tile = buildingWallAtPoint(walls, p, b);
        if (tile?.type !== 'wall') {
          continue;
        }
        const footRect = supported(
          tile,
          rectangle(u - 0.165, -0.27, u + 0.165, 0.2),
        );
        if (walking(footRect, capitalTop)) {
          continue;
        }
        box(batch, footRect, 0, foot, stone);
        box(
          batch,
          supported(tile, rectangle(u - 0.095, -0.22, u + 0.095, 0.15)),
          foot,
          capitalBottom,
          wall,
        );
        const capital = supported(
          tile,
          rectangle(u - 0.145, -0.25, u + 0.145, 0.19),
        );
        box(batch, capital, capitalBottom, capitalTop - 0.5 / V, wall);
        box(batch, capital, capitalTop - 0.5 / V, capitalTop, coping);
      }
    });
  }

  const door = frame.door;
  if (
    !door ||
    door.type !== 'door' ||
    ((door.x === b.x || door.x === b.x + b.width - 1) &&
      (door.y === b.y || door.y === b.y + b.height - 1))
  ) {
    return root;
  }
  const center = frame.doorU - inset * (frame.u.x + frame.u.y),
    lo = Math.max(0.1, center - 0.72),
    hi = Math.min(frame.width - 0.1, center + 0.72),
    doorTop = Math.min(height - 0.12, BUILDING_OPENINGS.doorHeight / V),
    bottom = Math.max(height * 0.87, doorTop + 0.045),
    top = bottom + 3 / V,
    rect = rectangle(lo, -0.22, hi, 0.13);
  if (hi > lo && top <= height - 0.05 && !walking(rect, top)) {
    feature('house-door-hood', (batch) => box(batch, rect, bottom, top, wood));
  }
  return root;
}
