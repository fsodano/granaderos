import { worldWallRecords, buildingWallAtPoint, wallFrameRecords } from './world-wall-records';
import { Group, Quaternion, Vector3 } from 'three';
import { entranceFrame, getBuildingProfile } from '../../../../packages/game/building-profile.ts';
import { WorldBatch } from './world-geometry';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** The retained depot sprite has substantial stone piers and a timber roof
 * hatch. These details bear on real wall cells; the hatch is exterior scenery. */
export function depotFacade(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  rise: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  legacy = false,
) {
  const walls = worldWallRecords(input).filter((tile) => tile.buildingId === b.id),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    inset = buildingArtInset(b, input),
    V = 25.066666666666666;
  const root = new Group();
  root.name = `building-depot-facade:${b.id}`;
  const rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.atan2(-frame.u.y, frame.u.x),
    ),
    light = illuminationAt(input, b),
    profile = getBuildingProfile(b),
    authored = !(legacy && b.wallFinish === undefined),
    stone = materials.get(
      'stone',
      authored ? { architectureRole: 'volume', colour: '#a99a79' } : {},
    ),
    wood = materials.get('wood'),
    iron = materials.get('iron');
  const at = (u: number, v: number, y: number) => {
    const p = frame.at(u, v);
    return new Vector3((p.x + inset) * T, base + y, (p.y + inset) * T);
  };
  const wallAt = (u: number, v: number) => {
    const p = frame.at(u, v);
    return buildingWallAtPoint(walls, p, b);
  };
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
    u: number,
    v: number,
    y: number,
    w: number,
    h: number,
    d: number,
    material = stone,
  ) => batch.primitive('box', material, at(u, v, y), [w * T, h, d * T], rotation, light);

  feature('depot-masonry-piers', (batch) => {
    for (const u of [0, frame.width]) {
      for (let v = 0; v <= frame.depth; v++) {
        if ((v === 0 || v === frame.depth || v % 3 === 0) && wallAt(u, v)?.type === 'wall') {
          // Each outer stone face reaches 49% of its solid cell. The shaft joins
          // the art-inset shell, while its wider foot stays clear of walking cells.
          const shift = (value: number, target: number, axis: { x: number; y: number }) =>
              value - (inset - (inset === 0 ? 0 : target)) * (axis.x + axis.y),
            top = height - 3 / V,
            foot = Math.min((profile.plinthHeight + 2) / V, top * 0.4);
          const source = authored && inset === 0,
            footW = source ? 0.72 : 0.7,
            footD = source ? 0.52 : 0.7,
            capitalD = source ? 0.46 : 0.66,
            footU = shift(u, 0.14, frame.u),
            footV = shift(v, 0.14, frame.v),
            point = at(footU, footV, 0),
            halfX = (Math.abs(frame.u.x) * footW + Math.abs(frame.v.x) * footD) * T * 0.5,
            halfZ = (Math.abs(frame.u.y) * footW + Math.abs(frame.v.y) * footD) * T * 0.5;
          if (
            authored &&
            (input.terrain.upperSurfaces ?? []).some(
              (surface) =>
                !surface.blocked &&
                (surface.tacticalLevel ?? 0) > 0 &&
                (surface.elevation ?? 3) <= base + height - 2 / V + 0.01 &&
                (surface.x + 0.5) * T > point.x - halfX + 1e-6 &&
                (surface.x - 0.5) * T < point.x + halfX - 1e-6 &&
                (surface.y + 0.5) * T > point.z - halfZ + 1e-6 &&
                (surface.y - 0.5) * T < point.z + halfZ - 1e-6,
            )
          ) {
            continue;
          }
          const bottom = source ? foot : 0,
            bodyTop = source ? height - 7 / V : top;
          if (bodyTop <= bottom) {
            continue;
          }
          box(
            batch,
            shift(u, 0.2, frame.u),
            shift(v, 0.3, frame.v),
            (bottom + bodyTop) * 0.5,
            0.58,
            bodyTop - bottom,
            0.38,
          );
          box(batch, footU, footV, foot * 0.5, footW, foot, footD);
          box(
            batch,
            shift(u, 0.16, frame.u),
            shift(v, 0.16, frame.v),
            height - 4.5 / V,
            0.66,
            5 / V,
            capitalD,
          );
        }
      }
    }
  });

  const support = Math.round(frame.width * 0.5),
    u = support - inset * (frame.u.x + frame.u.y),
    bottom = height + 7 / V,
    top = height + rise - 7 / V;
  if (frame.width < 4 || wallAt(support, 0)?.type !== 'wall' || top - bottom < 0.12) {
    return root;
  }
  const point = at(u, -0.16, 0),
    walking = (input.terrain.upperSurfaces ?? []).some((surface) => {
      const x = surface.x * T - point.x,
        z = surface.y * T - point.z;
      return (
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        Math.abs(x * frame.u.x + z * frame.u.y) < (0.92 + 1) * T * 0.5 &&
        Math.abs(x * frame.v.x + z * frame.v.y) < (0.68 + 1) * T * 0.5
      );
    });
  if (walking) {
    return root;
  }
  feature('depot-loft-hatch', (batch) => {
    box(batch, u, -0.0275, (bottom + top) * 0.5, 0.92, top - bottom, 0.095, wood);
    for (const side of [-1, 1]) {
      box(
        batch,
        u + side * 0.46,
        -0.082,
        (bottom + top) * 0.5,
        0.045,
        top - bottom + 0.08,
        0.045,
        wood,
      );
    }
    for (const y of [bottom, top]) {
      box(batch, u, -0.082, y, 1.0, 0.065, 0.045, wood);
    }
    for (const y of [bottom + 3 / V, top - 3 / V]) {
      box(batch, u, -0.083, y, 0.91, 1.1 / V, 0.022 / T, iron);
    }
    box(batch, u, -0.084, (bottom + top) * 0.5, 1.1 / V / T, top - bottom, 0.022 / T, iron);
    batch.cylinder(
      wood,
      at(u - 0.39, -0.095, bottom + 3 / V),
      at(u + 0.39, -0.095, top - 3 / V),
      (1.5 / V) * 0.5,
      light,
    );
  });
  feature('depot-loft-hoist', (batch) => {
    const boom = top + 3 / V,
      rope = materials.get('depot-rope', { colour: '#8f7951' });
    box(batch, u, -0.16, boom - 0.5 / V, 0.11, 3 / V, 0.62, wood);
    batch.cylinder(
      wood,
      at(u, -0.04, boom - 9 / V),
      at(u, -0.43, boom - 1 / V),
      (2.4 / V) * 0.5,
      light,
    );
    const pulleyRotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      new Vector3(frame.u.x, 0, frame.u.y),
    );
    batch.primitive(
      'torus',
      wood,
      at(u, -0.43, boom - 1 / V),
      [2 / V, 2 / V, 2 / V],
      pulleyRotation,
      light,
    );
    batch.cylinder(rope, at(u, -0.43, boom - 1 / V), at(u, -0.43, bottom - 1 / V), 0.012, light);
  });
  return root;
}
