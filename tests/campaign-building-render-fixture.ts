import assert from 'node:assert/strict';
import { MeshStandardMaterial } from 'three';
import { isMesh } from '../apps/web/lib/three/scene-node-types.ts';
import type { WorldTerrain, WorldBuilding, WorldInput } from '../apps/web/lib/three/world-types.ts';
interface RenderedMesh {
  name: string;
  materials: { name: string; colour: string }[];
  attributes: Record<string, number[]>;
  index: number[] | null;
  matrix: number[];
}
import { register } from 'node:module';
import { createHash } from 'node:crypto';
register('../tools/test-render-loader.ts', import.meta.url);
const { WorldGeometry, disposeWorldNode } = await import('../apps/web/lib/three/world-geometry.ts');
const { WorldMaterials } = await import('../apps/web/lib/three/world-materials.ts');
const { buildBuilding } = await import('../apps/web/lib/three/world-buildings.ts');
export const tileMetres = 1.2360585147470482;

export function renderBuilding(map: WorldTerrain, building: WorldBuilding) {
  const geometry = new WorldGeometry(),
    materials = new WorldMaterials({ tileMetres, assetUrl: (path) => path });
  const input: WorldInput = {
    terrain: {
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      ...(map.wallEdges === undefined ? {} : { wallEdges: map.wallEdges }),
      ...(map.buildings === undefined ? {} : { buildings: map.buildings }),
      ...(map.upperSurfaces === undefined ? {} : { upperSurfaces: map.upperSurfaces }),
    },
    revealedRooms: [],
  };
  const object = buildBuilding(building, input, tileMetres, geometry, materials),
    meshes: RenderedMesh[] = [];
  object.updateMatrixWorld(true);
  object.traverseVisible((child) => {
    if (isMesh(child)) {
      const records = Array.isArray(child.material) ? child.material : [child.material];
      meshes.push({
        name: child.name,
        materials: records.map((m) => {
          assert.ok(m instanceof MeshStandardMaterial);
          return { name: m.name, colour: m.color.getHexString() };
        }),
        attributes: Object.fromEntries(
          Object.entries(child.geometry.attributes).map(([key, a]) => [key, Array.from(a.array)]),
        ),
        index: child.geometry.index ? Array.from(child.geometry.index.array) : null,
        matrix: Array.from(child.matrixWorld.elements),
      });
    }
  });
  const colours = new Set(meshes.flatMap((mesh) => mesh.materials.map((m) => m.colour))),
    materialNames = new Set(meshes.flatMap((mesh) => mesh.materials.map((m) => m.name)));
  const height: unknown = object.userData['height'];
  const hash = createHash('sha256').update(JSON.stringify({ height, meshes })).digest('hex');
  const dispose = () => {
    disposeWorldNode(object);
    geometry.dispose();
    materials.dispose();
  };
  return { object, meshes, colours, materialNames, hash, dispose };
}
