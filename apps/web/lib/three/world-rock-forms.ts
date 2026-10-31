import { required } from './required';
import { IcosahedronGeometry } from 'three';

// The original twelve corners keep their connectivity. Four upper corners
// form a broad broken cap; unequal shoulders interrupt the symmetric outline.
// Coordinates use the original axis extent; all six bounds remain exact.
const forms: readonly (readonly (readonly number[])[])[] = [
  [
    [-0.68, 1, -0.14],
    [0.45, 1, 0.18],
    [-0.57, -1, -0.1],
    [0.39, -1, 0.09],
    [0, 1, 1],
    [0, 1, -1],
    [0.09, -0.65, 0.72],
    [-0.12, -0.58, -0.78],
    [1, 0.27, 0.58],
    [1, -0.16, -0.6],
    [-1, -0.08, 0.6],
    [-1, 0.18, -0.55],
  ] as const,
  [
    [-0.48, 1, 0.14],
    [0.7, 1, -0.05],
    [-0.44, -1, 0.16],
    [0.55, -1, -0.1],
    [0, 1, 1],
    [0, 0.84, -1],
    [-0.18, -0.56, 0.78],
    [0.05, -0.7, -0.65],
    [1, -0.18, 0.6],
    [1, 0.28, -0.54],
    [-1, 0.24, 0.54],
    [-1, -0.1, -0.58],
  ] as const,
  [
    [-0.39, 1, -0.16],
    [0.66, 1, 0.11],
    [-0.63, -1, -0.09],
    [0.44, -1, 0.18],
    [0, 1, 1],
    [0, 0.92, -1],
    [0.15, -0.72, 0.65],
    [-0.11, -0.54, -0.82],
    [1, 0.1, 0.6],
    [1, -0.22, -0.59],
    [-1, -0.18, 0.57],
    [-1, 0.3, -0.6],
  ] as const,
];
export const ROCK_FORM_COUNT = forms.length;
export function rockForm(variant: number) {
  const form = forms[variant];
  if (!form) {
    throw Error(`Unknown rock form ${variant}`);
  }
  const geometry = new IcosahedronGeometry(1, 0),
    position = geometry.getAttribute('position');
  const extent = Math.max(...position.array);
  for (let n = 0; n < position.count; n++) {
    const x = position.getX(n),
      y = position.getY(n),
      z = position.getZ(n);
    const corner =
      z === 0
        ? y > 0
          ? x < 0
            ? 0
            : 1
          : x < 0
            ? 2
            : 3
        : x === 0
          ? y > 0
            ? z > 0
              ? 4
              : 5
            : z > 0
              ? 6
              : 7
          : x > 0
            ? z > 0
              ? 8
              : 9
            : z > 0
              ? 10
              : 11;
    const point = required(form[corner]);
    position.setXYZ(
      n,
      required(point[0]) * extent,
      required(point[1]) * extent,
      required(point[2]) * extent,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
