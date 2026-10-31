import { required } from './required';
import { worldWallRecords, buildingWallAtPoint, wallFrameRecords } from './world-wall-records';
import { Group, Vector3 } from 'three';
import { entranceFrame, getBuildingProfile } from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { buildingStyle } from '../../../../packages/game/building-types.ts';
import { WorldBatch } from './world-geometry';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import type { WorldGeometry, PolygonUV } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** Sloping masonry supports follow the direct warehouse sprite. Each closed
 * wedge occupies one intact side-wall cell and stays below its real eave. */
export function warehouseButtresses(
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
  root.name = `building-warehouse-buttresses:${b.id}`;
  if (height < 0.8) {
    return root;
  }
  const walls = worldWallRecords(input).filter((tile) => tile.buildingId === b.id),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    inset = buildingArtInset(b, input),
    appearance = buildingAppearance(b),
    profile = getBuildingProfile(b),
    batch = new WorldBatch(geometry),
    light = illuminationAt(input, b),
    V = 25.066666666666666;
  const authored = !legacy || b.wallFinish !== undefined,
    stoneBody = authored && appearance['wallFinish'] === 'stone';
  const wall = materials.get(
      appearance['wallFinish'],
      !authored
        ? { colour: buildingStyle(b).wall }
        : stoneBody
          ? { architectureRole: 'volume' }
          : {},
    ),
    stone = materials.get(
      'stone',
      authored ? { architectureRole: 'volume', colour: '#a99a79' } : {},
    );
  // ArchitectureVolume uses each authored finish's pale trim on its sloped
  // cap. Keep that local coping separate from the textured masonry body.
  const copingColours: Record<string, string> = {
      adobe: '#cab48e',
      limewash: '#eee6d1',
      ochre: '#e4d3ab',
      stone: '#c5bd9f',
      brick: '#cfb490',
    },
    coping = materials.get('masonry-coping', {
      colour: !authored
        ? buildingStyle(b).trim
        : (copingColours[appearance['wallFinish']] ?? copingColours['stone']),
    });
  const at = (u: number, v: number, y: number) => {
    const p = frame.at(u, v);
    return new Vector3((p.x + inset) * T, base + y, (p.y + inset) * T);
  };
  const face = (material: ReturnType<WorldMaterialSource['get']>, points: Vector3[], shade = 1) => {
    const normal = required(points[1])
      .clone()
      .sub(required(points[0]))
      .cross(required(points[2]).clone().sub(required(points[0])))
      .normalize();
    const uv: PolygonUV =
      Math.abs(normal.y) > 0.5
        ? (p) => [p.x, p.z] as const
        : Math.abs(normal.x) > Math.abs(normal.z)
          ? (p) => [p.z * (normal.x > 0 ? -1 : 1), p.y] as const
          : (p) => [p.x * (normal.z > 0 ? 1 : -1), p.y] as const;
    const first = uv(required(points[0]));
    batch.polygon(material, points, light * shade, (p) => {
      const value = uv(p);
      return [value[0] - first[0], value[1]];
    });
  };
  for (const u of [0, frame.width]) {
    for (let v = 2; v < frame.depth; v += 3) {
      const p = frame.at(u, v);
      if (buildingWallAtPoint(walls, p, b)?.type !== 'wall') {
        continue;
      }
      const shift = inset === 0 ? 0 : 0.3,
        a = u - shift * (frame.u.x + frame.u.y),
        c = v - shift * (frame.v.x + frame.v.y),
        out = u === 0 ? -1 : 1,
        inner = height - 12 / V,
        outer = Math.min(height * 0.59, inner - 0.04),
        foot = Math.min((profile.plinthHeight + 2) / V, outer * 0.6);
      const plan = [
          [-0.39, -0.19],
          [0.39, -0.19],
          [0.39, 0.19],
          [-0.39, 0.19],
        ] as const,
        bottom = plan.map(([x, z]) => at(a + x, c + z, 0)),
        feet = plan.map(([x, z]) => at(a + x, c + z, foot)),
        top = plan.map(([x, z]) => at(a + x, c + z, x * out > 0 ? outer : inner));
      // Join the body at the top of the footing. Overlapping plaster and stone
      // on a shared outer plane would flicker on authored non-stone walls.
      face(coping, [...top].reverse());
      face(wall, feet);
      // The current stone source overlays its map at 60% on the authored base.
      // Native normal lighting then shades the wedge, without a second uniform
      // brightness guess. Other authored textures retain their released choice.
      for (let n = 0; n < 4; n++) {
        const next = (n + 1) % 4;
        face(
          wall,
          [required(feet[n]), required(feet[next]), required(top[next]), required(top[n])],
          stoneBody ? 1 : 0.86,
        );
      }
      face(stone, [...feet].reverse());
      for (let n = 0; n < 4; n++) {
        const next = (n + 1) % 4;
        face(stone, [
          required(bottom[n]),
          required(bottom[next]),
          required(feet[next]),
          required(feet[n]),
        ]);
      }
    }
  }
  const node = batch.finish(`building-detail:${b.id}:warehouse-buttresses`);
  if (node.children.length) {
    root.add(node);
  }
  return root;
}
