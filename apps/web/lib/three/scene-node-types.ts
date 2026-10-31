import { Mesh, SkinnedMesh, Texture, Line, Bone } from 'three';
import type { Object3D } from 'three';
/** Preserve Three's concrete geometry and material defaults during runtime narrowing. */
export function isMesh(node: Object3D | undefined): node is Mesh {
  return node instanceof Mesh;
}
export function isSkinnedMesh(node: Object3D | undefined): node is SkinnedMesh {
  return node instanceof SkinnedMesh;
}

export function isTexture(value: unknown): value is Texture {
  return value instanceof Texture;
}

export function isLine(node: Object3D): node is Line {
  return node instanceof Line;
}

export function isBone(node: Object3D | undefined): node is Bone {
  return node instanceof Bone;
}
