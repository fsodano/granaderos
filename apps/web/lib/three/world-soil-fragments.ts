import { Vector3 } from 'three';
import { seeded } from './world-geometry';
import type { WorldBatch } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldTile } from './world-types';

/** Sparse clusters of shallow six-triangle chips. The four footprint corners
 * meet the exact ground height; no physics or obstruction record is added. */
export function soilFragments(
  batch: WorldBatch,
  tile: WorldTile,
  kind: string,
  T: number,
  materials: WorldMaterialSource,
  light: number,
) {
  if (
    kind !== 'dirt' ||
    !['road', 'stone'].includes(tile.type) ||
    tile.buildingId ||
    tile.roomId ||
    tile.blocked ||
    (tile.tacticalLevel ?? 0) !== 0
  ) {
    return;
  }
  // Quiet patches and local omissions keep the soil visible between groups.
  if (
    seeded(Math.floor(tile.x / 3), Math.floor(tile.y / 3), 401) < 0.32 ||
    seeded(tile.x, tile.y, 503) > 0.32
  ) {
    return;
  }
  const x = tile.x * T,
    z = tile.y * T,
    h = tile.elevation ?? 0,
    stone = materials.get('stone'),
    count = seeded(tile.x, tile.y, 811) > 0.72 ? 3 : 2;
  const centreX = x + (seeded(tile.x, tile.y, 601) - 0.5) * T * 0.52,
    centreZ = z + (seeded(tile.y, tile.x, 619) - 0.5) * T * 0.52;
  for (let n = 0; n < count; n++) {
    const random = (salt: number) => seeded(tile.x, tile.y, salt + n * 29),
      angle = random(641) * Math.PI * 2,
      reach = (0.035 + random(659) * 0.1) * T;
    const rootX = centreX + Math.cos(angle) * reach,
      rootZ = centreZ + Math.sin(angle) * reach,
      rotation = random(677) * Math.PI * 2,
      c = Math.cos(rotation),
      s = Math.sin(rotation);
    const w = (0.0225 + random(691) * 0.0175) * T,
      l = (0.0325 + random(709) * 0.0275) * T,
      rise = (0.005 + random(727) * 0.008) * T;
    const point = (px: number, pz: number, height = 0) =>
      new Vector3(rootX + px * c - pz * s, h + height, rootZ + px * s + pz * c);
    const a = point(-w * (0.85 + random(761) * 0.15), -l),
      b = point(-w, l * (0.78 + random(769) * 0.22)),
      d = point(w, -l * (0.78 + random(787) * 0.22)),
      corner = point(w * (0.78 + random(777) * 0.22), l),
      p = point(-w * 0.1, -l * 0.22, rise),
      q = point(w * 0.08, l * 0.18, rise * 0.88);
    // Broad muted contrast keeps the small chips readable on pale dirt.
    const shade = light * (0.65 + random(743) * 0.2);
    batch.polygon(stone, [a, b, q, p], shade);
    batch.polygon(stone, [p, q, corner, d], shade);
    batch.polygon(stone, [a, p, d], shade * 0.86);
    batch.polygon(stone, [b, corner, q], shade * 0.86);
  }
}
