import { required } from './required';
import {
  worldWallRecords,
  buildingWallAtPoint,
  wallFrameRecords,
} from './world-wall-records';
import {
  ExtrudeGeometry,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
} from 'three';
import {
  entranceFrame,
  getBuildingProfile,
} from '../../../../packages/game/building-profile.ts';
import { buildingStyle } from '../../../../packages/game/building-types.ts';
import { WorldBatch, roofTextureProjector } from './world-geometry';
import { illuminationAt } from './world-materials';
import { palaceFacade } from './world-palace-facade';
import { depotFacade } from './world-depot-facade';
import { warehouseButtresses } from './world-warehouse-buttresses';
import { churchNave } from './world-church-nave';
import { churchFrontPiers } from './world-church-front-piers';
import { postaPiers } from './world-posta-piers';
import { stableVentilation } from './world-stable-ventilation';
import { stableTimberFrame } from './world-stable-frame';
import { farmhouseGallery as supportedFarmhouseGallery } from './world-farmhouse-gallery';
import { houseFacade } from './world-house-facade';
import { chapelPiers } from './world-chapel-piers';
import { workPorch } from './world-work-porches';
import { smithyChimney } from './world-smithy-chimney';
import { barracksGate } from './world-barracks-gate';
import { townhallColumns } from './world-townhall-columns';
import { cabildoFacade } from './world-cabildo-facade';
import { pulperiaSign } from './world-pulperia-sign';
import { civicStoreyBands } from './world-civic-storey-bands';
import { buildingArtInset } from './world-building-placement';
import {
  buildingRenderAppearance,
  buildingRenderMaterials,
  selectedBuildingStyle,
} from './world-building-style';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldBuilding, WorldInput } from './world-types';

/** Join the roof planes with a timber fascia and rounded clay ridge caps.
 * This is exterior scenery. Room cutaways omit it with the removed roof. */
export function roofEdgeDetails(
  id: string,
  panels: readonly (readonly Vector3[])[],
  height: number,
  geometry: WorldGeometry,
  roof: MeshStandardMaterial,
  wood: MeshStandardMaterial,
  light: number,
  terrace = false,
) {
  const batch = new WorldBatch(geometry),
    edges = new Map<string, { a: Vector3; b: Vector3; count: number }>(),
    thickness = terrace ? 0.12 : 0.075;
  const key = (p: Vector3) =>
    [p.x, p.y, p.z].map((value) => value.toFixed(6)).join(',');
  for (const panel of panels) {
    batch.polygon(
      wood,
      panel.map((point) => point.clone().add(new Vector3(0, -thickness, 0))),
      light,
    );
    for (let n = 0; n < panel.length; n++) {
      const a = required(panel[n]),
        b = required(panel[(n + 1) % panel.length]),
        edgeKey = [key(a), key(b)].sort().join('|'),
        edge = edges.get(edgeKey);
      if (edge) {
        edge.count++;
      } else {
        edges.set(edgeKey, { a, b, count: 1 });
      }
    }
  }
  for (const { a, b, count } of edges.values()) {
    if (count === 1) {
      batch.polygon(
        wood,
        [
          a,
          b,
          b.clone().add(new Vector3(0, -thickness, 0)),
          a.clone().add(new Vector3(0, -thickness, 0)),
        ],
        light,
      );
    } else if (!terrace && (a.y > height + 0.01 || b.y > height + 0.01)) {
      batch.cylinder(
        roof,
        a.clone().add(new Vector3(0, 0.035, 0)),
        b.clone().add(new Vector3(0, 0.035, 0)),
        0.06,
        light,
      );
    }
  }
  return batch.finish(`building-roof-edges:${id}`);
}

/** All facade details use the same entrance-relative frame as the roof.
 * Positions and face orientation therefore follow every authored rotation. */
export function architecturalDetails(
  b: WorldBuilding,
  input: WorldInput,
  T: number,
  height: number,
  base: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  legacy: boolean,
) {
  const walls = worldWallRecords(input).filter(
    (tile) => tile.buildingId === b.id,
  );
  const wallInset = buildingArtInset(b, input),
    frame = entranceFrame({ ...b, walls: wallFrameRecords(walls) }),
    kind = b.kind ?? b.architecture ?? 'house',
    appearance = buildingRenderAppearance(b),
    style = selectedBuildingStyle(b);
  materials = buildingRenderMaterials(b, materials);
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
    wood = materials.get('wood'),
    darkwood = materials.get('darkwood'),
    iron = materials.get('iron'),
    roof = materials.get(appearance['roofFinish']),
    light = illuminationAt(input, b);
  const root = new Group();
  root.name = `building-details:${b.id}`;
  let batch = new WorldBatch(geometry);
  const rotation = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.atan2(-frame.u.y, frame.u.x),
  );
  const alongInset = wallInset * (frame.u.x + frame.u.y),
    depthInset = wallInset * (frame.v.x + frame.v.y),
    doorU = frame.doorU - alongInset;
  const at = (u: number, v: number, y: number) => {
    const point = frame.at(u, v);
    return new Vector3(
      (point.x + wallInset) * T,
      base + y,
      (point.y + wallInset) * T,
    );
  };
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
  const wallAt = (u: number, v: number) => {
    const point = frame.at(u, v);
    return buildingWallAtPoint(walls, point, b);
  };
  const bearing = (u: number, v = 0, actualAlong = false) =>
    [
      u - (actualAlong ? alongInset : 0.06 * (frame.u.x + frame.u.y)),
      v - 0.06 * (frame.v.x + frame.v.y),
    ] as const;
  const walkableAbove = (u: number, v: number, w: number, d = w) => {
    const point = at(u, v, 0),
      alongReach = (w + 1) * T * 0.5,
      depthReach = (d + 1) * T * 0.5;
    return (input.terrain.upperSurfaces ?? []).some((surface) => {
      const x = surface.x * T - point.x,
        z = surface.y * T - point.z;
      return (
        !surface.blocked &&
        (surface.tacticalLevel ?? 0) > 0 &&
        Math.abs(x * frame.u.x + z * frame.u.y) < alongReach - 1e-6 &&
        Math.abs(x * frame.v.x + z * frame.v.y) < depthReach - 1e-6
      );
    });
  };
  const roofRise =
    b.roof === 'terrace' ||
    (input.terrain.upperSurfaces ?? []).some(
      (surface) => surface.kind === 'roof' && surface.buildingId === b.id,
    )
      ? 0
      : Math.min(
          getBuildingProfile(b).roofRise / 25.066666666666666,
          Math.max(0.4, frame.width * 0.28),
        );
  const entranceSupports = () =>
    [Math.round(frame.doorU - 1), Math.round(frame.doorU + 1)].filter(
      (u) => u >= 0 && u <= frame.width && wallAt(u, 0)?.type === 'wall',
    );
  const feature = (name: string, draw: () => void) => {
    const previous = batch;
    batch = new WorldBatch(geometry);
    draw();
    root.add(batch.finish(`building-detail:${b.id}:${name}`));
    batch = previous;
  };
  const faceDisc = (
    u: number,
    v: number,
    y: number,
    radius: number,
    material: MeshStandardMaterial,
  ) =>
    batch.cylinder(
      material,
      at(u, v - 0.012 / T, y),
      at(u, v + 0.012 / T, y),
      radius,
      light,
    );
  const clock = (
    u: number,
    v: number,
    y: number,
    radius = 0.27,
    facing = -1,
  ) => {
    faceDisc(u, v, y, radius + 0.036, iron);
    faceDisc(u, v + (facing * 0.018) / T, y, radius, materials.get('linen'));
    for (let n = 0; n < 12; n++) {
      const angle = (n * Math.PI) / 6,
        a = at(
          u + (Math.sin(angle) * radius * 0.78) / T,
          v + (facing * 0.045) / T,
          y + Math.cos(angle) * radius * 0.78,
        ),
        c = at(
          u + (Math.sin(angle) * radius * 0.92) / T,
          v + (facing * 0.045) / T,
          y + Math.cos(angle) * radius * 0.92,
        );
      batch.cylinder(iron, a, c, 0.012, light);
    }
    batch.cylinder(
      iron,
      at(u, v + (facing * 0.05) / T, y),
      at(u, v + (facing * 0.05) / T, y + radius * 0.65),
      0.018,
      light,
    );
    batch.cylinder(
      iron,
      at(u, v + (facing * 0.05) / T, y),
      at(u + (radius * 0.49) / T, v + (facing * 0.05) / T, y - radius * 0.22),
      0.018,
      light,
    );
  };
  const tower = (
    u: number,
    v: number,
    w: number,
    top: number,
    bottom = 0,
    civic = false,
  ) => {
    // The broad base cornice belongs to the occupied tower footprint too.
    // Decoration cannot fill an authored upper walking cell.
    if (walkableAbove(u, v, w + 0.15)) {
      return;
    }
    feature(civic ? 'civic-clock-tower' : 'bell-tower', () => {
      // The civic cupola rests on the facade. It never fills the entrance below.
      const footing =
        !civic && (!legacy || b.wallFinish !== undefined) && bottom === 0
          ? Math.min(
              (getBuildingProfile(b).plinthHeight + 2) / 25.066666666666666,
              top,
            )
          : bottom;
      // The current parish sprite has a warm stone foot over its plaster base.
      // Join those volumes once on the unchanged actual reserved foundation.
      if (footing > bottom) {
        box(
          u,
          v,
          (footing + bottom) * 0.5,
          w,
          footing - bottom,
          w,
          materials.get('stone', {
            architectureRole: 'volume',
            colour: '#a99a79',
          }),
        );
      }
      box(u, v, (top + footing) * 0.5, w, top - footing, w);
      for (const y of [Math.max(height, bottom), top - 0.12]) {
        box(u, v, y, w + 0.15, 0.12, w + 0.15, trim);
      }
      const e = w * 0.57,
        corners = [
          at(u - e, v - e, top + 0.06),
          at(u + e, v - e, top + 0.06),
          at(u + e, v + e, top + 0.06),
          at(u - e, v + e, top + 0.06),
        ],
        apex = at(u, v, top + 0.64);
      if (civic) {
        batch.primitive(
          'sphere',
          roof,
          at(u, v, top + 0.26),
          [w * T * 0.57, 0.37, w * T * 0.57],
          undefined,
          light,
        );
      } else {
        for (let n = 0; n < 4; n++) {
          const panel = [
            required(corners[n]),
            required(corners[(n + 1) % 4]),
            apex,
          ];
          batch.polygon(roof, panel, light, roofTextureProjector(panel));
        }
      }
      box(u, v, top + 0.06, w * 1.16, 0.08, w * 1.16, darkwood);
      box(u, v, top + 0.91, 0.044, 0.45, 0.044, iron);
      box(u, v, top + 0.99, 0.24, 0.044, 0.044, iron);
      if (!civic) {
        const openingHeight = Math.min(1.3, Math.max(0.85, w * T * 0.7)),
          bottom = top - 0.17 - openingHeight,
          spring = top - 0.17 - 0.24,
          rx = Math.min(0.5, w * T * 0.22),
          cy = (bottom + top - 0.17) * 0.5;
        for (const [nu, nv, du, dv] of [
          [0, -1, 1, 0],
          [0, 1, 1, 0],
          [-1, 0, 0, 1],
          [1, 0, 0, 1],
        ] as const) {
          const point = (a: number, y: number, outset = 0.01) =>
            at(
              u + nu * (w * 0.51 + outset / T) + (du * a) / T,
              v + nv * (w * 0.51 + outset / T) + (dv * a) / T,
              y,
            );
          const arch = Array.from({ length: 17 }, (_, n) =>
            point(
              Math.cos((n * Math.PI) / 16) * rx,
              spring + Math.sin((n * Math.PI) / 16) * 0.24,
            ),
          );
          batch.polygon(
            darkwood,
            [point(-rx, bottom), point(rx, bottom), ...arch],
            light,
          );
          for (const sign of [-1, 1]) {
            batch.cylinder(
              trim,
              point(sign * (rx + 0.025), bottom - 0.025, 0.025),
              point(sign * (rx + 0.025), spring, 0.025),
              0.032,
              light,
            );
          }
          for (let n = 1; n < arch.length; n++) {
            batch.cylinder(
              trim,
              required(arch[n - 1]),
              required(arch[n]),
              0.037,
              light,
            );
          }
          batch.cylinder(
            wood,
            point(-rx * 0.91, spring - 0.025, 0.028),
            point(rx * 0.91, spring - 0.025, 0.028),
            0.032,
            light,
          );
          const bellRotation = du
              ? rotation
              : rotation
                  .clone()
                  .multiply(
                    new Quaternion().setFromAxisAngle(
                      new Vector3(0, 1, 0),
                      Math.PI * 0.5,
                    ),
                  ),
            radius = Math.min(0.18, rx * 0.6);
          batch.primitive(
            'flare',
            materials.get('brass'),
            point(0, cy - 0.05, 0.028),
            [radius, 0.28, 0.11],
            bellRotation,
            light,
          );
          batch.cylinder(
            iron,
            point(0, cy - 0.18, 0.03),
            point(0, cy - 0.25, 0.03),
            0.023,
            light,
          );
        }
        box(u, v, bottom - 0.09, w + 0.12, 0.12, w + 0.12, trim);
        return;
      }
      for (const face of [-1, 1]) {
        const cy = top - 0.53,
          cv = v + face * w * 0.51;
        box(u, cv, cy, w * 0.46, 0.68, 0.028 / T, darkwood);
        for (const side of [-1, 1]) {
          box(u + side * w * 0.25, cv, cy, 0.04 / T, 0.76, 0.04 / T, trim);
        }
        box(u, cv, cy + 0.38, w * 0.54, 0.055, 0.04 / T, trim);
        clock(
          u,
          cv + (face * 0.044) / T,
          cy,
          Math.min(0.34, w * T * 0.3),
          face,
        );
      }
    });
  };
  const townhallCrown = () => {
    const supports = [
      ...new Set(
        [-2, 2].map((offset) =>
          Math.max(0, Math.min(frame.width, Math.round(frame.doorU + offset))),
        ),
      ),
    ].filter((u) => wallAt(u, 0)?.type === 'wall');
    if (supports.length !== 2 || height < 2.4) {
      return;
    }
    const lo = Math.min(...supports) - alongInset,
      hi = Math.max(...supports) - alongInset,
      width = hi - lo,
      center = (lo + hi) * 0.5;
    // The long, shallow crown and its stone entablature must not occupy an
    // authored roof route. Their rectangle follows the actual facade rotation.
    if (walkableAbove(center, -0.06, width + 0.2, 0.68)) {
      return;
    }
    const V = 25.066666666666666,
      rise = Math.min(48, 24 + width * 5) / V,
      baseY = height + 4 / V,
      front = -0.31,
      back = 0.22,
      x = (value: number) => (value / 40) * width * T,
      y = (value: number) => (value / 46) * rise,
      shape = new Shape();
    // This closed curved outline follows the retained town-hall sprite crown.
    // The cabildo keeps its distinct clock cupola.
    shape.moveTo(0, 0);
    shape.lineTo(0, y(7));
    shape.lineTo(x(9), y(7));
    shape.lineTo(x(9), y(14));
    shape.quadraticCurveTo(x(9), y(21), x(14), y(25));
    shape.lineTo(x(14), y(32));
    shape.bezierCurveTo(x(14), y(48), x(26), y(48), x(26), y(32));
    shape.lineTo(x(26), y(25));
    shape.quadraticCurveTo(x(31), y(21), x(31), y(14));
    shape.lineTo(x(31), y(7));
    shape.lineTo(x(40), y(7));
    shape.lineTo(x(40), 0);
    shape.closePath();
    feature('townhall-clock-pediment', () => {
      const mesh = new ExtrudeGeometry(shape, {
        depth: (back - front) * T,
        bevelEnabled: false,
        curveSegments: 16,
      });
      batch.add(
        mesh,
        wall,
        new Matrix4().compose(
          at(lo, front, baseY),
          rotation,
          new Vector3(1, 1, 1),
        ),
        light,
      );
      mesh.dispose();
      const outline = shape.getPoints(16);
      for (let n = 1; n < outline.length; n++) {
        batch.cylinder(
          trim,
          at(
            lo + required(outline[n - 1]).x / T,
            front - 0.025 / T,
            baseY + required(outline[n - 1]).y,
          ),
          at(
            lo + required(outline[n]).x / T,
            front - 0.025 / T,
            baseY + required(outline[n]).y,
          ),
          0.045,
          light,
        );
      }
      box(
        center,
        -0.06,
        height + 1.5 / V,
        width + 0.2,
        7 / V,
        0.68,
        materials.get('stone'),
      );
      clock(center, front - 0.028 / T, baseY + y(29), 7.5 / V);
    });
    feature('townhall-finials', () => {
      for (const u of [lo + 0.16, hi - 0.16]) {
        box(
          u,
          -0.135,
          baseY + 7.5 / V,
          0.2,
          5 / V,
          0.31,
          materials.get('stone'),
        );
        batch.primitive(
          'sphere',
          trim,
          at(u, -0.13, baseY + 12 / V),
          [2.3 / V, 3 / V, 2.3 / V],
          undefined,
          light,
        );
      }
    });
  };
  const frontSupports = () =>
    Array.from({ length: Math.floor(frame.width) + 1 }, (_, u) => u).filter(
      (u) =>
        wallAt(u, 0)?.type === 'wall' &&
        (u === 0 ||
          u === frame.width ||
          u % 2 === 0 ||
          Math.abs(u - frame.doorU) === 1),
    );
  const roofCanopy = (
    name: string,
    supports: number[],
    depth = 0.55,
    masonry = false,
  ) => {
    if (supports.length < 2 || height < 2.4) {
      return;
    }
    const lo = Math.min(...supports),
      hi = Math.max(...supports),
      low = Math.max(2.12, height * 0.82),
      high = low + 0.24,
      front = -depth - 0.15,
      back = 0.16,
      supportDepth =
        wallInset === 0
          ? kind === 'warehouse'
            ? -0.3
            : kind === 'posta'
              ? -0.33
              : 0
          : 0;
    const panel = [
        at(lo - 0.18, front, low),
        at(hi + 0.18, front, low),
        at(hi + 0.18, back, high),
        at(lo - 0.18, back, high),
      ],
      roofAt = (v: number) =>
        low + ((v - front) / (back - front)) * (high - low);
    feature(name, () => {
      for (const u of supports) {
        if (masonry && (u === 0 || u === frame.width)) {
          continue;
        }
        // The posta's broad corner piers are separate. Its thin porch posts
        // expose their front face without crossing the solid cell boundary.
        const a = masonry ? u - alongInset : u,
          v = masonry
            ? wallInset === 0
              ? -0.3
              : 0.02 * (frame.v.x + frame.v.y)
            : supportDepth,
          top = roofAt(v);
        if (masonry) {
          box(a, v, (top + 0.11) * 0.5, 0.14, top - 0.11, 0.14, wall);
          box(a, v, 0.055, 0.23, 0.11, 0.14, materials.get('stone'));
          box(a, v, top - 0.02, 0.23, 0.1, 0.14, trim);
        } else {
          box(a, v, top * 0.5, 0.11 / T, top, 0.11 / T, wood);
          box(a, v, 0.055, 0.21 / T, 0.11, 0.21 / T, materials.get('stone'));
          const toward = u == lo ? 1 : -1;
          batch.cylinder(
            wood,
            at(a, v, top - 0.3),
            at(a + toward * 0.28, v, roofAt(v) - 0.065),
            0.025,
            light,
          );
        }
      }
      box(
        (lo + hi) * 0.5,
        supportDepth,
        roofAt(supportDepth) - 0.045,
        hi - lo + 0.18,
        0.11,
        0.14 / T,
        masonry ? trim : wood,
      );
      batch.polygon(roof, panel, light, roofTextureProjector(panel));
    });
    root
      .getObjectByName(`building-detail:${b.id}:${name}`)
      ?.add(
        roofEdgeDetails(
          `${b.id}:${name}`,
          [panel],
          low,
          geometry,
          roof,
          darkwood,
          light,
        ),
      );
  };
  const workCanopy = (name: string, supports: number[], depth: number) => {
    if (legacy && b.wallFinish === undefined) {
      roofCanopy(name, supports, depth);
    } else {
      root.add(
        workPorch(
          b,
          input,
          T,
          height,
          base,
          geometry,
          materials,
          (panels, eave, surface) =>
            roofEdgeDetails(
              `${b.id}:${name}`,
              panels,
              eave,
              geometry,
              surface,
              darkwood,
              light,
            ),
        ),
      );
    }
  };
  const farmhouseGallery = () => {
    const frontSupports = [
        ...new Set([0, 0.3, 0.7, 1].map((r) => Math.round(frame.width * r))),
      ].filter((u) => wallAt(u, 0)?.type === 'wall'),
      length = Math.max(1, Math.round(frame.depth * 0.57)),
      sideSupports = [0, length].filter((v) => wallAt(0, v)?.type === 'wall');
    const hasFront = frontSupports.length >= 2,
      hasSide = sideSupports.length === 2,
      joint = hasFront && hasSide && frontSupports[0] === 0;
    if ((!hasFront && !hasSide) || height < 2.4) {
      return;
    }
    const low = height - 0.16,
      high = height + 0.12,
      outside = -0.45,
      inside = 0.42,
      postTop = low + ((0 - outside) / (inside - outside)) * (high - low),
      panels: Vector3[][] = [];
    feature('farmhouse-gallery', () => {
      const post = (u: number, v: number, du: number, dv: number) => {
        box(u, v, postTop * 0.5, 0.11 / T, postTop, 0.11 / T, wood);
        box(u, v, 0.055, 0.21 / T, 0.11, 0.21 / T, materials.get('stone'));
        batch.cylinder(
          wood,
          at(u, v, postTop - 0.32),
          at(u + du * 0.3, v + dv * 0.3, postTop - 0.06),
          0.027,
          light,
        );
      };
      if (hasFront) {
        const lo = Math.min(...frontSupports),
          hi = Math.max(...frontSupports);
        for (const u of frontSupports) {
          post(u, 0, u === lo ? 1 : -1, 0);
        }
        box(
          (lo + hi) * 0.5,
          0,
          postTop - 0.04,
          hi - lo + 0.18,
          0.12,
          0.14 / T,
          wood,
        );
        panels.push([
          at(joint ? outside : lo - 0.15, outside, low),
          at(hi + 0.15, outside, low),
          at(hi + 0.15, inside, high),
          at(joint ? inside : lo - 0.15, inside, high),
        ]);
      }
      if (hasSide) {
        for (const v of sideSupports) {
          if (v !== 0 || !joint) {
            post(0, v, 0, v === 0 ? 1 : -1);
          }
        }
        box(
          0,
          length * 0.5,
          postTop - 0.04,
          0.14 / T,
          0.12,
          length + 0.18,
          wood,
        );
        panels.push([
          at(outside, length + 0.15, low),
          at(outside, joint ? outside : 0, low),
          at(inside, joint ? inside : 0, high),
          at(inside, length + 0.15, high),
        ]);
      }
      for (const panel of panels) {
        batch.polygon(roof, panel, light, roofTextureProjector(panel));
      }
    });
    root
      .getObjectByName(`building-detail:${b.id}:farmhouse-gallery`)
      ?.add(
        roofEdgeDetails(
          `${b.id}:farmhouse-gallery`,
          panels,
          low,
          geometry,
          roof,
          darkwood,
          light,
        ),
      );
  };
  const chimney = (
    u: number,
    v: number,
    options: {
      material?: MeshStandardMaterial;
      capMaterial?: MeshStandardMaterial;
      top?: number;
      industrial?: boolean;
      name?: string;
    } = {},
  ) =>
    feature(
      options.name ??
        (options.industrial ? 'forge-chimney' : 'domestic-chimney'),
      () => {
        const bottom = height - 0.12,
          top = options.top ?? height + 1.02,
          w = options.industrial ? 0.42 : 0.38,
          cap = options.industrial ? 0.56 : 0.48;
        box(
          u,
          v,
          (bottom + top) * 0.5,
          w,
          top - bottom,
          w,
          options.material ?? materials.get('brick'),
        );
        box(u, v, top + 0.015, cap, 0.12, cap, options.capMaterial ?? trim);
        box(u, v, top + 0.08, w - 0.11, 0.018, w - 0.11, darkwood);
      },
    );
  const sideChimney = (industrial = false) => {
    const supports = [frame.width, 0]
      .flatMap((u) =>
        Array.from(
          { length: Math.max(0, Math.floor(frame.depth) - 1) },
          (_, n) => ({ u, v: n + 1 }),
        ),
      )
      .filter(({ u, v }) => {
        const point = frame.at(u, v);
        return (
          wallAt(u, v)?.type === 'wall' &&
          !(input.terrain.upperSurfaces ?? []).some(
            (surface) =>
              surface.x === point.x &&
              surface.y === point.y &&
              !surface.blocked &&
              (surface.tacticalLevel ?? 0) > 0,
          )
        );
      })
      .sort(
        (a, c) =>
          Math.abs(a.v - frame.depth * 0.66) -
          Math.abs(c.v - frame.depth * 0.66),
      );
    if (supports.length) {
      const { u, v } = required(supports[0]);
      chimney(u - alongInset, v - depthInset, {
        material: industrial ? materials.get('brick') : wall,
        top: height + roofRise + (industrial ? 1.08 : 0.64),
        industrial,
      });
    }
  };

  if (kind === 'chapel') {
    root.add(
      chapelPiers(b, input, T, height, base, geometry, materials, legacy),
    );
  }
  if (
    kind === 'chapel' &&
    !walkableAbove(doorU, -0.17 / T, 1.36 / T, 0.28 / T)
  ) {
    feature('chapel-bell-gable', () => {
      const bottom = height + roofRise * 0.62,
        spring = bottom + 0.55,
        u = doorU,
        outer = 0.64,
        inner = 0.23,
        front = -0.17 / T,
        back = front + 0.095 / T;
      // Two jambs and an arched crown leave a real bell opening. The narrow
      // gable joins the existing front masonry without occupying floor cells.
      box(u, front, bottom + 0.05, (outer * 2) / T, 0.1, 0.19 / T, trim);
      for (const sign of [-1, 1]) {
        box(
          u + (sign * (outer + inner) * 0.5) / T,
          front,
          (bottom + spring) * 0.5,
          (outer - inner) / T,
          spring - bottom,
          0.19 / T,
          wall,
        );
      }
      const faceUV = (point: Vector3) =>
        [point.x * frame.u.x + point.z * frame.u.y, point.y] as const;
      for (let n = 0; n < 16; n++) {
        const a = (n * Math.PI) / 16,
          c = ((n + 1) * Math.PI) / 16;
        const crown = (angle: number, width: number, rise: number, v: number) =>
          at(
            u + (Math.cos(angle) * width) / T,
            v,
            spring + Math.sin(angle) * rise,
          );
        for (const v of [front - 0.095 / T, back]) {
          batch.polygon(
            wall,
            [
              crown(a, outer, 0.52, v),
              crown(c, outer, 0.52, v),
              crown(c, inner, 0.23, v),
              crown(a, inner, 0.23, v),
            ],
            light,
            faceUV,
          );
        }
        batch.polygon(
          wall,
          [
            crown(a, outer, 0.52, front - 0.095 / T),
            crown(c, outer, 0.52, front - 0.095 / T),
            crown(c, outer, 0.52, back),
            crown(a, outer, 0.52, back),
          ],
          light,
          faceUV,
        );
        batch.polygon(
          wall,
          [
            crown(a, inner, 0.23, front - 0.095 / T),
            crown(c, inner, 0.23, front - 0.095 / T),
            crown(c, inner, 0.23, back),
            crown(a, inner, 0.23, back),
          ],
          light,
          faceUV,
        );
        batch.cylinder(
          trim,
          crown(a, outer, 0.52, front - 0.105 / T),
          crown(c, outer, 0.52, front - 0.105 / T),
          0.038,
          light,
        );
        batch.cylinder(
          trim,
          crown(a, inner, 0.23, front - 0.105 / T),
          crown(c, inner, 0.23, front - 0.105 / T),
          0.024,
          light,
        );
      }
      box(
        u,
        front + 0.025 / T,
        spring - 0.035,
        (inner * 2) / T,
        0.055,
        0.085 / T,
        wood,
      );
      batch.primitive(
        'flare',
        materials.get('brass'),
        at(u, front + 0.025 / T, spring - 0.18),
        [0.12, 0.22, 0.1],
        rotation,
        light,
      );
      batch.cylinder(
        iron,
        at(u, front + 0.025 / T, spring - 0.25),
        at(u, front + 0.025 / T, spring - 0.34),
        0.022,
        light,
      );
      box(u, front, spring + 0.77, 0.035 / T, 0.44, 0.035 / T, iron);
      box(u, front, spring + 0.83, 0.23 / T, 0.035, 0.035 / T, iron);
    });
  } else if (kind === 'church') {
    const reserved = (end: boolean) =>
      [0, 1].every((u) =>
        [0, 1].every(
          (v) => wallAt(end ? frame.width - u : u, v)?.type === 'wall',
        ),
      ) &&
      !walkableAbove(
        (end ? frame.width - 0.5 : 0.5) - alongInset,
        0.5 - depthInset,
        1.95,
      );
    const end =
      [true, false].find(reserved) ??
      [true, false].find(
        (end) =>
          wallAt(end ? frame.width : 0, 0)?.type === 'wall' &&
          !walkableAbove(
            (end ? frame.width : 0) - alongInset,
            -depthInset,
            0.95,
          ),
      );
    if (end !== undefined && style?.tower !== false) {
      const wide = reserved(end),
        u = end ? frame.width - (wide ? 0.5 : 0) : wide ? 0.5 : 0,
        v = wide ? 0.5 : 0;
      // The tower foundation follows the solid authored cells rather than
      // the wall-art inset. A narrow corner never occupies the nave floor.
      tower(
        u - alongInset,
        v - depthInset,
        wide ? 1.8 : 0.8,
        height + roofRise + (wide ? 1.8 : 1.25),
      );
    }
    const span = Math.min(Math.max(0.8, frame.width - 1.8), 5.2),
      center = Math.max(
        span * 0.5 + 0.15,
        Math.min(frame.width - span * 0.5 - 0.15, doorU),
      ),
      rise = roofRise,
      crest = rise + 0.42;
    feature('church-shaped-facade', () => {
      const width = span * T,
        x = (value: number) => (value / 40) * width,
        y = (value: number) => (value / 50) * crest,
        shape = new Shape();
      // The retained town-parish catalogue uses a curved masonry silhouette.
      // Extrusion keeps that concave outline closed and joined to the gable.
      shape.moveTo(0, 0);
      shape.lineTo(0, y(5));
      shape.bezierCurveTo(x(5), y(6), x(7), y(10), x(9), y(23));
      shape.bezierCurveTo(x(11), y(34), x(14), y(29), x(15), y(40));
      shape.bezierCurveTo(x(17), y(53), x(23), y(53), x(25), y(40));
      shape.bezierCurveTo(x(26), y(29), x(29), y(34), x(31), y(23));
      shape.bezierCurveTo(x(33), y(10), x(35), y(6), x(40), y(5));
      shape.lineTo(width, 0);
      shape.closePath();
      const front = -0.22 / T,
        baseY = height - 0.035,
        mesh = new ExtrudeGeometry(shape, {
          depth: 0.27,
          bevelEnabled: false,
          curveSegments: 12,
        });
      batch.add(
        mesh,
        wall,
        new Matrix4().compose(
          at(center - span * 0.5, front, baseY),
          rotation,
          new Vector3(1, 1, 1),
        ),
        light,
      );
      mesh.dispose();
      const outline = shape.getPoints(14);
      for (let n = 1; n < outline.length; n++) {
        batch.cylinder(
          trim,
          at(
            center - span * 0.5 + required(outline[n - 1]).x / T,
            front - 0.035 / T,
            baseY + required(outline[n - 1]).y,
          ),
          at(
            center - span * 0.5 + required(outline[n]).x / T,
            front - 0.035 / T,
            baseY + required(outline[n]).y,
          ),
          0.038,
          light,
        );
      }
      box(
        center,
        -0.13 / T,
        height + 0.015,
        span + 0.17 / T,
        0.13,
        0.35 / T,
        trim,
      );
      box(
        center,
        -0.16 / T,
        height + crest + 0.18,
        0.04 / T,
        0.5,
        0.04 / T,
        iron,
      );
      box(
        center,
        -0.16 / T,
        height + crest + 0.27,
        0.28 / T,
        0.04,
        0.04 / T,
        iron,
      );
    });
    feature('church-oculus', () => {
      const y = height + rise * 0.43,
        radius = Math.min(0.28, span * T * 0.1),
        v = -0.276 / T;
      faceDisc(center, v, y, radius - 0.01, darkwood);
      const q = new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(frame.v.x, 0, frame.v.y),
      );
      batch.primitive(
        'torus',
        trim,
        at(center, v - 0.018 / T, y),
        [radius, radius, radius],
        q,
        light,
      );
      for (const a of [-0.48, 0, 0.48]) {
        const x = a * radius,
          half = Math.sqrt(radius * radius - x * x) * 0.92;
        batch.cylinder(
          iron,
          at(center + x / T, v - 0.036 / T, y - half),
          at(center + x / T, v - 0.036 / T, y + half),
          0.014,
          light,
        );
      }
      batch.cylinder(
        iron,
        at(center - (radius * 0.88) / T, v - 0.036 / T, y),
        at(center + (radius * 0.88) / T, v - 0.036 / T, y),
        0.015,
        light,
      );
    });
    if (legacy && b.wallFinish === undefined) {
      feature('church-facade-pilasters', () => {
        for (const u of [0, frame.width]) {
          if (wallAt(u, 0)?.type === 'wall') {
            const [a, v] = bearing(u);
            box(a, v, height * 0.5, 0.23 / T, height, 0.38 / T, trim);
            box(a, v, 0.11, 0.34 / T, 0.22, 0.38 / T, materials.get('stone'));
            box(a, v, height - 0.035, 0.35 / T, 0.15, 0.38 / T, trim);
          }
        }
      });
    } else {
      root.add(
        churchFrontPiers(
          b,
          input,
          T,
          height,
          base,
          geometry,
          materials,
          legacy,
        ),
      );
    }
    if (!legacy || b.wallFinish !== undefined) {
      root.add(churchNave(b, input, T, height, base, geometry, materials));
    } else {
      for (let v = 1; v < frame.depth; v += 1.6) {
        for (const u of [0, frame.width]) {
          if (wallAt(u, Math.round(v))?.type === 'wall') {
            box(u, v, 0.8, 0.2, 1.6, 0.32, trim);
          }
        }
      }
    }
  } else if (kind === 'townhall') {
    const profile = getBuildingProfile(b),
      twoStoreys = height >= 4 && style?.upper !== false,
      storey = twoStoreys
        ? (height * profile.groundFloorHeight) / profile.wallHeight
        : height,
      stone = materials.get('stone'),
      formal = [
        ...new Set(
          [-2, 2].map((offset) =>
            Math.max(
              0,
              Math.min(frame.width, Math.round(frame.doorU + offset)),
            ),
          ),
        ),
      ].filter((u) => wallAt(u, 0)?.type === 'wall');
    if (wallInset === 0 && (!legacy || b.wallFinish !== undefined)) {
      root.add(townhallColumns(b, input, T, height, base, geometry, materials));
    } else {
      feature('townhall-formal-columns', () => {
        const column = (
          u: number,
          v: number,
          w: number,
          material: MeshStandardMaterial,
        ) => {
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
          box(u, v, storey - 0.08, 0.38 / T, 0.14, 0.38 / T, stone);
        };
        for (const support of formal) {
          const [u, v] = bearing(
            support,
            0,
            support !== 0 && support !== frame.width,
          );
          column(u, v, 0.3, stone);
        }
        for (const u of [0, frame.width]) {
          for (const v of [0, frame.depth]) {
            if (wallAt(u, v)?.type === 'wall') {
              const [a, c] = bearing(u, v);
              if (v !== 0 || !formal.includes(u)) {
                column(a, c, 0.38, trim);
              }
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
              column(
                u - 0.06 * (frame.u.x + frame.u.y),
                v - depthInset,
                0.3,
                wall,
              );
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
      root.add(
        civicStoreyBands(b, input, T, height, base, geometry, materials),
      );
    } else {
      feature('townhall-storey-bands', () => {
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
      feature('townhall-upper-windows', () => {
        // Match the retained opening's roughly 3 cm pale iron bars. Their
        // finish and width keep the grille legible against the dark recess.
        const paneHeight = Math.min(0.9, height - storey - 0.82),
          y = storey + 0.62 + paneHeight * 0.5,
          bars = materials.get('iron', { colour: '#a7ae9b' });
        const positions = (length: number, parity: number) => {
          const result: number[] = [];
          for (let n = parity || 2; n < length; n += 2) {
            result.push(n);
          }
          return result;
        };
        const pane = (
          u: number,
          v: number,
          side: number,
          alongFront: boolean,
        ) => {
          const width = 0.72,
            edge = width * 0.5 + 0.04,
            face = alongFront ? v + (side * 0.085) / T : u + (side * 0.085) / T,
            bar = face + (side * 0.045) / T;
          if (alongFront) {
            box(u, face, y, width / T, paneHeight, 0.04 / T, darkwood);
            for (const offset of [-edge, edge]) {
              box(
                u + offset / T,
                face + (side * 0.022) / T,
                y,
                0.06 / T,
                paneHeight + 0.14,
                0.065 / T,
                trim,
              );
            }
            for (const dy of [
              -paneHeight * 0.5 - 0.04,
              paneHeight * 0.5 + 0.04,
            ]) {
              box(
                u,
                face + (side * 0.022) / T,
                y + dy,
                (width + 0.14) / T,
                0.06,
                0.065 / T,
                trim,
              );
            }
            for (const offset of [-0.16, 0, 0.16]) {
              box(
                u + offset / T,
                bar,
                y,
                0.028 / T,
                paneHeight,
                0.028 / T,
                bars,
              );
            }
            box(u, bar, y - 0.025, width / T, 0.028, 0.028 / T, bars);
          } else {
            box(face, v, y, 0.04 / T, paneHeight, width / T, darkwood);
            for (const offset of [-edge, edge]) {
              box(
                face + (side * 0.022) / T,
                v + offset / T,
                y,
                0.065 / T,
                paneHeight + 0.14,
                0.06 / T,
                trim,
              );
            }
            for (const dy of [
              -paneHeight * 0.5 - 0.04,
              paneHeight * 0.5 + 0.04,
            ]) {
              box(
                face + (side * 0.022) / T,
                v,
                y + dy,
                0.065 / T,
                0.06,
                (width + 0.14) / T,
                trim,
              );
            }
            for (const offset of [-0.16, 0, 0.16]) {
              box(
                bar,
                v + offset / T,
                y,
                0.028 / T,
                paneHeight,
                0.028 / T,
                bars,
              );
            }
            box(bar, v, y - 0.025, 0.028 / T, 0.028, width / T, bars);
          }
        };
        for (const v of [0, frame.depth]) {
          for (const u of positions(
            frame.width,
            v === 0 ? Math.round(frame.doorU) % 2 : 1,
          )) {
            if (wallAt(u, v)) {
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
    townhallCrown();
  } else if (kind === 'cabildo') {
    const sourceCabildo =
        wallInset === 0 && (!legacy || b.wallFinish !== undefined),
      twoStoreys = height >= 4 && style?.upper !== false,
      storey = twoStoreys ? height * 0.5 : height,
      records: { a: number; u: number; v: number }[] = [];
    for (let u = 0; u <= frame.width; u++) {
      if (
        wallAt(u, 0)?.type === 'wall' &&
        (!sourceCabildo ||
          u === 0 ||
          u === frame.width ||
          (u % 2 === 0 && u < frame.width - 1))
      ) {
        const [a, v] = bearing(u, 0, u !== 0 && u !== frame.width);
        records.push({
          a: u === 0 || u === frame.width ? u : u - alongInset,
          u: a,
          v,
        });
      }
    }
    records.sort((a, b) => a.a - b.a);
    const arcade = (name: string, bottom: number, top: number, upper = false) =>
      feature(name, () => {
        const columns = records.map((record) => (upper ? record.a : record.u));
        for (const record of records) {
          const u = upper ? record.a : record.u,
            v = upper ? -0.16 / T : record.v;
          box(
            u,
            v,
            (bottom + top) * 0.5,
            0.21 / T,
            top - bottom,
            (upper ? 0.25 : 0.38) / T,
            trim,
          );
          box(u, v, top - 0.08, 0.3 / T, 0.13, (upper ? 0.29 : 0.38) / T, trim);
        }
        for (let n = 1; n < columns.length; n++) {
          const margin = (upper ? 0.14 : 0.1) / T,
            left = required(columns[n - 1]) + margin,
            right = required(columns[n]) - margin;
          if (right - left < 0.25 / T) {
            continue;
          }
          const radius = (right - left) * T * 0.5,
            center = (left + right) * 0.5,
            peak = top - 0.17,
            spring = peak - Math.min(radius, 0.52);
          const arch = Array.from({ length: 17 }, (_, k) =>
            at(
              center + (Math.cos((k * Math.PI) / 16) * radius) / T,
              upper ? -0.2 / T : -0.04,
              spring + Math.sin((k * Math.PI) / 16) * (peak - spring),
            ),
          );
          if (upper) {
            // Upper arcade recesses are scenery on the retained exterior shell.
            // They never create new playable doors or reveal actors indoors.
            const pane = [
              at(left, -0.13 / T, bottom + 0.1),
              at(right, -0.13 / T, bottom + 0.1),
              ...arch.map((point) =>
                point
                  .clone()
                  .add(new Vector3(frame.v.x * 0.07, 0, frame.v.y * 0.07)),
              ),
            ];
            batch.polygon(darkwood, pane, light);
            for (const u of [left, right]) {
              batch.cylinder(
                trim,
                at(u, -0.2 / T, bottom + 0.08),
                at(u, -0.2 / T, spring),
                0.038,
                light,
              );
            }
            for (const y of [bottom + 0.14, bottom + 0.53]) {
              batch.cylinder(
                iron,
                at(left, -0.26 / T, y),
                at(right, -0.26 / T, y),
                0.021,
                light,
              );
            }
            const rods = Math.max(2, Math.ceil((right - left) / 0.2));
            for (let k = 0; k <= rods; k++) {
              const u = left + ((right - left) * k) / rods;
              batch.cylinder(
                iron,
                at(u, -0.26 / T, bottom + 0.14),
                at(u, -0.26 / T, bottom + 0.53),
                0.012,
                light,
              );
            }
          }
          for (let k = 1; k < arch.length; k++) {
            batch.cylinder(
              trim,
              required(arch[k - 1]),
              required(arch[k]),
              0.053,
              light,
            );
          }
        }
      });
    if (sourceCabildo) {
      const facade = cabildoFacade(
        b,
        input,
        T,
        height,
        base,
        geometry,
        materials,
        (panels, eave, localRoof) =>
          roofEdgeDetails(
            `${b.id}:civic-cupola`,
            panels,
            eave,
            geometry,
            localRoof,
            darkwood,
            light,
          ),
      );
      for (const suffix of [
        ...(style?.arcade === false ? ['civic-ground-arcade'] : []),
        ...(style?.tower === false
          ? ['civic-clock-tower', 'civic-cupola']
          : []),
      ]) {
        const child =
          facade.getObjectByName(`building-detail:${b.id}:${suffix}`) ??
          facade.getObjectByName(`building-roof-edges:${b.id}:${suffix}`);
        if (child) {
          child.visible = false;
        }
      }
      root.add(facade);
    } else if (style?.arcade !== false) {
      arcade('civic-ground-arcade', 0.03, storey - 0.09);
    }
    if (twoStoreys && style?.arcade !== false) {
      arcade('civic-upper-arcade', storey + 0.12, height - 0.12, true);
    }
    feature('civic-cornices', () => {
      for (const y of sourceCabildo
        ? twoStoreys
          ? [height - 0.1]
          : []
        : twoStoreys
          ? [storey, height - 0.1]
          : [height - 0.1]) {
        box(
          frame.width * 0.5,
          -0.12 / T,
          y,
          frame.width + 0.2 / T,
          0.15,
          0.29 / T,
          trim,
        );
        for (const u of [0, frame.width]) {
          box(u, frame.depth * 0.5, y, 0.22 / T, 0.14, frame.depth, trim);
        }
      }
    });
    if (twoStoreys) {
      feature('civic-side-windows', () => {
        const y = storey + (height - storey) * 0.46;
        for (const side of [0, frame.width]) {
          for (let v = 1; v < frame.depth; v += 2) {
            if (wallAt(side, v)?.type !== 'wall') {
              continue;
            }
            const sign = side === 0 ? -1 : 1,
              u = side + (sign * 0.085) / T;
            box(u, v, y, 0.04 / T, 1.04, 0.72 / T, darkwood);
            for (const offset of [-0.4, 0.4]) {
              box(
                u + (sign * 0.024) / T,
                v + offset / T,
                y,
                0.065 / T,
                1.17,
                0.055 / T,
                trim,
              );
            }
            for (const dy of [-0.55, 0.55]) {
              box(
                u + (sign * 0.024) / T,
                v,
                y + dy,
                0.065 / T,
                0.06,
                0.86 / T,
                trim,
              );
            }
            for (const offset of [-0.23, 0, 0.23]) {
              box(
                u + (sign * 0.045) / T,
                v + offset / T,
                y,
                0.023 / T,
                1.03,
                0.024 / T,
                iron,
              );
            }
            box(
              u + (sign * 0.045) / T,
              v,
              y - 0.16,
              0.023 / T,
              0.024,
              0.72 / T,
              iron,
            );
          }
        }
      });
    }
    if (!sourceCabildo && style?.tower !== false) {
      tower(
        frame.width * 0.5,
        0.1,
        Math.min(1.4, Math.max(1.1, frame.width * 0.22)),
        height + (twoStoreys ? 2.05 : 1.35),
        height - 0.12,
        true,
      );
    }
  } else if (kind === 'posta') {
    const supports = Array.from(
      { length: Math.floor(frame.width) + 1 },
      (_, u) => u,
    ).filter(
      (u) =>
        wallAt(u, 0)?.type === 'wall' &&
        (u === 0 || u === frame.width || u % 2 === 0),
    );
    roofCanopy('posta-masonry-veranda', supports, 0.55, true);
    root.add(
      postaPiers(b, input, T, height, base, geometry, materials, legacy),
    );
  } else if (['farmhouse', 'estancia'].includes(kind)) {
    if (style?.gallery !== false) {
      if (legacy && b.wallFinish === undefined) {
        farmhouseGallery();
      } else {
        root.add(
          supportedFarmhouseGallery(
            b,
            input,
            T,
            height,
            base,
            geometry,
            materials,
            (panels, low) =>
              roofEdgeDetails(
                `${b.id}:farmhouse-gallery`,
                panels,
                low,
                geometry,
                roof,
                darkwood,
                light,
              ),
          ),
        );
      }
    }
    for (const u of [0, frame.width]) {
      const v = Array.from(
        { length: Math.max(0, Math.floor(frame.depth) - 1) },
        (_, n) => n + 1,
      )
        .filter(
          (v) =>
            wallAt(u, v)?.type === 'wall' &&
            !walkableAbove(u - alongInset, v - depthInset, 0.48),
        )
        .sort(
          (a, c) =>
            Math.abs(a - frame.depth + 1) - Math.abs(c - frame.depth + 1),
        )[0];
      if (v !== undefined) {
        chimney(u - alongInset, v - depthInset, {
          name: u === 0 ? 'farmhouse-chimney-left' : 'farmhouse-chimney-right',
          material: wall,
          capMaterial: materials.get('stone'),
          top: height + roofRise + 0.68,
        });
      }
    }
  } else if (kind === 'pulperia') {
    if (style?.awning !== false) {
      workCanopy('gallery', frontSupports(), 0.55);
    }
    const support = Array.from(
      { length: Math.floor(frame.width) + 1 },
      (_, u) => u,
    )
      .filter((u) => wallAt(u, 0)?.type === 'wall')
      .sort(
        (a, c) => Math.abs(a - frame.doorU - 1) - Math.abs(c - frame.doorU - 1),
      )[0];
    if (b.wallFinish !== undefined) {
      if (root.getObjectByName(`building-detail:${b.id}:gallery`)) {
        const sign = pulperiaSign(
          b,
          input,
          T,
          height,
          base,
          geometry,
          materials,
        );
        if (sign.children.length) {
          root.add(sign);
        }
      }
    } else if (support !== undefined && height >= 2.4) {
      feature('trade-sign', () => {
        const u = support - alongInset,
          y = Math.max(2.05, Math.max(2.12, height * 0.82) - 0.055);
        box(u, -0.04, y + 0.21, 0.5, 0.035, 0.1, iron);
        for (const offset of [-0.19, 0.19]) {
          box(u + offset, -0.082, y + 0.17, 0.017, 0.12, 0.02, iron);
        }
        box(u, -0.052, y, 0.58, 0.3, 0.06, wood);
        for (const offset of [-0.17, 0.17]) {
          box(u + offset, -0.088, y, 0.022, 0.25, 0.012, trim);
        }
        for (const offset of [-0.105, 0.105]) {
          box(u, -0.092, y + offset, 0.47, 0.02, 0.01, trim);
        }
        // A small barrel emblem identifies trade without adding tiny text.
        box(u, -0.09, y, 0.13, 0.21, 0.012, darkwood);
        for (const offset of [-0.065, 0.065]) {
          box(u, -0.092, y + offset, 0.17, 0.025, 0.01, trim);
        }
      });
    }
  } else if (kind === 'palace') {
    root.add(
      palaceFacade(
        b,
        input,
        T,
        height,
        base,
        geometry,
        materials,
        legacy,
        (panels, eave) =>
          roofEdgeDetails(
            `${b.id}:palace-portico`,
            panels,
            eave,
            geometry,
            roof,
            darkwood,
            light,
          ),
      ),
    );
  } else if (['warehouse', 'depot', 'stable', 'barracks'].includes(kind)) {
    if (!['depot', 'warehouse'].includes(kind)) {
      for (let v = 1; v < frame.depth; v += 2) {
        for (const u of [0, frame.width]) {
          if (wallAt(u, v)?.type === 'wall') {
            box(u, v, 0.5, 0.16, 1, 0.18, trim);
          }
        }
      }
    }
    if (kind === 'warehouse') {
      roofCanopy('loading-canopy', entranceSupports(), 0.5);
      root.add(
        warehouseButtresses(
          b,
          input,
          T,
          height,
          base,
          geometry,
          materials,
          legacy,
        ),
      );
    }
    if (kind === 'depot') {
      workCanopy('gallery', frontSupports(), 0.6);
      root.add(
        depotFacade(
          b,
          input,
          T,
          height,
          base,
          roofRise,
          geometry,
          materials,
          legacy,
        ),
      );
    }
    if (
      kind === 'barracks' &&
      wallInset === 0 &&
      (!legacy || b.wallFinish !== undefined)
    ) {
      root.add(barracksGate(b, input, T, height, base, geometry, materials));
    } else if (kind === 'barracks') {
      feature('barracks-gate', () => {
        const supports = entranceSupports();
        for (const support of supports) {
          const [u, v] = bearing(support, 0, true);
          box(u, v, height * 0.5, 0.22, height, 0.38 / T, trim);
        }
        if (supports.length !== 2) {
          return;
        }
        const lo = Math.min(...supports) - alongInset,
          hi = Math.max(...supports) - alongInset;
        box(
          (lo + hi) * 0.5,
          -0.11 / T,
          height - 0.06,
          hi - lo + 0.24,
          0.18,
          0.25 / T,
          trim,
        );
        const y = height - 0.03,
          v = -0.26 / T,
          w = 0.19 / T;
        batch.polygon(
          trim,
          [
            at(doorU - w, v, y + 0.18),
            at(doorU + w, v, y + 0.18),
            at(doorU + w, v, y - 0.09),
            at(doorU, v, y - 0.23),
            at(doorU - w, v, y - 0.09),
          ],
          light,
        );
        for (const sign of [-1, 1]) {
          batch.cylinder(
            iron,
            at(doorU - (sign * 0.105) / T, v - 0.014 / T, y + 0.105),
            at(doorU + (sign * 0.105) / T, v - 0.014 / T, y - 0.105),
            0.017,
            light,
          );
          batch.cylinder(
            materials.get('brass'),
            at(doorU + (sign * 0.068) / T, v - 0.018 / T, y - 0.132),
            at(doorU + (sign * 0.136) / T, v - 0.018 / T, y - 0.068),
            0.018,
            light,
          );
        }
      });
    }
    if (kind === 'stable') {
      if (legacy && b.wallFinish === undefined) {
        feature('stable-timber-frame', () => {
          const y = height * 0.91;
          box(
            frame.width * 0.5,
            -0.13 / T,
            y,
            frame.width + 0.1,
            0.14,
            0.2 / T,
            wood,
          );
          for (let u = 0; u <= frame.width; u += 2) {
            if (wallAt(u, 0)?.type === 'wall') {
              const [a, v] = bearing(u, 0, u !== 0 && u !== frame.width);
              box(a, v, y * 0.5, 0.15, y, 0.38 / T, wood);
              batch.cylinder(
                wood,
                at(a, v, y - 0.3),
                at(a + (u < frame.width / 2 ? 0.42 : -0.42), v, y - 0.04),
                0.04,
                light,
              );
            }
          }
        });
      } else {
        root.add(
          stableTimberFrame(b, input, T, height, base, geometry, materials),
        );
      }
      root.add(
        stableVentilation(
          b,
          input,
          T,
          height,
          base,
          roofRise,
          geometry,
          materials,
        ),
      );
    }
  } else if (kind === 'smithy') {
    if (legacy && b.wallFinish === undefined) {
      sideChimney(true);
    } else {
      root.add(
        smithyChimney(b, input, T, height, base, roofRise, geometry, materials),
      );
    }
    workCanopy('forge-canopy', entranceSupports(), 0.5);
  } else if (kind === 'house') {
    sideChimney();
    root.add(
      houseFacade(b, input, T, height, base, geometry, materials, legacy),
    );
  }
  // Optional additions reuse the existing supported exterior details. They
  // never add collision cells, playable floors or access links.
  if (style?.gallery === true && !['farmhouse', 'estancia'].includes(kind)) {
    farmhouseGallery();
  }
  if (style?.awning === true && kind !== 'pulperia') {
    workCanopy('campaign-awning', entranceSupports(), 0.55);
  }
  if (
    style?.tower === true &&
    !['church', 'cabildo', 'townhall'].includes(kind)
  ) {
    const end = [0, frame.width].find((u) => wallAt(u, 0)?.type === 'wall');
    if (end !== undefined) {
      tower(end - alongInset, -depthInset, 0.8, height + roofRise + 1.25);
    }
  }
  root.add(batch.finish(`building-detail:${b.id}:fabric`));
  return root;
}
