import { isMesh, isLine } from './scene-node-types';
import { required } from './required';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rockForm } from './world-rock-forms';
import { leafSpray } from './world-leaf-sprays';
import {
  floorRugBodyGeometry,
  floorRugTrimGeometry,
  storageSackGeometry,
} from './world-storage-cloth';

export type PolygonUV = (point: Vector3) => readonly [number, number];
/** Roof courses run along the low eave, with their spacing measured on the
 * actual slope. Retain this projector when clipping a plane for room reveal. */
export function roofTextureProjector(points: readonly Vector3[]): PolygonUV {
  const origin = required(points[0]),
    across = points[1]?.clone().sub(origin);
  if (!origin || !across || across.lengthSq() < 1e-12) {
    return (point) => [point.x, point.z + point.y] as const;
  }
  across.normalize();
  const uphill = points
    .slice(2)
    .map((point) => point.clone().sub(origin))
    .map((offset) => offset.addScaledVector(across, -offset.dot(across)))
    .find((offset) => offset.lengthSq() > 1e-12);
  if (!uphill) {
    return (point) => [point.x, point.z + point.y] as const;
  }
  uphill.normalize();
  // TextureLoader's vertical axis points upwards. Positive V therefore runs
  // from the eave to the ridge; the image's lower tile edge faces downhill.
  return (point) => {
    const offset = point.clone().sub(origin);
    return [offset.dot(across), offset.dot(uphill)];
  };
}

/** Owned primitive library; merged render geometry does not retain its inputs. */
export class WorldGeometry {
  private cache = new Map<string, BufferGeometry>();
  get(kind: string) {
    let geometry = this.cache.get(kind);
    if (geometry) {
      return geometry;
    }
    if (kind === 'box') {
      geometry = new BoxGeometry(1, 1, 1);
    } else if (kind === 'cone') {
      geometry = new ConeGeometry(1, 1, 10);
    } else if (kind === 'grass-tuft') {
      // Three tapered leaves bend through their middle from a shared root.
      // The existing double-sided material lights both leaf faces.
      const vertices: number[] = [],
        colours: number[] = [];
      for (const [index, height, lean] of [
        [0, 0.72, 0.4],
        [1, 1, 0.29],
        [2, 0.44, 0.9],
      ] as const) {
        const angle = index * 2.0943951024,
          dx = Math.cos(angle),
          dz = Math.sin(angle),
          width = 0.024;
        const point = (reach: number, y: number, halfWidth: number) =>
          new Vector3(dx * reach - dz * halfWidth, y, dz * reach + dx * halfWidth);
        const a = point(0, 0, -width),
          b = point(0, 0, width),
          c = point(height * lean * 0.36, height * 0.56, width * 0.65),
          d = point(height * lean * 0.36, height * 0.56, -width * 0.65),
          tip = point(height * lean, height, 0);
        for (const face of [
          [a, b, c],
          [a, c, d],
          [d, c, tip],
        ] as const) {
          for (const p of face) {
            vertices.push(p.x, p.y, p.z);
            const shade = 0.83 + (0.2 * p.y) / height;
            colours.push(shade, shade, shade);
          }
        }
      }
      geometry = new BufferGeometry().setAttribute(
        'position',
        new BufferAttribute(new Float32Array(vertices), 3),
      );
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
      geometry.computeVertexNormals();
    } else if (kind === 'cylinder') {
      geometry = new CylinderGeometry(1, 1, 1, 12);
    } else if (kind === 'taper') {
      geometry = new CylinderGeometry(0.82, 1, 1, 12);
    } else if (kind === 'flare') {
      geometry = new CylinderGeometry(1, 0.35, 1, 12);
    } else if (kind === 'sphere') {
      geometry = new IcosahedronGeometry(1, 1);
    } else if (kind.startsWith('crown-')) {
      geometry = new IcosahedronGeometry(1, 1);
      const position = geometry.getAttribute('position'),
        colours = new Float32Array(position.count * 3),
        variant = Number(kind.slice(6));
      for (let n = 0; n < position.count; n++) {
        const x = position.getX(n),
          y = position.getY(n),
          z = position.getZ(n),
          noise =
            Math.sin(x * 8.3 + y * 4.7 + variant * 2.1) * Math.cos(z * 7.2 - y * 3.1 + variant),
          radius = 0.84 + 0.19 * noise;
        position.setXYZ(
          n,
          x * radius,
          y * (radius + 0.05 * Math.sin(z * 11)),
          z * (radius + 0.06 * Math.cos(x * 9)),
        );
        const shade =
          0.81 + 0.16 * (0.5 + 0.5 * Math.sin(x * 6.1 + y * 5.8 + z * 3.2 + variant * 7));
        colours[n * 3] = shade * (0.92 + 0.06 * Math.sin(y * 9 + variant));
        colours[n * 3 + 1] = shade;
        colours[n * 3 + 2] = shade * 0.88;
      }
      geometry.setAttribute('color', new BufferAttribute(colours, 3));
    } else if (kind === 'rock') {
      geometry = new IcosahedronGeometry(1, 0);
    } else if (kind.startsWith('leaf-spray-')) {
      const variant = Number(kind.slice('leaf-spray-'.length));
      geometry = leafSpray(this.get(`crown-${variant}`), variant);
    } else if (kind.startsWith('rock-form-')) {
      geometry = rockForm(Number(kind.slice('rock-form-'.length)));
    } else if (kind === 'torus') {
      geometry = new TorusGeometry(1, 0.09, 6, 16);
    } else if (kind === 'bed-mattress') {
      geometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
    } else if (kind === 'bed-pillow') {
      geometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.28);
    } else if (kind === 'bed-blanket') {
      geometry = bedBlanketGeometry();
    } else if (kind === 'washstand-basin') {
      geometry = lathe([
        [0, -0.012],
        [0.12, -0.012],
        [0.12, 0],
        [0.16, 0.025],
        [0.19, 0.1],
        [0.18, 0.13],
        [0.16, 0.12],
        [0.13, 0.04],
        [0.1, 0.035],
        [0, 0.035],
      ] as const);
    } else if (kind === 'washstand-pitcher') {
      geometry = washstandPitcherGeometry();
    } else if (kind === 'washstand-handle') {
      geometry = washstandHandleGeometry();
    } else if (kind === 'washstand-towel') {
      geometry = washstandTowelGeometry();
    } else if (kind === 'hearth-pot') {
      geometry = lathe([
        [0, 0],
        [0.082, 0],
        [0.105, 0.017],
        [0.132, 0.07],
        [0.14, 0.134],
        [0.142, 0.153],
        [0.139, 0.16],
        [0.127, 0.16],
        [0.125, 0.147],
        [0.127, 0.13],
        [0.119, 0.074],
        [0.09, 0.022],
        [0, 0.022],
      ] as const);
    } else if (kind === 'hearth-bail') {
      geometry = new TorusGeometry(1, 0.04, 4, 12, Math.PI);
    } else if (kind === 'shelf-jar') {
      geometry = shelfVesselGeometry('jar');
    } else if (kind === 'shelf-bottle') {
      geometry = shelfVesselGeometry('bottle');
    } else if (kind === 'shelf-bowl') {
      geometry = shelfVesselGeometry('bowl');
    } else if (kind === 'storage-sack-0' || kind === 'storage-sack-1') {
      geometry = storageSackGeometry(Number(kind.slice(-1)));
    } else if (kind === 'floor-rug-body') {
      geometry = floorRugBodyGeometry();
    } else if (kind === 'floor-rug-trim') {
      geometry = floorRugTrimGeometry();
    } else {
      throw Error(`Unknown world primitive ${kind}`);
    }
    this.cache.set(kind, geometry);
    return geometry;
  }
  dispose() {
    for (const geometry of this.cache.values()) {
      geometry.dispose();
    }
    this.cache.clear();
  }
}
/** A thin folded sheet and one loose side edge, shared by every bed. X/Z are
 * unit dimensions; Y stays in metres because furniture height does not stretch. */
function bedBlanketGeometry() {
  const columns = [-0.5, -0.4, -0.18, 0.12, 0.34, 0.5],
    rows = [-0.5, -0.37, -0.19, -0.03, 0.15, 0.32, 0.5],
    folds = [0.005, 0.03, 0.003, 0.025, 0, 0.033, 0.005];
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row < rows.length; row++) {
    const z = required(rows[row]),
      fold = required(folds[row]);
    for (const x of columns) {
      // A thin sheet clears the whole mattress top, including each rounded
      // edge triangle. Positive folds and all hanging hem vertices stay exact.
      const edge = Math.max(0, (Math.abs(x) - 0.4) / 0.1),
        y = Math.max(0.002, fold * (0.82 + 0.18 * Math.cos(x * 5 + z * 2)) - 0.016 * edge * edge);
      positions.push(x, y, z);
      uv.push(x + 0.5, z + 0.5);
    }
    // The edge bends out before falling. Its loose hem stays inside the frame
    // width and above the frame platform, including on shorter authored beds.
    for (const [x, y] of [
      [0.526, -0.055 + fold * 0.2],
      [0.51, -0.13 + fold * 0.08],
      [0.5, -0.19 + 0.012 * Math.sin(row * 2.3)],
    ] as const) {
      positions.push(x, y, z);
      uv.push(x + 0.5, z + 0.5);
    }
  }
  const stride = columns.length + 3;
  for (let row = 0; row < rows.length - 1; row++) {
    for (let column = 0; column < stride - 1; column++) {
      const a = row * stride + column,
        b = a + 1,
        c = a + stride,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry()
    .setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    .setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
    .setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function washstandPitcherGeometry() {
  const geometry = lathe([
      [0, 0],
      [0.048, 0],
      [0.049, 0.015],
      [0.067, 0.045],
      [0.071, 0.11],
      [0.059, 0.167],
      [0.036, 0.196],
      [0.039, 0.232],
      [0.043, 0.24],
      [0.032, 0.24],
      [0.029, 0.2],
      [0.047, 0.164],
      [0.056, 0.107],
      [0.049, 0.046],
      [0, 0.028],
    ] as const),
    position = geometry.getAttribute('position');
  // A narrow neck and outside handle retain the authored jug proportions.
  // A small lip points towards the basin without raising its 24 cm rim.
  for (let n = 0; n < position.count; n++) {
    const x = position.getX(n),
      y = position.getY(n),
      z = position.getZ(n),
      radius = Math.hypot(x, z);
    if (radius > 0 && y > 0.196) {
      const sector = Math.max(0, (-x / radius - 0.82) / 0.18),
        lip = Math.min(1, (y - 0.196) / 0.036);
      position.setX(n, x - 0.018 * sector * lip);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
function washstandHandleGeometry() {
  const geometry = new TorusGeometry(1, 0.15, 4, 12, Math.PI);
  geometry.rotateZ(-Math.PI * 0.5);
  const position = geometry.getAttribute('position');
  // An open D handle joins the shoulder and body without passing through the
  // jug cavity. Its upper attachment leans towards the narrower shoulder.
  for (let n = 0; n < position.count; n++) {
    position.setX(n, position.getX(n) - 0.22 * Math.max(0, position.getY(n)));
  }
  geometry.computeVertexNormals();
  return geometry;
}
/** Top folds rest on the table; a narrow sheet bends over its front edge. */
function washstandTowelGeometry() {
  const columns = [-0.5, -0.3, 0, 0.3, 0.5],
    path = [
      [-0.5, 0, 1],
      [0.05, 0, 1],
      [0.5, 0, 1],
      [0.55, -0.035, 0.99],
      [0.565, -0.12, 0.94],
      [0.55, -0.235, 0.97],
      [0.53, -0.35, 1.02],
    ] as const,
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row < path.length; row++) {
    for (const x of columns) {
      const [z, y, width] = required(path[row]),
        crease = Math.sin(x * Math.PI * 3),
        top = row < 3;
      positions.push(
        x * width,
        y +
          (top
            ? 0.006 * crease * crease
            : row === path.length - 1
              ? 0.014 * Math.cos(x * Math.PI * 4 + 1)
              : 0),
        z + (top ? 0 : 0.035 * crease),
      );
      uv.push(x + 0.5, row / (path.length - 1));
    }
  }
  for (let row = 0; row < path.length - 1; row++) {
    for (let column = 0; column < columns.length - 1; column++) {
      const a = row * columns.length + column,
        b = a + 1,
        c = a + columns.length,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry()
    .setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    .setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
    .setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** Small storage vessels have an outside foot, rolled lip and real cavity.
 * Eight radial segments limit the cached geometry cost. */
function shelfVesselGeometry(kind: 'jar' | 'bottle' | 'bowl') {
  const profiles = {
    jar: [
      [0, 0],
      [0.039, 0],
      [0.053, 0.014],
      [0.069, 0.074],
      [0.063, 0.13],
      [0.036, 0.166],
      [0.036, 0.181],
      [0.043, 0.181],
      [0.043, 0.191],
      [0.03, 0.191],
      [0.027, 0.175],
      [0.052, 0.126],
      [0.057, 0.057],
      [0, 0.024],
    ] as const,
    bottle: [
      [0, 0],
      [0.031, 0],
      [0.043, 0.014],
      [0.052, 0.082],
      [0.047, 0.157],
      [0.02, 0.202],
      [0.02, 0.245],
      [0.027, 0.245],
      [0.027, 0.257],
      [0.014, 0.257],
      [0.013, 0.207],
      [0.035, 0.156],
      [0.039, 0.035],
      [0, 0.025],
    ] as const,
    bowl: [
      [0, 0],
      [0.043, 0],
      [0.055, 0.012],
      [0.066, 0.062],
      [0.07, 0.093],
      [0.07, 0.103],
      [0.058, 0.103],
      [0.054, 0.08],
      [0.043, 0.025],
      [0, 0.025],
    ] as const,
  } as const;
  const points = profiles[kind],
    geometry = lathe(points, 8),
    colours = new Float32Array(geometry.getAttribute('position').count * 3),
    inside = kind === 'bowl' ? 6 : 9;
  // Shared ceramic/food materials retain the admitted room light. A restrained
  // cavity shade survives the day sky's fill without adding a material batch.
  for (let n = 0; n < colours.length / 3; n++) {
    const shade = n % points.length >= inside ? 0.68 : 1;
    colours.fill(shade, n * 3, n * 3 + 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return geometry;
}
export class WorldBatch {
  private parts = new Map<MeshStandardMaterial, BufferGeometry[]>();
  public library: WorldGeometry;
  constructor(library: WorldGeometry) {
    this.library = library;
  }
  add(
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    matrix = new Matrix4(),
    light = 1,
    metricBoxUV = false,
  ) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    part.applyMatrix4(matrix);
    if (!part.getAttribute('normal')) {
      part.computeVertexNormals();
    }
    if (metricBoxUV) {
      const p = part.getAttribute('position'),
        normal = part.getAttribute('normal'),
        uv = new Float32Array(p.count * 2);
      for (let n = 0; n < p.count; n++) {
        const nx = normal.getX(n),
          ny = normal.getY(n),
          nz = normal.getZ(n);
        if (Math.abs(ny) > 0.5) {
          uv[n * 2] = p.getX(n);
          uv[n * 2 + 1] = p.getZ(n);
        } else if (Math.abs(nx) > Math.abs(nz)) {
          uv[n * 2] = p.getZ(n) * (nx > 0 ? -1 : 1);
          uv[n * 2 + 1] = p.getY(n);
        } else {
          uv[n * 2] = p.getX(n) * (nz > 0 ? 1 : -1);
          uv[n * 2 + 1] = p.getY(n);
        }
      }
      part.setAttribute('uv', new BufferAttribute(uv, 2));
    }
    if (!part.getAttribute('uv')) {
      part.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array(part.getAttribute('position').count * 2), 2),
      );
    }
    const colours = new Float32Array(part.getAttribute('position').count * 3),
      source = part.getAttribute('color');
    if (source) {
      for (let n = 0; n < source.count; n++) {
        colours[n * 3] = source.getX(n) * light;
        colours[n * 3 + 1] = source.getY(n) * light;
        colours[n * 3 + 2] = source.getZ(n) * light;
      }
    } else {
      colours.fill(light);
    }
    part.setAttribute('color', new BufferAttribute(colours, 3));
    const list = this.parts.get(material) ?? [];
    list.push(part);
    this.parts.set(material, list);
  }
  primitive(
    kind: string,
    material: MeshStandardMaterial,
    position: Vector3 | readonly [number, number, number],
    scale: readonly [number, number, number],
    rotation?: Quaternion,
    light = 1,
  ) {
    const point = position instanceof Vector3 ? position : new Vector3(...position);
    this.add(
      this.library.get(kind),
      material,
      new Matrix4().compose(point, rotation ?? new Quaternion(), new Vector3(...scale)),
      light,
      kind === 'box' && material.userData['metricBoxUV'] === true,
    );
  }
  box(
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    light = 1,
  ) {
    if (w > 0 && h > 0 && d > 0) {
      this.primitive('box', material, [x, y, z], [w, h, d], undefined, light);
    }
  }
  cylinder(
    material: MeshStandardMaterial,
    a: Vector3,
    b: Vector3,
    radius: number,
    light = 1,
    kind = 'cylinder',
  ) {
    const vector = b.clone().sub(a);
    this.primitive(
      kind,
      material,
      a.clone().add(b).multiplyScalar(0.5),
      [radius, vector.length(), radius],
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), vector.normalize()),
      light,
    );
  }
  polygon(
    material: MeshStandardMaterial,
    points: readonly Vector3[],
    light = 1,
    projectUV?: PolygonUV,
  ) {
    if (points.length < 3) {
      return;
    }
    const vertices: number[] = [];
    for (let n = 1; n < points.length - 1; n++) {
      for (const point of [required(points[0]), required(points[n]), required(points[n + 1])]) {
        vertices.push(point.x, point.y, point.z);
      }
    }
    const geometry = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array(vertices), 3),
    );
    geometry.computeVertexNormals();
    const uv = new Float32Array((vertices.length / 3) * 2);
    for (let n = 0; n < vertices.length / 3; n++) {
      const point = new Vector3().fromArray(vertices, n * 3);
      if (projectUV) {
        const value = projectUV(point);
        uv[n * 2] = value[0];
        uv[n * 2 + 1] = value[1];
      } else {
        uv[n * 2] = point.x;
        uv[n * 2 + 1] = point.z + point.y;
      }
    }
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    this.add(geometry, material, new Matrix4(), light);
    geometry.dispose();
  }
  take(group: Group, matrix = new Matrix4(), light = 1) {
    for (const child of group.children) {
      if (!isMesh(child) || !(child.material instanceof MeshStandardMaterial)) {
        throw new Error(`Invalid world batch mesh: ${child.name}`);
      }
      this.add(child.geometry, child.material, matrix, light);
      child.geometry.dispose();
    }
  }
  finish(name: string) {
    const group = new Group();
    group.name = name;
    for (const [material, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      for (const part of parts) {
        part.dispose();
      }
      if (!geometry) {
        throw Error(`Cannot merge world mesh ${name}`);
      }
      const mesh = new Mesh(geometry, material);
      mesh.name = `${name}:${material.name}`;
      mesh.castShadow = material.opacity >= 1;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
export function disposeWorldNode(object: Group | Mesh | import('three').Object3D) {
  object.traverse((child) => {
    if (isMesh(child) || isLine(child)) {
      child.geometry.dispose();
    }
    if (isLine(child)) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        material.dispose();
      }
    }
  });
  object.removeFromParent();
}
export function lathe(points: readonly (readonly [number, number])[], segments = 12) {
  return new LatheGeometry(
    points.map((point) => new Vector2(point[0], point[1])),
    segments,
  );
}
export function planarShape(points: readonly (readonly [number, number])[]) {
  const shape = new Shape(points.map((point) => new Vector2(point[0], point[1])));
  return new ShapeGeometry(shape);
}
export const seeded = (x: number, y: number, salt = 0) =>
  ((Math.imul(x + salt + 71, 374761393) ^ Math.imul(y - salt + 97, 668265263)) >>> 0) / 0xffffffff;
export function cellTop(
  batch: WorldBatch,
  material: MeshStandardMaterial,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  height: number,
  light = 1,
) {
  batch.polygon(
    material,
    [
      new Vector3(x0, height, z0),
      new Vector3(x0, height, z1),
      new Vector3(x1, height, z1),
      new Vector3(x1, height, z0),
    ],
    light,
  );
}
