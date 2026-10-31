import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { seeded } from './world-geometry';
import type { WorldBatch } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldTile } from './world-types';

/** Occasional six-triangle dry stems share the existing grass material.
 * Their roots meet the authored ground; they add no obstruction record. */
export function dryWeeds(
  batch: WorldBatch,
  tile: WorldTile,
  kind: string,
  T: number,
  materials: WorldMaterialSource,
  light: number,
) {
  if (
    kind !== 'dry-grass' ||
    !['grass', 'scrub'].includes(tile.type) ||
    tile.buildingId ||
    tile.roomId ||
    tile.blocked ||
    (tile.tacticalLevel ?? 0) !== 0
  ) {
    return;
  }
  if (
    seeded(Math.floor(tile.x / 3), Math.floor(tile.y / 3), 907) < 0.3 ||
    seeded(tile.x, tile.y, 929) > (tile.type === 'scrub' ? 0.32 : 0.24)
  ) {
    return;
  }
  const count = seeded(tile.y, tile.x, 947) > 0.82 ? 2 : 1,
    x = tile.x * T,
    z = tile.y * T,
    ground = tile.elevation ?? 0;
  for (let n = 0; n < count; n++) {
    const random = (salt: number) => seeded(tile.x, tile.y, salt + n * 37),
      angle = random(967) * Math.PI * 2,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const rootX = x + (random(983) - 0.5) * T * 0.62,
      rootZ = z + (seeded(tile.y, tile.x, 997 + n * 37) - 0.5) * T * 0.62;
    const height = (0.24 + random(1019) * 0.18) * T,
      width = (0.006 + random(1031) * 0.003) * T,
      lean = (random(1049) - 0.5) * height * 0.6;
    const point = (across: number, y: number, depth = 0) =>
      new Vector3(rootX + across * c - depth * s, ground + y, rootZ + across * s + depth * c);
    const a = point(-width, 0),
      b = point(width, 0),
      d = point(lean * 0.46 - width * 0.65, height * 0.56),
      e = point(lean * 0.46 + width * 0.65, height * 0.56);
    const f = point(lean - width * 0.18, height),
      g = point(lean + width * 0.18, height);
    const left = point(
      lean * 0.46 - height * (0.16 + random(1061) * 0.13),
      height * (0.71 + random(1087) * 0.13),
      height * (random(1091) - 0.5) * 0.13,
    );
    const right = point(
      lean * 0.46 + height * (0.13 + random(1103) * 0.14),
      height * (0.68 + random(1117) * 0.14),
      height * (random(1123) - 0.5) * 0.13,
    );
    const vertices: number[] = [],
      colours: number[] = [],
      shade = 0.86 + random(1151) * 0.14;
    for (const face of [
      [a, b, e],
      [a, e, d],
      [d, e, g],
      [d, g, f],
      [d, e, left],
      [e, d, right],
    ] as const) {
      for (const p of face) {
        vertices.push(p.x, p.y, p.z);
        const tone = shade * (0.84 + (0.16 * (p.y - ground)) / height);
        colours.push(tone * 0.8, tone * 0.58, tone * 0.4);
      }
    }
    const geometry = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array(vertices), 3),
    );
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    batch.add(geometry, materials.get('grass'), undefined, light);
    geometry.dispose();
  }
}
