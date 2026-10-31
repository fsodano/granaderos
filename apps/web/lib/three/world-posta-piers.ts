import { required } from './required';
import { worldWallRecords, buildingWallAtPoint, wallFrameRecords } from './world-wall-records';
import { Quaternion, Vector3 } from 'three';
import { entranceFrame, getBuildingProfile } from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { buildingStyle } from '../../../../packages/game/building-types.ts';
import { architectureFinish, applyArchitectureFinish } from './world-architecture-finish';
import { WorldBatch } from './world-geometry';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** The posta's front corner piers are taller and broader than its porch posts.
 * Their stepped foot, shaft and capital all stay in their real support cell. */
export function postaPiers(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  legacy = false,
) {
  const walls = worldWallRecords(input).filter((tile) => tile.buildingId === b.id),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    inset = buildingArtInset(b, input),
    profile = getBuildingProfile(b),
    appearance = buildingAppearance(b),
    V = 25.066666666666666,
    batch = new WorldBatch(geometry),
    light = illuminationAt(input, b);
  const authored = !(legacy && b.wallFinish === undefined),
    texture = '/art/architecture-plaster-v2.png',
    wall = materials.get(
      appearance['wallFinish'],
      authored ? { architectureRole: 'volume', texture } : { colour: buildingStyle(b).wall },
    ),
    stone = materials.get(
      'stone',
      authored ? { architectureRole: 'volume', colour: '#a99a79' } : {},
    ),
    copingColours: Record<string, string> = {
      adobe: '#cab48e',
      limewash: '#eee6d1',
      ochre: '#e4d3ab',
      stone: '#c5bd9f',
      brick: '#cfb490',
    },
    trim = authored
      ? materials.get('posta-pier-coping', {
          colour: copingColours[appearance['wallFinish']] ?? copingColours['adobe'],
        })
      : materials.get('trim', legacy ? { colour: buildingStyle(b).trim } : {}),
    rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.atan2(-frame.u.y, frame.u.x),
    );
  // The current pier() uses plaster for every authored pigment, with a separate warm stone foot.
  if (authored) {
    applyArchitectureFinish(wall, {
      ...required(architectureFinish(appearance['wallFinish'], 'volume')),
      texture,
      textureOpacity: 0.36,
      multiplyOpacity: 0,
    });
  }
  const box = (
    u: number,
    v: number,
    y: number,
    w: number,
    h: number,
    d: number,
    material = wall,
  ) => {
    const p = frame.at(u, v);
    batch.primitive(
      'box',
      material,
      [(p.x + inset) * T, base + y, (p.y + inset) * T],
      [w * T, h, d * T],
      rotation,
      light,
    );
  };
  const shift = (value: number, inset: number, axis: { x: number; y: number }) =>
      value - (0.4 - inset) * (axis.x + axis.y),
    top = height - 3 / V,
    foot = Math.min(profile.plinthHeight / V, top * 0.35);
  const walking = (u: number, v: number, w: number, d: number) => {
    const p = frame.at(u, v),
      x = (p.x + inset) * T,
      z = (p.y + inset) * T,
      halfX = (Math.abs(frame.u.x) * w + Math.abs(frame.v.x) * d) * T * 0.5,
      halfZ = (Math.abs(frame.u.y) * w + Math.abs(frame.v.y) * d) * T * 0.5;
    return (input.terrain.upperSurfaces ?? []).some(
      (surface) =>
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        (surface.elevation ?? 3) <= base + top + 1.5 / V + 0.01 &&
        (surface.x + 0.5) * T > x - halfX + 1e-6 &&
        (surface.x - 0.5) * T < x + halfX - 1e-6 &&
        (surface.y + 0.5) * T > z - halfZ + 1e-6 &&
        (surface.y - 0.5) * T < z + halfZ - 1e-6,
    );
  };
  const shaftTop = authored ? top - 3.5 / V : top;
  if (shaftTop > foot + 0.2) {
    for (const u of [0, frame.width]) {
      const p = frame.at(u, 0);
      if (buildingWallAtPoint(walls, p, b)?.type !== 'wall') {
        continue;
      }
      const footU = inset === 0 ? u : shift(u, 0.27, frame.u),
        footV = inset === 0 ? (authored ? -0.095 : -0.145) : shift(0, 0.195, frame.v);
      if (authored && walking(footU, footV, 0.44, 0.59)) {
        continue;
      }
      if (inset === 0) {
        box(u, authored ? -0.095 : -0.2, (shaftTop + foot) * 0.5, 0.3, shaftTop - foot, 0.49);
        box(u, footV, foot * 0.5, 0.44, foot, 0.59, stone);
        box(u, authored ? -0.09 : -0.15, top - 1.25 / V, 0.4, 4.5 / V, 0.56);
        box(u, authored ? -0.09 : -0.15, top + 1.25 / V, 0.4, 0.5 / V, 0.56, trim);
      } else {
        box(
          shift(u, 0.34, frame.u),
          shift(0, 0.245, frame.v),
          (shaftTop + foot) * 0.5,
          0.3,
          shaftTop - foot,
          0.49,
        );
        box(shift(u, 0.27, frame.u), shift(0, 0.195, frame.v), foot * 0.5, 0.44, foot, 0.59, stone);
        box(shift(u, 0.29, frame.u), shift(0, 0.21, frame.v), top - 1.25 / V, 0.4, 4.5 / V, 0.56);
        box(
          shift(u, 0.29, frame.u),
          shift(0, 0.21, frame.v),
          top + 1.25 / V,
          0.4,
          0.5 / V,
          0.56,
          trim,
        );
      }
    }
  }
  return batch.finish(`building-detail:${b.id}:posta-corner-piers`);
}
