import { required } from './required';
import { worldWallRecords, buildingWallAtPoint, wallFrameRecords } from './world-wall-records';
import { Group, Vector3 } from 'three';
import { entranceFrame, getBuildingProfile } from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { WorldBatch } from './world-geometry';
import { architectureFinish, applyArchitectureFinish } from './world-architecture-finish';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput, WorldTile } from './world-types';

/** Source-sized palace stone columns and plaster piers belong to their
 * actual intact wall cells. The caller keeps edited and legacy shell fallback. */
export function palaceColumns(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  supports: readonly number[],
) {
  const root = new Group();
  root.name = `building-palace-columns:${b.id}`;
  const walls = worldWallRecords(input).filter((tile) => tile.buildingId === b.id),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    profile = getBuildingProfile(b),
    appearance = buildingAppearance(b),
    V = 25.066666666666666,
    twoStoreys = height >= 4,
    storey = twoStoreys ? (height * profile.groundFloorHeight) / profile.wallHeight : height,
    light = illuminationAt(input, b);
  let batch = new WorldBatch(geometry);
  const texture = '/art/architecture-plaster-v2.png',
    wall = materials.get(appearance['wallFinish'], {
      architectureRole: 'volume',
      texture,
    }),
    stone = materials.get('stone', {
      architectureRole: 'volume',
      colour: '#a99a79',
    }),
    stoneCoping = materials.get('palace-column-coping', { colour: '#c7b795' }),
    trims: Record<string, string> = {
      adobe: '#cab48e',
      limewash: '#eee6d1',
      ochre: '#e4d3ab',
      stone: '#c5bd9f',
      brick: '#cfb490',
    },
    coping = materials.get('palace-pier-coping', {
      colour: trims[appearance['wallFinish']] ?? trims['limewash'],
    });
  // pier() and formalSidePilasters() retain the source plaster overlay even
  // when the saved main wall paint selects stone or brick.
  applyArchitectureFinish(wall, {
    ...required(architectureFinish(appearance['wallFinish'], 'volume')),
    texture,
    textureOpacity: 0.36,
    multiplyOpacity: 0,
  });
  const at = (u: number, v: number) => {
    const p = frame.at(u, v);
    return new Vector3(p.x * T, 0, p.y * T);
  };
  const rect = (u0: number, v0: number, u1: number, v1: number) => {
    const a = at(u0, v0),
      c = at(u1, v1);
    return {
      minX: Math.min(a.x, c.x),
      maxX: Math.max(a.x, c.x),
      minZ: Math.min(a.z, c.z),
      maxZ: Math.max(a.z, c.z),
    };
  };
  const clip = (tile: WorldTile, r: ReturnType<typeof rect>) => ({
    minX: Math.max(r.minX, (tile.x - 0.49) * T),
    maxX: Math.min(r.maxX, (tile.x + 0.49) * T),
    minZ: Math.max(r.minZ, (tile.y - 0.49) * T),
    maxZ: Math.min(r.maxZ, (tile.y + 0.49) * T),
  });
  const walking = (r: ReturnType<typeof rect>, top: number) =>
    (input.terrain.upperSurfaces ?? []).some(
      (surface) =>
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        (surface.elevation ?? 3) <= base + top + 0.01 &&
        (surface.x + 0.5) * T > r.minX + 1e-6 &&
        (surface.x - 0.5) * T < r.maxX - 1e-6 &&
        (surface.y + 0.5) * T > r.minZ + 1e-6 &&
        (surface.y - 0.5) * T < r.maxZ - 1e-6,
    );
  const box = (r: ReturnType<typeof rect>, bottom: number, top: number, material = wall) => {
    if (top > bottom && r.maxX > r.minX && r.maxZ > r.minZ) {
      batch.box(
        material,
        (r.minX + r.maxX) * 0.5,
        base + (bottom + top) * 0.5,
        (r.minZ + r.maxZ) * 0.5,
        r.maxX - r.minX,
        top - bottom,
        r.maxZ - r.minZ,
        light,
      );
    }
  };
  const wallAt = (u: number, v: number) => {
    const p = frame.at(u, v);
    return buildingWallAtPoint(walls, p, b, 'wall');
  };
  const formal = supports.filter((u) => wallAt(u, 0));
  for (const u of formal) {
    const tile = required(wallAt(u, 0)),
      footRect = clip(tile, rect(u - 0.23, -0.43, u + 0.23, 0.24)),
      top = twoStoreys ? storey + 4.5 / V : height - 0.025,
      capitalBottom = top - 4.5 / V,
      foot = Math.min((profile.plinthHeight + 2) / V, capitalBottom * 0.6);
    if (walking(footRect, top) || capitalBottom <= foot + 0.1) {
      continue;
    }
    box(footRect, 0, foot, stone);
    box(clip(tile, rect(u - 0.14, -0.34, u + 0.14, 0.16)), foot, capitalBottom, stone);
    box(footRect, capitalBottom, top - 0.5 / V, stone);
    box(footRect, top - 0.5 / V, top, stoneCoping);
  }
  // The retained native model has piers at both facade ends. The source front
  // profile is mirrored at the rear so every physical camera face stays joined.
  const columns = batch.finish(`building-detail:${b.id}:entrance-columns`);
  if (columns.children.length) {
    root.add(columns);
  }
  batch = new WorldBatch(geometry);
  for (const u of [0, frame.width]) {
    for (const v of [0, frame.depth]) {
      const tile = wallAt(u, v);
      if (!tile) {
        continue;
      }
      if (v !== 0 || !formal.includes(u)) {
        const sign = v === 0 ? 1 : -1,
          footRect = clip(tile, rect(u - 0.225, v - 0.39 * sign, u + 0.225, v + 0.2 * sign)),
          top = storey - 0.5 / V,
          foot = Math.min(profile.plinthHeight / V, (storey - 5.5 / V) * 0.6);
        if (!walking(footRect, top) && storey - 5.5 / V > foot + 0.1) {
          box(footRect, 0, foot, stone);
          box(
            clip(tile, rect(u - 0.155, v - 0.34 * sign, u + 0.155, v + 0.15 * sign)),
            foot,
            storey - 5.5 / V,
          );
          const capital = clip(tile, rect(u - 0.205, v - 0.37 * sign, u + 0.205, v + 0.19 * sign));
          box(capital, storey - 5.5 / V, top - 0.5 / V);
          box(capital, top - 0.5 / V, top, coping);
        }
      }
      if (twoStoreys) {
        const upper = clip(tile, rect(u - 0.19, v - 0.19, u + 0.19, v + 0.19)),
          bottom = storey + 5 / V,
          top = height - 3 / V;
        if (!walking(upper, top)) {
          box(upper, bottom, top, stone);
        }
      }
    }
  }
  // The flat source paints positive-axis side faces. Preserve the existing
  // four-cell physical rhythm on both side walls as a 3D reference adaptation.
  for (const u of [0, frame.width]) {
    for (let v = 2; v < frame.depth - 1; v += 4) {
      const tile = wallAt(u, v);
      if (!tile) {
        continue;
      }
      const r = clip(tile, rect(u - 0.25, v - 0.15, u + 0.25, v + 0.15)),
        top = storey - 5 / V,
        foot = Math.min((profile.plinthHeight + 1) / V, top * 0.6);
      if (walking(r, top) || top <= foot + 0.1) {
        continue;
      }
      box(r, 0, foot, stone);
      box(r, foot, top);
    }
  }
  const node = batch.finish(`building-detail:${b.id}:palace-pilasters`);
  if (node.children.length) {
    root.add(node);
  }
  return root;
}
