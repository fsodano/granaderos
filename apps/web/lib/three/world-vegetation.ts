import { Quaternion, Vector3 } from 'three';
import { WorldBatch, seeded } from './world-geometry';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldInput, WorldTile } from './world-types';

export function softenedFoliage(
  tiles: readonly WorldTile[],
  input: WorldInput,
) {
  return tiles
    .filter(
      (tile) =>
        tile.type === 'forest' &&
        (input.admittedActorPoints ?? []).some(
          (point) =>
            (point.tacticalLevel ?? 0) === (tile.tacticalLevel ?? 0) &&
            Math.abs(point.x - tile.x) < 1.4 &&
            Math.abs(point.y - tile.y) < 1.4,
        ),
    )
    .map((tile) => `${tile.x},${tile.y}`);
}
export function buildVegetationChunk(
  id: string,
  tiles: readonly WorldTile[],
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    soft = new Set(softenedFoliage(tiles, input));
  const up = new Vector3(0, 1, 0);
  for (const tile of tiles) {
    if (!['forest', 'scrub'].includes(tile.type) || tile.buildingId) {
      continue;
    }
    const seed = seeded(tile.x, tile.y),
      light = illuminationAt(input, tile),
      x = tile.x * T,
      z = tile.y * T,
      ground = tile.elevation ?? 0,
      tree = tile.type === 'forest' && seed > 0.2;
    const faded = soft.has(`${tile.x},${tile.y}`),
      leaf = materials.get(seed > 0.7 ? 'poplar' : 'leaf', {
        opacity: faded ? 0.42 : 1,
      });
    if (!tree) {
      for (let n = 0; n < 4; n++) {
        const dx = (seeded(tile.x, tile.y, n + 23) - 0.5) * 0.53,
          dz = (seeded(tile.y, tile.x, n + 11) - 0.5) * 0.53,
          r = 0.23 + seeded(tile.x, tile.y, n + 63) * 0.15,
          angle = seeded(tile.y, tile.x, n + 41) * Math.PI * 2;
        batch.primitive(
          `leaf-spray-${n % 3}`,
          leaf,
          [x + dx, ground + r * 0.48, z + dz],
          [r * 1.15, r * 0.55, r * 0.84],
          new Quaternion().setFromAxisAngle(up, angle),
          light * (0.88 + n * 0.035),
        );
      }
      continue;
    }
    const height = 2.6 + seed * 2.1,
      trunk = materials.get('trunk'),
      leanAngle = seeded(tile.y, tile.x, 73) * Math.PI * 2,
      lean = 0.1 + seeded(tile.x, tile.y, 71) * 0.18;
    const direction = new Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle));
    const root = new Vector3(x, ground, z),
      knot = root
        .clone()
        .addScaledVector(direction, lean * 0.18)
        .add(new Vector3(0, height * 0.22, 0));
    const shoulder = root
      .clone()
      .addScaledVector(direction, lean * 0.72)
      .add(
        new Vector3(
          -Math.sin(leanAngle) * 0.045,
          height * 0.46,
          Math.cos(leanAngle) * 0.045,
        ),
      );
    const leader = root
      .clone()
      .addScaledVector(direction, lean)
      .add(new Vector3(0, height * 0.73, 0));
    const radius = 0.075 + seed * 0.035;
    // Connected tapers and low root flares keep the exact rooted cell, while
    // breaking the silhouette of a single straight pole. No new materials or
    // per-tree meshes are needed: all parts retain the existing chunk batching.
    batch.cylinder(trunk, root, knot, radius, light * 0.86, 'taper');
    batch.cylinder(trunk, knot, shoulder, radius * 0.8, light * 0.95, 'taper');
    batch.cylinder(trunk, shoulder, leader, radius * 0.63, light, 'taper');
    for (let n = 0; n < 3; n++) {
      const angle =
        leanAngle + n * 2.094 + seeded(tile.x, tile.y, n + 81) * 0.4;
      batch.cylinder(
        trunk,
        new Vector3(
          x + Math.cos(angle) * 0.19,
          ground + 0.025,
          z + Math.sin(angle) * 0.19,
        ),
        root.clone().add(new Vector3(0, 0.23, 0)),
        radius * 0.34,
        light * 0.78,
        'taper',
      );
    }
    const poplar = seed > 0.7;
    // Broad trees carry irregular shallow sprays on forked branches. Poplar
    // sprays stay upright and close to the leader. Open folded leaves retain
    // every old crown bound, while using fewer faces than the closed lobes.
    for (let n = 0; n < 6; n++) {
      const variation = seeded(tile.x, tile.y, n + 17),
        angle = n * 2.399 + seed * 5 + variation * 0.55;
      const originHeight = 0.39 + variation * 0.18,
        start =
          originHeight <= 0.46
            ? knot.clone().lerp(shoulder, (originHeight - 0.22) / 0.24)
            : shoulder.clone().lerp(leader, (originHeight - 0.46) / 0.27);
      const spread =
        (poplar ? 0.24 : 0.39) + variation * (poplar ? 0.16 : 0.43);
      const end = root
        .clone()
        .addScaledVector(direction, lean * 0.85)
        .add(
          new Vector3(
            Math.cos(angle) * spread,
            height *
              (poplar ? 0.5 + n * 0.063 : 0.6 + n * 0.034 + variation * 0.045),
            Math.sin(angle) * spread,
          ),
        );
      batch.cylinder(
        trunk,
        start,
        end,
        0.021 + (1 - variation) * 0.011,
        light * (0.88 + variation * 0.1),
        'taper',
      );
      for (const side of [-1, 1]) {
        const reach = (poplar ? 0.11 : 0.2) + variation * 0.07,
          forkAngle = angle + side * (0.7 + variation * 0.3),
          fork = end
            .clone()
            .add(
              new Vector3(
                Math.cos(forkAngle) * reach,
                0.08 + variation * 0.08,
                Math.sin(forkAngle) * reach,
              ),
            );
        batch.cylinder(
          trunk,
          end,
          fork,
          0.009 + (1 - variation) * 0.003,
          light * 0.9,
          'taper',
        );
        const r = (poplar ? 0.23 : 0.31) + variation * (poplar ? 0.1 : 0.13),
          rotation = new Quaternion()
            .setFromAxisAngle(up, forkAngle)
            .multiply(
              new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                side * (0.12 + variation * 0.23),
              ),
            );
        batch.primitive(
          `leaf-spray-${(n + (side > 0 ? 1 : 0)) % 3}`,
          leaf,
          fork.clone().add(new Vector3(0, poplar ? 0.16 : 0.08, 0)),
          [
            r * (poplar ? 0.82 : 1.48),
            r * (poplar ? 1.5 : 0.62),
            r * (0.78 + variation * 0.15),
          ],
          rotation,
          light * (0.78 + n * 0.028 + variation * 0.05),
        );
      }
    }
  }
  const group = batch.finish(`vegetation:${id}`);
  group.userData['kind'] = 'vegetation';
  group.userData['softenedCells'] = [...soft];
  return group;
}
