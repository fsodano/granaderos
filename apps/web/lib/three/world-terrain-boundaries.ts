import { required } from './required';
import { Vector3 } from 'three';
import { terrainMaterial } from '../../../../packages/game/regional-terrain.js';
import { WorldBatch, seeded } from './world-geometry';
import { worldKey } from './world-materials';
import type { WorldMaterialSource } from './world-materials';
import type { WorldTile } from './world-types';

const sides = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;
const outdoor = (tile: WorldTile) =>
  !tile.buildingId && !tile.roomId && !tile.blocked && (tile.tacticalLevel ?? 0) === 0;

/** Flat, disjoint partitions use only admitted ground records. Each tongue
 * stays inside its centre-to-edge triangle, leaving cell corners untouched. */
export function soilGrassTop(
  batch: WorldBatch,
  tile: WorldTile,
  all: ReadonlyMap<string, WorldTile>,
  sceneId: string | undefined,
  T: number,
  materials: WorldMaterialSource,
  light: number,
  context?: { world: { landscapes: Record<string, string> } },
) {
  if (
    !outdoor(tile) ||
    !['road', 'stone'].includes(tile.type) ||
    terrainMaterial(tile, sceneId, context) !== 'dirt'
  ) {
    return false;
  }
  const neighbours = sides.map(([dx, dy]) => all.get(worldKey({ x: tile.x + dx, y: tile.y + dy })));
  const kinds = neighbours.map((neighbour) =>
    neighbour &&
    outdoor(neighbour) &&
    ['grass', 'scrub', 'forest'].includes(neighbour.type) &&
    (neighbour.elevation ?? 0) === (tile.elevation ?? 0)
      ? terrainMaterial(neighbour, sceneId, context)
      : undefined,
  );
  if (!kinds.some((kind) => kind === 'dry-grass' || kind === 'green-grass')) {
    return false;
  }
  const x = tile.x * T,
    z = tile.y * T,
    h = tile.elevation ?? 0,
    centre = new Vector3(x, h, z),
    soil = materials.terrain('dirt');
  const corners = [
    new Vector3(x - T * 0.5, h, z - T * 0.5),
    new Vector3(x - T * 0.5, h, z + T * 0.5),
    new Vector3(x + T * 0.5, h, z + T * 0.5),
    new Vector3(x + T * 0.5, h, z - T * 0.5),
  ];
  for (let side = 0; side < 4; side++) {
    const a = required(corners[side]),
      b = required(corners[(side + 1) % 4]),
      kind = kinds[side];
    if (kind !== 'dry-grass' && kind !== 'green-grass') {
      batch.polygon(soil, [centre, a, b], light);
      continue;
    }
    const salt = 251 + side * 37,
      random = (n: number) => seeded(tile.x, tile.y, salt + n * 13),
      position = 0.36 + random(0) * 0.28,
      width = 0.2 + random(1) * 0.08;
    const low = position - width,
      high = position + width,
      depth = (0.06 + random(2) * 0.1) * T,
      [dx, dy] = required(sides[side]);
    const point = (along: number, inward = 0) =>
      a
        .clone()
        .lerp(b, along)
        .add(new Vector3(-dx * inward, 0, -dy * inward));
    const tongue = [
      point(low),
      point(low + (high - low) * (0.28 + random(3) * 0.1), depth * (0.85 + random(4) * 0.15)),
      point(low + (high - low) * (0.62 + random(5) * 0.1), depth * (0.85 + random(6) * 0.15)),
      point(high),
    ];
    const path = [a, ...tongue, b];
    for (let n = 0; n < path.length - 1; n++) {
      batch.polygon(soil, [centre, required(path[n]), required(path[n + 1])], light);
    }
    // Reverse the boundary path so both materials retain upward normals and
    // the existing world-metre UV projector, including authored elevation.
    batch.polygon(materials.terrain(kind), [...tongue].reverse(), light);
  }
  return true;
}
