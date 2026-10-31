import { required } from './required';
import { BufferAttribute, BufferGeometry } from 'three';

/** Closed low-cost sacks: a flat foot, broad body creases and a gathered neck.
 * X/Z are unit radii. The existing prop keeps its placement and height scale. */
export function storageSackGeometry(variant: number) {
  const profile = [
      [-16 / 17, 0.38, 0.34],
      [-0.62, 0.78, 0.73],
      [-0.08, 0.96, 0.91],
      [0.36, 0.83, 0.78],
      [0.64, 0.48, 0.44],
      [0.73, 0.23, 0.2],
      [0.97, 0.32, 0.27],
    ] as const,
    position: number[] = [],
    colour: number[] = [],
    uv: number[] = [],
    index: number[] = [],
    segments = 8;
  for (const [ring, [y, rx, rz]] of profile.entries()) {
    for (let n = 0; n < segments; n++) {
      const angle = (n * Math.PI * 2) / segments,
        body = ring > 0 && ring < 5,
        fold = body
          ? 0.045 * Math.cos(angle * 3 + variant * 0.7) +
            0.025 * Math.sin(angle * 2 - variant)
          : ring >= 5
            ? 0.045 * Math.cos(angle * 4)
            : 0;
      const lean = (ring / 6) * 0.035 * (variant ? 1 : -1),
        height =
          ring === 0
            ? y
            : ring === 6
              ? y + 0.03 * Math.cos(angle)
              : y + 0.025 * Math.sin(angle * 2 + variant) * Number(body);
      position.push(
        Math.cos(angle) * (rx + fold) + lean,
        height,
        Math.sin(angle) * (rz + fold),
      );
      uv.push(n / segments, ring / 6);
      const shade =
        (ring === 5 ? 0.67 : ring === 6 ? 0.92 : 0.91) +
        0.045 * Math.cos(angle * 2 + variant) * Number(body);
      colour.push(shade, shade, shade);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring++) {
    for (let n = 0; n < segments; n++) {
      const a = ring * segments + n,
        b = ring * segments + ((n + 1) % segments),
        c = b + segments,
        d = a + segments;
      index.push(a, c, b, a, d, c);
    }
  }
  for (const [ring, y, shade] of [
    [0, -16 / 17, 0.84],
    [6, 0.93, 0.67],
  ] as const) {
    const centre = position.length / 3;
    position.push(ring === 0 ? 0 : (variant ? 1 : -1) * 0.035, y, 0);
    uv.push(0.5, ring / 6);
    colour.push(shade, shade, shade);
    for (let n = 0; n < segments; n++) {
      const a = ring * segments + n,
        b = ring * segments + ((n + 1) % segments);
      index.push(...(ring === 0 ? [centre, a, b] : [centre, b, a]));
    }
  }
  const geometry = new BufferGeometry()
    .setAttribute(
      'position',
      new BufferAttribute(new Float32Array(position), 3),
    )
    .setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
    .setAttribute('color', new BufferAttribute(new Float32Array(colour), 3))
    .setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function clothBuilder() {
  const positions: number[] = [],
    colours: number[] = [],
    uv: number[] = [];
  const face = (
    points: readonly (readonly [number, number, number])[],
    shade: number,
  ) => {
    for (let n = 1; n < points.length - 1; n++) {
      for (const p of [
        required(points[0]),
        required(points[n]),
        required(points[n + 1]),
      ]) {
        positions.push(...p);
        colours.push(shade, shade, shade);
        uv.push(required(p[0]) + 0.5, required(p[2]) + 0.5);
      }
    }
  };
  const finish = () => {
    const geometry = new BufferGeometry()
      .setAttribute(
        'position',
        new BufferAttribute(new Float32Array(positions), 3),
      )
      .setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
      .setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  return { face, finish };
}

/** The body rests on the floor. Broad dyed strips stay readable without a
 * fine woven texture, raised cords or a material for each stripe. */
export function floorRugBodyGeometry() {
  const { face, finish } = clothBuilder(),
    rows = [-0.37, -0.28, -0.16, 0.1, 0.22, 0.37] as const,
    shades = [0.82, 0.99, 0.88, 1.02, 0.8],
    left = -0.42,
    right = 0.42,
    top = 0.018;
  for (let n = 0; n < rows.length - 1; n++) {
    const a = required(rows[n]),
      b = required(rows[n + 1]);
    face(
      [
        [left, top, a],
        [left, top, b],
        [right, top, b],
        [right, top, a],
      ] as const,
      required(shades[n]),
    );
    face(
      [
        [left, 0, a],
        [left, 0, b],
        [left, top, b],
        [left, top, a],
      ] as const,
      0.8,
    );
    face(
      [
        [right, 0, b],
        [right, 0, a],
        [right, top, a],
        [right, top, b],
      ] as const,
      0.8,
    );
  }
  face(
    [
      [left, 0, required(rows[0])],
      [right, 0, required(rows[0])],
      [right, 0, required(rows.at(-1))],
      [left, 0, required(rows.at(-1))],
    ] as const,
    0.78,
  );
  for (const [z, reverse] of [
    [rows[0], false],
    [required(rows.at(-1)), true],
  ] as const) {
    const points = [
      [left, 0, z],
      [left, top, z],
      [right, top, z],
      [right, 0, z],
    ] as const;
    face(reverse ? points.toReversed() : points, 0.82);
  }
  return finish();
}

/** Pale woven bands and uneven separated fringe use the existing linen
 * batch. Every fringe tip meets the floor within the old84% rug rectangle. */
export function floorRugTrimGeometry() {
  const { face, finish } = clothBuilder(),
    rect = (x0: number, x1: number, z0: number, z1: number, shade: number) =>
      face(
        [
          [x0, 0.021, z0],
          [x0, 0.021, z1],
          [x1, 0.021, z1],
          [x1, 0.021, z0],
        ] as const,
        shade,
      );
  for (const sign of [-1, 1]) {
    const x = sign * 0.35;
    rect(x - 0.014, x + 0.014, -0.33, 0.33, 0.8);
    for (const [z, width, shade] of [
      [0.22, 0.025, 0.78],
      [0.28, 0.016, 0.88],
      [0.33, 0.02, 0.84],
    ] as const) {
      rect(-0.37, 0.37, sign * z - width * 0.5, sign * z + width * 0.5, shade);
    }
    for (let n = 0; n < 12; n++) {
      const x = (n - 5.5) * 0.062,
        width = 0.025 + 0.004 * Math.sin(n * 2.1),
        end = 0.408 + 0.012 * (0.5 + 0.5 * Math.sin(n * 1.7)),
        lean = 0.006 * Math.sin(n * 2.3);
      const points = [
        [x - width * 0.5, 0.018, sign * 0.37],
        [x + width * 0.5, 0.018, sign * 0.37],
        [x + lean + width * 0.34, 0, sign * end],
        [x + lean - width * 0.34, 0, sign * end],
      ] as const;
      face(sign === 1 ? points.toReversed() : points, 0.76 + 0.06 * (n % 3));
    }
  }
  return finish();
}
