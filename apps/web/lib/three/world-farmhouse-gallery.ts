import { worldWallRecords, buildingWallAtPoint, wallFrameRecords } from './world-wall-records';
import { Group, Vector3 } from 'three';
import { entranceFrame } from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { WorldBatch, roofTextureProjector } from './world-geometry';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import { subtractRectangle } from './world-climb-openings';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** The rural gallery has exposed front posts and a joined shallow return.
 * Every low member remains in its actual solid support cell. */
export function farmhouseGallery(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  edgeDetails: (panels: readonly (readonly Vector3[])[], low: number) => Group,
) {
  const root = new Group();
  root.name = `building-detail:${b.id}:farmhouse-gallery`;
  if (height < 2.4) {
    return root;
  }
  const walls = worldWallRecords(input).filter((tile) => tile.buildingId === b.id),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    inset = buildingArtInset(b, input),
    along = inset * (frame.u.x + frame.u.y),
    depth = inset * (frame.v.x + frame.v.y),
    V = 25.066666666666666,
    low = height - 4 / V,
    high = height + 3 / V,
    length = Math.max(1, Math.round(frame.depth * 0.57)),
    wood = materials.get('wood'),
    stone = materials.get('stone', {
      architectureRole: 'volume',
      colour: '#a99a79',
    }),
    roof = materials.get(buildingAppearance(b)['roofFinish']),
    light = illuminationAt(input, b),
    batch = new WorldBatch(geometry);
  const wallAt = (u: number, v: number) => {
    const p = frame.at(u, v);
    return buildingWallAtPoint(walls, p, b);
  };
  const at = (u: number, v: number, y: number) => {
    const p = frame.at(u, v);
    return new Vector3((p.x + inset) * T, base + y, (p.y + inset) * T);
  };
  const rectangle = (u0: number, v0: number, u1: number, v1: number) => {
    const a = at(u0, v0, 0),
      c = at(u1, v1, 0);
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
  const box = (rect: ReturnType<typeof rectangle>, bottom: number, top: number, material = wood) =>
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
  const supported = (u: number, v: number, rect: ReturnType<typeof rectangle>) => {
    const p = frame.at(u, v);
    return {
      minX: Math.max(rect.minX, (p.x - 0.49) * T),
      maxX: Math.min(rect.maxX, (p.x + 0.49) * T),
      minZ: Math.max(rect.minZ, (p.y - 0.49) * T),
      maxZ: Math.min(rect.maxZ, (p.y + 0.49) * T),
    };
  };
  const frontSupports = [
      ...new Set([0, 0.3, 0.7, 1].map((r) => Math.round(frame.width * r))),
    ].filter((u) => wallAt(u, 0)?.type === 'wall'),
    sideSupports = [0, length].filter((v) => wallAt(0, v)?.type === 'wall');
  const frontRect =
      frontSupports.length >= 2
        ? rectangle(
            Math.min(...frontSupports) - 0.45,
            -0.45,
            Math.max(...frontSupports) + 0.15,
            0.42,
          )
        : undefined,
    sideRect = rectangle(-0.45, -0.45, 0.42, length + 0.15),
    hasFront = Boolean(frontRect && !walking(frontRect, high)),
    hasSide = sideSupports.length === 2 && !walking(sideRect, high),
    joint = hasFront && hasSide && frontSupports[0] === 0,
    panels: Vector3[][] = [];
  const post = (supportU: number, supportV: number, u: number, v: number) => {
    const shaft = supported(
        supportU,
        supportV,
        rectangle(u - 0.075, v - 0.075, u + 0.075, v + 0.075),
      ),
      foot = supported(supportU, supportV, rectangle(u - 0.13, v - 0.13, u + 0.13, v + 0.13));
    if (shaft.maxX <= shaft.minX || shaft.maxZ <= shaft.minZ || walking(foot, low)) {
      return false;
    }
    box(foot, 0, 4 / V, stone);
    box(shaft, 4 / V, low);
    return true;
  };
  let frontBeam: ReturnType<typeof rectangle> | undefined;
  if (hasFront) {
    const lo = Math.min(...frontSupports),
      hi = Math.max(...frontSupports);
    for (const support of frontSupports) {
      const u = support === 0 && joint ? -0.3 : support,
        v = -0.3;
      if (!post(support, 0, u, v)) {
        continue;
      }
      const radius = 0.9 / V,
        pad = radius / T,
        actualU = u + along,
        actualV = v + depth,
        first = Math.max(support - 0.49 + pad, actualU),
        last = Math.min(support + 0.49 - pad, actualU),
        safeV = Math.max(-0.49 + pad, Math.min(0.49 - pad, actualV));
      for (const sign of [-1, 1]) {
        const end = Math.max(
            support - 0.49 + pad,
            Math.min(
              support + 0.49 - pad,
              Math.max(joint ? -0.3 : lo, Math.min(hi, u + sign * 0.35)) + along,
            ),
          ),
          start = sign < 0 ? first : last;
        if (Math.abs(end - start) > 0.05) {
          batch.cylinder(
            wood,
            at(start - along, safeV - depth, low - 9 / V),
            at(end - along, safeV - depth, low - 1 / V),
            radius,
            light,
          );
        }
      }
    }
    frontBeam = rectangle(joint ? -0.3 : lo, -0.41, hi + 0.1, -0.18);
    box(frontBeam, low - 3 / V, low);
    panels.push([
      at(joint ? -0.45 : lo - 0.15, -0.45, low),
      at(hi + 0.15, -0.45, low),
      at(hi + 0.15, 0.42, high),
      at(joint ? 0.42 : lo - 0.15, 0.42, high),
    ]);
  }
  if (hasSide) {
    for (const v of sideSupports) {
      if (v !== 0 || !joint) {
        post(0, v, -0.3, v === 0 && joint ? -0.3 : v);
      }
    }
    const rect = rectangle(-0.41, joint ? -0.3 : 0, -0.18, length),
      parts = frontBeam ? subtractRectangle(rect, frontBeam) : [rect];
    for (const part of parts) {
      box(part, low - 3 / V, low);
    }
    panels.push([
      at(-0.45, length + 0.15, low),
      at(-0.45, joint ? -0.45 : 0, low),
      at(0.42, joint ? 0.42 : 0, high),
      at(0.42, length + 0.15, high),
    ]);
  }
  for (const panel of panels) {
    batch.polygon(roof, panel, light, roofTextureProjector(panel));
  }
  if (panels.length) {
    root.add(batch.finish(`building-detail:${b.id}:farmhouse-gallery-fabric`));
    root.add(edgeDetails(panels, base + low));
  }
  return root;
}
