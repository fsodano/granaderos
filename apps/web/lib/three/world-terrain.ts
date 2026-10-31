import { Quaternion, Vector3 } from 'three';
import { terrainMaterial } from '../../../../packages/game/regional-terrain.js';
import { WorldBatch, cellTop, seeded } from './world-geometry';
import { illuminationAt, worldKey } from './world-materials';
import { climbOpenings, surfaceRectangles } from './world-climb-openings';
import { soilGrassTop } from './world-terrain-boundaries';
import { soilFragments } from './world-soil-fragments';
import { dryWeeds } from './world-dry-weeds';
import { ROCK_FORM_COUNT } from './world-rock-forms';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldInput, WorldTile } from './world-types';

export const WORLD_CHUNK_CELLS = 8;
export const chunkKey = (point: { x: number; y: number }) =>
  `${Math.floor(point.x / WORLD_CHUNK_CELLS)},${Math.floor(point.y / WORLD_CHUNK_CELLS)}`;
export function terrainChunks(tiles: readonly WorldTile[]) {
  const chunks = new Map<string, WorldTile[]>();
  for (const tile of tiles) {
    const key = chunkKey(tile),
      list = chunks.get(key) ?? [];
    list.push(tile);
    chunks.set(key, list);
  }
  return chunks;
}
export function buildTerrainChunk(
  id: string,
  tiles: readonly WorldTile[],
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    all = new Map(input.terrain.tiles.map((tile) => [worldKey(tile), tile] as const)),
    sceneId = input.terrain.sceneId ?? input.terrain.sectorId,
    context =
      input.terrain.landscape && sceneId
        ? { world: { landscapes: { [sceneId]: input.terrain.landscape } } }
        : undefined;
  for (const tile of tiles) {
    const x = tile.x * T,
      z = tile.y * T,
      height = tile.elevation ?? 0,
      light = illuminationAt(input, tile);
    const kind = tile.type === 'rubble' ? 'dirt' : terrainMaterial(tile, sceneId, context);
    const material = tile.type === 'water' ? materials.get('water') : materials.terrain(kind);
    if (!soilGrassTop(batch, tile, all, sceneId, T, materials, light, context)) {
      cellTop(batch, material, x - T * 0.5, z - T * 0.5, x + T * 0.5, z + T * 0.5, height, light);
    }
    soilFragments(batch, tile, kind, T, materials, light);
    dryWeeds(batch, tile, kind, T, materials, light);
    // Exact authored cell heights remain flat. Vertical skirts join unequal
    // neighbours without changing the grid or inventing slope movement.
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const neighbour = all.get(`0:${tile.x + dx},${tile.y + dy}`),
        bottom = neighbour?.elevation ?? height - 0.2;
      if (bottom >= height) {
        continue;
      }
      const a = dx
        ? new Vector3(x + dx * T * 0.5, height, z - T * 0.5)
        : new Vector3(x - T * 0.5, height, z + dy * T * 0.5);
      const b = dx
        ? new Vector3(x + dx * T * 0.5, height, z + T * 0.5)
        : new Vector3(x + T * 0.5, height, z + dy * T * 0.5);
      if (dx < 0 || dy > 0) {
        const swap = a.clone();
        a.copy(b);
        b.copy(swap);
      }
      batch.polygon(
        material,
        [a, b, new Vector3(b.x, bottom, b.z), new Vector3(a.x, bottom, a.z)],
        light,
      );
    }
    const rock =
      (tile.blocked && !['wall', 'door', 'window', 'water'].includes(tile.type)) ||
      (tile.type === 'stone' && tile.material === 'stone' && !tile.buildingId);
    if (rock) {
      const seed = seeded(tile.x, tile.y),
        scale = tile.blocked ? 0.65 : 0.24,
        h = tile.obstacleHeight ?? (tile.blocked ? 1.05 : 0.22);
      const form = Math.floor(seeded(tile.x, tile.y, 1201) * ROCK_FORM_COUNT) % ROCK_FORM_COUNT,
        companion = (form + 1 + Math.floor(seeded(tile.y, tile.x, 1223) * 2)) % ROCK_FORM_COUNT;
      batch.primitive(
        `rock-form-${form}`,
        materials.get('stone'),
        [x + 0.1, height + h * 0.42, z],
        [scale, h * 0.56, scale * 0.75],
        undefined,
        light,
      );
      batch.primitive(
        `rock-form-${companion}`,
        materials.get('stone'),
        [x - 0.22, height + h * 0.23, z + 0.17],
        [scale * 0.6, h * 0.35, scale * 0.6],
        undefined,
        light * (0.91 + seed * 0.09),
      );
    }
    if (tile.type === 'rubble') {
      for (let n = 0; n < 7; n++) {
        const a = seeded(tile.x, tile.y, n * 7),
          b = seeded(tile.y, tile.x, n * 11),
          r = 0.08 + a * 0.13;
        batch.primitive(
          'rock',
          materials.get(tile.material === 'wood' ? 'wood' : 'rubble'),
          [x + (a - 0.5) * T * 0.8, height + r * 0.38, z + (b - 0.5) * T * 0.8],
          [r, r * 0.7, r * 0.85],
          undefined,
          light,
        );
      }
    }
    if (['grass', 'scrub', 'forest'].includes(tile.type) && !tile.buildingId) {
      const seed = seeded(tile.x, tile.y),
        count = tile.type === 'scrub' ? 5 : 2;
      for (let n = 0; n < count; n++) {
        const a = seeded(tile.x, tile.y, n + 41),
          b = seeded(tile.y, tile.x, n + 103),
          root = new Vector3(x + (a - 0.5) * T * 0.85, height, z + (b - 0.5) * T * 0.85);
        const tuftHeight = 0.25 * (0.8 + seeded(tile.x, tile.y, n + 151) * 0.4),
          rotation = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            seeded(tile.y, tile.x, n + 173) * Math.PI * 2,
          );
        batch.primitive(
          'grass-tuft',
          materials.get('grass'),
          root,
          [tuftHeight, tuftHeight, tuftHeight],
          rotation,
          light * (0.8 + seed * 0.2),
        );
      }
    }
  }
  const group = batch.finish(`terrain:${id}`);
  group.userData['kind'] = 'terrain';
  group.userData['chunk'] = id;
  return group;
}
export function buildUpperSurfaces(
  surfaces: readonly WorldTile[],
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    openings = climbOpenings(input, T);
  for (const surface of surfaces) {
    const height = surface.elevation ?? 0,
      thickness = surface.slabThickness ?? 0.2,
      light = illuminationAt(input, surface),
      x = surface.x * T,
      z = surface.y * T;
    const finish =
        surface.material === 'wood' ? 'wood' : surface.kind === 'roof' ? 'roof' : 'floor',
      material = materials.get(`upper-${finish}`, {
        colour: '#ffffff',
        texture: `/art/terrain-${finish}-v1.webp`,
      });
    // Wall tops share this exact metric height. A depth offset removes flicker
    // without lifting the walking surface or changing the shared coordinates.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    for (const part of surfaceRectangles(surface, T, openings)) {
      batch.box(
        material,
        (part.minX + part.maxX) * 0.5,
        height - thickness * 0.5,
        (part.minZ + part.maxZ) * 0.5,
        part.maxX - part.minX,
        thickness,
        part.maxZ - part.minZ,
        light,
      );
    }
    if (surface.blocked) {
      const h = surface.obstacleHeight ?? 0.45;
      if (h > 0) {
        batch.box(
          materials.get(surface.material === 'wood' ? 'wood' : 'stone'),
          x,
          height + h * 0.5,
          z,
          T * 0.86,
          h,
          T * 0.86,
          light,
        );
      }
    }
  }
  const group = batch.finish('upper-surfaces');
  group.userData['kind'] = 'upper-surfaces';
  group.userData['surfaceIds'] = surfaces.map((surface) => surface.id);
  return group;
}
