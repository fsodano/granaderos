import { required } from './required';
import {
  worldWallRecords,
  buildingWallAtPoint,
  wallFrameRecords,
} from './world-wall-records';
import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { entranceFrame } from '../../../../packages/game/building-profile.ts';
import { buildingAppearance } from '../../../../packages/game/building-appearance.ts';
import { buildingStyle } from '../../../../packages/game/building-types.ts';
import { WorldBatch, roofTextureProjector } from './world-geometry';
import { addDoorLeaf } from './world-building-doors';
import { illuminationAt } from './world-materials';
import { buildingArtInset } from './world-building-placement';
import { palaceColumns } from './world-palace-columns';
import { civicStoreyBands } from './world-civic-storey-bands';
import { palacePorticoHipReturn } from './world-palace-portico';
import {
  buildingRenderProfile,
  selectedBuildingStyle,
} from './world-building-style';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** Formal palace details follow authored walls rather than filling floor cells. */
export function palaceFacade(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  legacy: boolean,
  edgeDetails: (panels: readonly (readonly Vector3[])[], eave: number) => Group,
) {
  const walls = worldWallRecords(input).filter(
      (tile) => tile.buildingId === b.id,
    ),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    appearance = buildingAppearance({
      ...b,
      ...(b.roofFinish
        ? { roofFinish: b.roofFinish }
        : b.roof === 'thatch'
          ? { roofFinish: 'thatch' }
          : {}),
    }),
    light = illuminationAt(input, b);
  const wall = materials.get(
      appearance['wallFinish'],
      legacy && b.wallFinish === undefined
        ? { colour: buildingStyle(b).wall }
        : { architectureRole: 'volume' },
    ),
    trim = materials.get(
      'trim',
      legacy ? { colour: buildingStyle(b).trim } : {},
    ),
    stone = materials.get('stone'),
    dark = materials.get('darkwood'),
    iron = materials.get('iron'),
    bars = materials.get('iron', { colour: '#a7ae9b' });
  const rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.atan2(-frame.u.y, frame.u.x),
    ),
    wallInset = buildingArtInset(b, input),
    alongInset = wallInset * (frame.u.x + frame.u.y),
    depthInset = wallInset * (frame.v.x + frame.v.y),
    doorU = frame.doorU - alongInset;
  const at = (u: number, v: number, y: number) => {
    const p = frame.at(u, v);
    return new Vector3((p.x + wallInset) * T, base + y, (p.y + wallInset) * T);
  };
  const wallAt = (u: number, v: number) => {
    const p = frame.at(u, v);
    return buildingWallAtPoint(walls, p, b);
  };
  const bearing = (u: number, v = 0, along = false) =>
    [
      u - (along ? alongInset : 0.06 * (frame.u.x + frame.u.y)),
      v - 0.06 * (frame.v.x + frame.v.y),
    ] as const;
  const root = new Group();
  root.name = `palace-facade:${b.id}`;
  let batch = new WorldBatch(geometry);
  const box = (
    u: number,
    v: number,
    y: number,
    w: number,
    h: number,
    d: number,
    material = wall,
  ) =>
    batch.primitive(
      'box',
      material,
      at(u, v, y),
      [w * T, h, d * T],
      rotation,
      light,
    );
  const feature = (name: string, draw: () => void) => {
    const previous = batch;
    batch = new WorldBatch(geometry);
    draw();
    const group = batch.finish(`building-detail:${b.id}:${name}`);
    root.add(group);
    batch = previous;
    return group;
  };
  const twoStoreys = height >= 4 && selectedBuildingStyle(b)?.upper !== false,
    storey = twoStoreys
      ? (height * buildingRenderProfile(b).groundFloorHeight) /
        buildingRenderProfile(b).wallHeight
      : height;
  // Compact edited shells retain their attached corner piers instead of
  // adding a second detached entrance column in the same corner wall cell.
  const supports = [
    ...new Set(
      [-3, -1, 1, 3].map((offset) => Math.round(frame.doorU + offset)),
    ),
  ].filter((u) => u > 0 && u < frame.width && wallAt(u, 0)?.type === 'wall');
  const hasBalcony =
    twoStoreys &&
    supports.some((u) => u < frame.doorU - 0.66) &&
    supports.some((u) => u > frame.doorU + 0.66);
  root.userData['storey'] = storey;
  root.userData['balconyFloor'] = hasBalcony ? storey + 0.24 : undefined;
  if (wallInset === 0 && (!legacy || b.wallFinish !== undefined)) {
    root.add(
      palaceColumns(b, input, T, height, base, geometry, materials, supports),
    );
  } else {
    feature('entrance-columns', () => {
      for (const support of supports) {
        const [u, v] = bearing(support, 0, true),
          shaft = twoStoreys ? storey + 0.02 : storey - 0.12;
        box(u, v, shaft * 0.5, 0.31 / T, shaft, 0.38 / T, stone);
        box(u, v, 0.13, 0.38 / T, 0.26, 0.38 / T, stone);
        box(
          u,
          v,
          twoStoreys ? storey + 0.055 : storey - 0.1,
          0.38 / T,
          0.15,
          0.38 / T,
          stone,
        );
      }
    });
    feature('palace-pilasters', () => {
      const pier = (u: number, v: number, w: number, material = wall) => {
        box(
          u,
          v,
          (storey - 0.1) * 0.5,
          w / T,
          storey - 0.1,
          0.38 / T,
          material,
        );
        box(u, v, 0.12, 0.38 / T, 0.24, 0.38 / T, stone);
        box(u, v, storey - 0.08, 0.38 / T, 0.14, 0.38 / T, trim);
      };
      for (const u of [0, frame.width]) {
        for (const v of [0, frame.depth]) {
          if (wallAt(u, v)?.type === 'wall') {
            const [a, c] = bearing(u, v);
            pier(a, c, 0.38, trim);
            if (twoStoreys) {
              box(
                a,
                c,
                (storey + 0.18 + height - 0.16) * 0.5,
                0.38 / T,
                height - storey - 0.34,
                0.38 / T,
                stone,
              );
            }
          }
        }
      }
      for (const u of [0, frame.width]) {
        for (let v = 2; v < frame.depth - 1; v += 4) {
          if (wallAt(u, v)?.type === 'wall') {
            pier(u - 0.06 * (frame.u.x + frame.u.y), v - depthInset, 0.3);
          }
        }
      }
    });
  }
  if (
    twoStoreys &&
    wallInset === 0 &&
    (!legacy || b.wallFinish !== undefined)
  ) {
    root.add(civicStoreyBands(b, input, T, height, base, geometry, materials));
  } else {
    feature('palace-storey-bands', () => {
      const bands = twoStoreys
        ? ([
            [storey, stone],
            [height - 0.1, trim],
          ] as const)
        : ([[height - 0.1, trim]] as const);
      for (const [y, material] of bands) {
        for (const v of [0, frame.depth]) {
          box(
            frame.width * 0.5,
            v + (v === 0 ? -0.1 : 0.1) / T,
            y,
            frame.width + 0.2 / T,
            0.15,
            0.29 / T,
            material,
          );
        }
        for (const u of [0, frame.width]) {
          box(
            u + (u === 0 ? -0.1 : 0.1) / T,
            frame.depth * 0.5,
            y,
            0.29 / T,
            0.15,
            frame.depth,
            material,
          );
        }
      }
    });
  }
  if (twoStoreys) {
    feature('palace-upper-windows', () => {
      const style = appearance['windowStyle'],
        arched = style === 'arched',
        small = style === 'small',
        width = small ? 0.38 : 0.72,
        radius = width * 0.5,
        bottom = storey + (small ? 0.98 : 0.65),
        paneHeight = Math.min(
          arched ? 1.18 : small ? 0.48 : 0.9,
          height - bottom - 0.26,
        ),
        spring = paneHeight - radius;
      const positions = (length: number, parity: number) => {
        const result: number[] = [];
        for (let n = parity || 2; n < length; n += 2) {
          result.push(n);
        }
        if (!result.length && length >= 2) {
          result.push(Math.round(length * 0.5));
        }
        return result;
      };
      const pane = (u: number, v: number, side: number, front: boolean) => {
        const point = (x: number, y: number, d: number) =>
          front
            ? at(u + x / T, v + (side * d) / T, bottom + y)
            : at(u + (side * d) / T, v + x / T, bottom + y);
        const outline: [number, number][] = [
          [-radius, 0],
          [radius, 0],
        ] as const;
        if (arched) {
          outline.push([radius, spring]);
          for (let n = 1; n <= 16; n++) {
            outline.push([
              radius * Math.cos((n * Math.PI) / 16),
              spring + radius * Math.sin((n * Math.PI) / 16),
            ]);
          }
        } else {
          outline.push([radius, paneHeight], [-radius, paneHeight]);
        }
        for (const d of [0.0825, 0.1175]) {
          batch.polygon(
            dark,
            outline.map(([x, y]) => point(x, y, d)),
            light,
          );
        }
        for (let n = 0; n < outline.length; n++) {
          const a = required(outline[n]),
            c = required(outline[(n + 1) % outline.length]);
          batch.polygon(
            dark,
            [
              point(a[0], a[1], 0.0825),
              point(c[0], c[1], 0.0825),
              point(c[0], c[1], 0.1175),
              point(a[0], a[1], 0.1175),
            ],
            light,
          );
        }
        const line = (
          x: number,
          y: number,
          x1: number,
          y1: number,
          r = 0.043,
          material = trim,
        ) =>
          batch.cylinder(
            material,
            point(x, y, 0.145),
            point(x1, y1, 0.145),
            r,
            light,
          );
        line(-radius, 0, radius, 0);
        line(-radius, 0, -radius, arched ? spring : paneHeight);
        line(radius, 0, radius, arched ? spring : paneHeight);
        if (arched) {
          const inner = radius - 0.043,
            outer = radius + 0.043;
          for (let n = 0; n < 16; n++) {
            const a = (n * Math.PI) / 16,
              c = ((n + 1) * Math.PI) / 16,
              arc = (angle: number, r: number, d: number) =>
                point(Math.cos(angle) * r, spring + Math.sin(angle) * r, d);
            for (const d of [0.1125, 0.1775]) {
              batch.polygon(
                trim,
                [
                  arc(a, outer, d),
                  arc(c, outer, d),
                  arc(c, inner, d),
                  arc(a, inner, d),
                ],
                light,
              );
            }
            for (const r of [inner, outer]) {
              batch.polygon(
                trim,
                [
                  arc(a, r, 0.1125),
                  arc(c, r, 0.1125),
                  arc(c, r, 0.1775),
                  arc(a, r, 0.1775),
                ],
                light,
              );
            }
          }
        } else {
          line(-radius, paneHeight, radius, paneHeight);
        }
        if (['arched', 'barred', 'small'].includes(style)) {
          const top = paneHeight - (arched ? 0.22 : 0.055),
            step = small ? 0.09 : 0.16;
          for (const x of [-step, 0, step]) {
            line(x, 0.045, x, top, 0.014, bars);
          }
          if (!small) {
            line(
              -radius + 0.04,
              paneHeight * 0.36,
              radius - 0.04,
              paneHeight * 0.36,
              0.014,
              bars,
            );
          }
        } else if (style === 'lattice') {
          for (const x of [-0.16, 0.16]) {
            line(
              -radius + 0.04,
              paneHeight * 0.3 + x,
              radius - 0.04,
              paneHeight * 0.7 + x,
              0.018,
              materials.get('wood'),
            );
            line(
              -radius + 0.04,
              paneHeight * 0.7 + x,
              radius - 0.04,
              paneHeight * 0.3 + x,
              0.018,
              materials.get('wood'),
            );
          }
        } else if (style === 'shutters') {
          const shutter = materials.get('timber-shutter', {
            colour: '#65705a',
          });
          for (const x of [-radius * 0.65, radius * 0.65]) {
            for (let n = 0; n < 6; n++) {
              line(
                x - radius * 0.22,
                (paneHeight * (n + 0.5)) / 6,
                x + radius * 0.22,
                (paneHeight * (n + 0.5)) / 6,
                0.024,
                shutter,
              );
            }
          }
        }
      };
      for (const v of [0, frame.depth]) {
        for (const u of positions(
          frame.width,
          v === 0 ? Math.round(frame.doorU) % 2 : 1,
        )) {
          if (
            wallAt(u, v) &&
            !(v === 0 && hasBalcony && Math.abs(u - frame.doorU) < 0.8)
          ) {
            pane(u - alongInset, v, v === 0 ? -1 : 1, true);
          }
        }
      }
      for (const u of [0, frame.width]) {
        for (const v of positions(frame.depth, 1)) {
          if (wallAt(u, v)) {
            pane(u, v - depthInset, u === 0 ? -1 : 1, false);
          }
        }
      }
    });
  }
  if (hasBalcony) {
    const lo = Math.min(...supports) - alongInset,
      hi = Math.max(...supports) - alongInset,
      floor = storey + 0.24;
    feature('palace-balcony', () => {
      box(
        (lo + hi) * 0.5,
        -0.25,
        storey + 0.14,
        hi - lo + 0.24,
        0.2,
        0.74,
        stone,
      );
      for (const u of [lo, hi]) {
        box(u, -0.425, floor + 0.28, 0.12 / T, 0.56, 0.12 / T, stone);
        box(u, -0.425, floor + 0.575, 0.17 / T, 0.04, 0.17 / T, trim);
      }
      for (const y of [floor + 0.07, floor + 0.54]) {
        batch.cylinder(
          iron,
          at(lo, -0.425, y),
          at(hi, -0.425, y),
          0.021,
          light,
        );
      }
      const rods = Math.ceil((hi - lo) / 0.23);
      for (let n = 0; n <= rods; n++) {
        const u = lo + ((hi - lo) * n) / rods;
        batch.cylinder(
          iron,
          at(u, -0.425, floor + 0.07),
          at(u, -0.425, floor + 0.54),
          0.012,
          light,
        );
      }
      for (const u of [lo, hi]) {
        batch.cylinder(
          iron,
          at(u, -0.425, floor + 0.54),
          at(u, -0.06, floor + 0.54),
          0.021,
          light,
        );
      }
      const doorHeight = Math.min(1.49, height - floor - 0.17),
        width = 0.74,
        leafBatch = new WorldBatch(geometry);
      addDoorLeaf(leafBatch, materials, {
        width,
        height: doorHeight,
        sign: 1,
        style: appearance['doorStyle'],
        broken: false,
        light: 1,
      });
      const leaf = leafBatch.finish('palace-balcony-leaf'),
        matrix = new Matrix4().compose(
          at(doorU - (width * 0.5) / T, -0.085 / T, floor + 0.02),
          rotation,
          new Vector3(1, 1, 1),
        );
      batch.take(leaf, matrix, light);
      for (const side of [-1, 1]) {
        box(
          doorU + (side * 0.405) / T,
          -0.13 / T,
          floor + 0.02 + doorHeight * 0.5,
          0.07 / T,
          doorHeight + 0.1,
          0.065 / T,
          trim,
        );
      }
      box(
        doorU,
        -0.13 / T,
        floor + 0.02 + doorHeight + 0.04,
        0.88 / T,
        0.08,
        0.065 / T,
        trim,
      );
      for (const u of [lo, hi]) {
        box(
          u,
          -0.1 / T,
          (floor + height - 0.12) * 0.5,
          0.17,
          height - floor - 0.12,
          0.14,
          trim,
        );
      }
    });
    const center = (lo + hi) * 0.5,
      front = -0.39,
      back = Math.min(1.2, frame.depth - 0.3),
      eave = height + 7 / 25.066666666666666,
      peak =
        eave + Math.min(30, Math.max(13, (hi - lo) * 4.5)) / 25.066666666666666;
    // The complete canopy footprint includes its return into the entrance
    // bay. A walking roof cell must clear its roof, fascia and entablature.
    const first = front - 0.05,
      last = back + 0.06 / T,
      p = at(center, (first + last) * 0.5, 0),
      reachU = (hi - lo + 0.26 + 1) * T * 0.5,
      reachV = (last - first + 1) * T * 0.5;
    const route = (input.terrain.upperSurfaces ?? []).some((surface) => {
      const x = surface.x * T - p.x,
        z = surface.y * T - p.z;
      return (
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        Math.abs(x * frame.u.x + z * frame.u.y) < reachU - 1e-6 &&
        Math.abs(x * frame.v.x + z * frame.v.y) < reachV - 1e-6
      );
    });
    if (!route) {
      feature('palace-portico-entablature', () => {
        for (const u of [lo, hi]) {
          box(u, -0.1 / T, height - 0.02, 0.17, 0.2, 0.14, trim);
        }
        box(
          center,
          (front - 0.05 + 0.3) * 0.5,
          eave - 2.5 / 25.066666666666666,
          hi - lo + 0.26,
          7 / 25.066666666666666,
          0.3 - front + 0.05,
          stone,
        );
      });
      feature('palace-pediment', () => {
        const face = [
            at(lo, front, eave),
            at(hi, front, eave),
            at(center, front, peak),
          ],
          rear = face.map((point) =>
            point
              .clone()
              .add(new Vector3(frame.v.x * 0.18, 0, frame.v.y * 0.18)),
          );
        batch.polygon(wall, face, light);
        batch.polygon(wall, rear, light);
        for (let n = 0; n < 3; n++) {
          const next = (n + 1) % 3;
          batch.polygon(
            wall,
            [
              required(face[n]),
              required(face[next]),
              required(rear[next]),
              required(rear[n]),
            ],
            light,
          );
        }
        const low = at(lo, front - 0.01, eave + 1 / 25.066666666666666),
          high = at(hi, front - 0.01, eave + 1 / 25.066666666666666),
          crest = at(center, front - 0.01, peak + 1.4 / 25.066666666666666);
        batch.cylinder(trim, low, crest, 0.035, light);
        batch.cylinder(trim, crest, high, 0.035, light);
      });
      const hipReturn = palacePorticoHipReturn(
          b,
          input,
          height,
          wallInset,
          legacy,
          lo,
          hi,
          back,
          eave,
        ),
        ridgeEnd = hipReturn?.ridgeEnd ?? back;
      const roof = materials.get(appearance['roofFinish']),
        panels: Vector3[][] = [
          [
            at(lo, front, eave + 1 / 25.066666666666666),
            at(lo, back, eave + 1 / 25.066666666666666),
            at(center, ridgeEnd, peak + 1 / 25.066666666666666),
            at(center, front, peak + 1 / 25.066666666666666),
          ],
          [
            at(hi, back, eave + 1 / 25.066666666666666),
            at(hi, front, eave + 1 / 25.066666666666666),
            at(center, front, peak + 1 / 25.066666666666666),
            at(center, ridgeEnd, peak + 1 / 25.066666666666666),
          ],
        ];
      if (hipReturn) {
        panels.push([
          at(lo, back, eave + 1 / 25.066666666666666),
          at(hi, back, eave + 1 / 25.066666666666666),
          at(center, ridgeEnd, peak + 1 / 25.066666666666666),
        ]);
      }
      const tiles = feature('palace-portico-roof', () => {
        for (const panel of panels) {
          batch.polygon(roof, panel, light, roofTextureProjector(panel));
        }
      });
      tiles.add(edgeDetails(panels, base + eave + 1 / 25.066666666666666));
      if (!hipReturn) {
        feature('palace-portico-return', () => {
          const rear = [
              at(lo, back, eave),
              at(hi, back, eave),
              at(center, back, peak),
            ],
            face = rear.map((point) =>
              point
                .clone()
                .add(new Vector3(-frame.v.x * 0.18, 0, -frame.v.y * 0.18)),
            );
          batch.polygon(wall, face, light);
          batch.polygon(wall, rear, light);
          for (let n = 0; n < 3; n++) {
            const next = (n + 1) % 3;
            batch.polygon(
              wall,
              [
                required(face[n]),
                required(face[next]),
                required(rear[next]),
                required(rear[n]),
              ],
              light,
            );
          }
        });
      }
      feature('palace-portico-crest', () => {
        // This small geometric badge follows the current sprite's ornament.
        // It does not claim a particular historical coat of arms.
        const badge = materials.get('stone', { colour: '#c2ae83' }),
          mark = materials.get('carved-stone', { colour: '#8d7650' }),
          outline = [
            [-0.2, 0.28],
            [-0.19, 0.5],
            [0, 0.56],
            [0.19, 0.5],
            [0.2, 0.28],
            [0, 0.12],
          ] as const,
          face = outline.map(([x, y]) =>
            at(center + x / T, front - 0.035 / T, eave + y),
          ),
          rear = face.map((point) =>
            point
              .clone()
              .add(new Vector3(frame.v.x * 0.025, 0, frame.v.y * 0.025)),
          );
        batch.polygon(badge, face, light);
        batch.polygon(badge, rear, light);
        for (let n = 0; n < face.length; n++) {
          const next = (n + 1) % face.length;
          batch.polygon(
            badge,
            [
              required(face[n]),
              required(face[next]),
              required(rear[next]),
              required(rear[n]),
            ],
            light,
          );
          batch.cylinder(
            mark,
            required(face[n]),
            required(face[next]),
            0.01,
            light,
          );
        }
        const a = (x: number, y: number) =>
          at(center + x / T, front - 0.052 / T, eave + y);
        for (const [x, y, x1, y1] of [
          [0, 0.19, 0, 0.47],
          [-0.115, 0.43, 0.115, 0.43],
          [-0.09, 0.3, 0.09, 0.3],
        ] as const) {
          batch.cylinder(mark, a(x, y), a(x1, y1), 0.009, light);
        }
      });
    }
  }
  return root;
}
