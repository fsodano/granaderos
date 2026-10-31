import { Quaternion, Vector3 } from 'three';
import { WorldBatch } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';

/** A leaf keeps its existing hinge and span; decoration follows both faces. */
export function addDoorLeaf(
  batch: WorldBatch,
  materials: WorldMaterialSource,
  {
    width: w,
    height: h,
    sign,
    style,
    broken,
    light,
    sourceBands = false,
  }: {
    width: number;
    height: number;
    sign: number;
    style: string;
    broken: boolean;
    light: number;
    sourceBands?: boolean;
  },
) {
  const wood = materials.get('wood'),
    dark = materials.get('darkwood'),
    iron = materials.get('iron');
  // Opening's narrow timber mouldings and braces use lighter edge colours.
  // Retain the shared wood texture on the leaf rather than bleaching it.
  const moulding = materials.get('timber-edge', { colour: '#9c8058' }),
    brace = materials.get('timber-brace', { colour: '#baa077' });
  batch.box(wood, sign * w * 0.5, h * 0.5, 0, w, h * 0.98, 0.06, light);
  const full = h >= 0.75;
  for (const face of [-1, 1]) {
    const z = face * 0.036;
    if (style === 'panelled' && full) {
      const edge = 0.018,
        panelW = w * 0.27,
        panelH = h * 0.3;
      for (const x of [0.28, 0.72]) {
        for (const y of [0.3, 0.7]) {
          const u = sign * w * x,
            v = h * y;
          batch.box(dark, u, v, z, panelW, panelH, 0.008, light);
          for (const side of [-1, 1]) {
            batch.box(
              moulding,
              u + side * (panelW + edge) * 0.5,
              v,
              face * 0.047,
              edge,
              panelH + edge * 2,
              0.022,
              light,
            );
            batch.box(
              moulding,
              u,
              v + side * (panelH + edge) * 0.5,
              face * 0.047,
              panelW + edge * 2,
              edge,
              0.022,
              light,
            );
          }
        }
      }
    } else {
      const planks = style === 'double' ? 3 : 6;
      for (let n = 1; n < planks; n++) {
        batch.box(
          dark,
          (sign * w * n) / planks,
          h * 0.5,
          z,
          0.012,
          h * 0.93,
          0.008,
          light,
        );
      }
      if (full) {
        // Opening draws its two cross bands at 7/33 and 24/33 of the leaf,
        // 1.3 source units high, with a one-unit inset at each edge. Each
        // physical double leaf retains its own band and working hinge.
        const authored = sourceBands,
          wide = ['double', 'barn', 'arched'].includes(style),
          span = authored ? w * (1 - 2 / (wide ? 28 : 18)) : w * 0.82;
        const band = authored
          ? materials.get('door-cross-band', { colour: '#4b4435' })
          : iron;
        for (const y of authored ? [7 / 33, 24 / 33] : [0.21, 0.73]) {
          batch.box(
            band,
            sign * w * 0.5,
            h * y,
            face * 0.046,
            span,
            authored ? (h * 1.3) / 33 : 0.032,
            0.016,
            light,
          );
        }
      }
    }
    if (style === 'barn' && full) {
      batch.box(
        dark,
        sign * w * 0.5,
        h * 0.5,
        z,
        0.014,
        h * 0.94,
        0.009,
        light,
      );
      // The source gate has two diagonal timber braces. A flat rectangular
      // section keeps their join legible without making round metal rods.
      for (const x of [0.1, 0.9]) {
        const a = new Vector3(sign * w * x, h * 0.88, face * 0.051),
          b = new Vector3(sign * w * 0.5, h * 0.1, face * 0.051),
          delta = b.clone().sub(a);
        batch.primitive(
          'box',
          brace,
          a.clone().add(b).multiplyScalar(0.5),
          [0.045, delta.length(), 0.022],
          new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            delta.normalize(),
          ),
          light,
        );
      }
    }
    if (full) {
      for (const y of [0.23, 0.75]) {
        batch.box(
          iron,
          sign * w * 0.09,
          h * y,
          face * 0.048,
          w * 0.15,
          0.065,
          0.018,
          light,
        );
      }
      batch.box(
        iron,
        sign * w * 0.83,
        h * 0.46,
        face * 0.047,
        0.045,
        0.09,
        0.014,
        light,
      );
      batch.primitive(
        'sphere',
        materials.get('brass'),
        [sign * w * 0.83, h * 0.46, face * 0.062],
        [0.023, 0.023, 0.018],
        undefined,
        light,
      );
    }
    if (broken) {
      batch.box(
        dark,
        sign * w * 0.5,
        h * 0.54,
        face * 0.047,
        w * 0.9,
        0.035,
        0.018,
        light,
      );
    }
  }
}
