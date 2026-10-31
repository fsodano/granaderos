import type { BufferGeometry, Object3D } from 'three';
import { isMesh } from './scene-node-types';

const fitted = new WeakSet<BufferGeometry>();
const nativeTriangles = [1218, 414, 154];

/** Return a smooth window and its derivative in model metres. */
function ramp(low: number, high: number, value: number): [number, number] {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return [t * t * (3 - 2 * t), t > 0 && t < 1 ? (6 * t * (1 - t)) / (high - low) : 0];
}

/** Fit only the retained native poncho. Its constant atlas coordinate separates
 * the sewn panel from the coat beneath it, including the split coarse faces.
 * This runs once on the cached rest mesh, before actor skeletons are cloned. */
export function fitGauchoPoncho(root: Object3D, appearance: string) {
  if (appearance !== 'gaucho') {
    return;
  }
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const match = /^Human_outfit_LOD([012])$/.exec(object.name),
      geometry = object.geometry;
    if (!match || fitted.has(geometry)) {
      return;
    }
    const position = geometry.getAttribute('position'),
      normal = geometry.getAttribute('normal'),
      uv = geometry.getAttribute('uv'),
      index = geometry.index;
    if (
      !position ||
      !normal ||
      !uv ||
      !index ||
      normal.count !== position.count ||
      uv.count !== position.count
    ) {
      return;
    }
    const owned = new Set<number>(),
      unowned = new Set<number>();
    let triangles = 0;
    for (let offset = 0; offset < index.count; offset += 3) {
      const triangle = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
      const poncho = triangle.every(
        (vertex) =>
          Math.abs(uv.getX(vertex) - 0.015625) < 1e-7 &&
          Math.abs(uv.getY(vertex) - 0.984375) < 1e-7,
      );
      for (const vertex of triangle) {
        (poncho ? owned : unowned).add(vertex);
      }
      if (poncho) {
        triangles++;
      }
    }
    // Replacement outfits must opt in through their own fit. Never move a
    // vertex shared with the underlying coat or another material role.
    if (
      triangles !== nativeTriangles[Number(match[1])] ||
      [...owned].some((vertex) => unowned.has(vertex))
    ) {
      return;
    }
    fitted.add(geometry);
    for (const vertex of owned) {
      const x = position.getX(vertex),
        y = position.getY(vertex),
        z = position.getZ(vertex),
        excess = -z - 0.11;
      if (excess <= 0) {
        continue;
      }
      const [lower, lowerSlope] = ramp(1.03, 1.28, y),
        [upper, upperSlope] = ramp(1.42, 1.48, y),
        [side, sideSlope] = ramp(0.1, 0.27, Math.abs(x));
      const height = lower * (1 - upper),
        width = 1 - side;
      if (height === 0 || width === 0) {
        continue;
      }
      // Leave a soft cloth gap behind the coat. Keep the original front,
      // shoulder rim, lateral outline and loose lower hem exactly in place.
      const relief = excess < 0.02 ? (excess * excess) / 0.04 : excess - 0.01,
        reliefSlope = Math.min(1, excess / 0.02);
      const offset = 0.9 * height * width * relief;
      const dx = -0.9 * height * sideSlope * Math.sign(x) * relief;
      const dy = 0.9 * (lowerSlope * (1 - upper) - lower * upperSlope) * width * relief;
      const dz = 1 - 0.9 * height * width * reliefSlope;
      position.setZ(vertex, z + offset);
      // Transform the authored normal with the inverse-transpose Jacobian.
      // Rebuilding normals for the whole outfit would erase its cloth folds
      // and the deliberately separate coarse panel normals.
      const nz = normal.getZ(vertex) / dz,
        nx = normal.getX(vertex) - dx * nz,
        ny = normal.getY(vertex) - dy * nz,
        length = Math.hypot(nx, ny, nz);
      normal.setXYZ(vertex, nx / length, ny / length, nz / length);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
}
