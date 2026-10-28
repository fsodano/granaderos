import { validateMapDocument, MAP_SCHEMA_VERSION } from '../campaign-format/map-schema.js';
export { MAP_SCHEMA_VERSION } from '../campaign-format/map-schema.js';
import { validateTacticalSpace } from './tactical-space.js';
import { wallEdgeKey, wallEdgeCells, migrateWallGeometry } from './wall-geometry.js';
import { BUILDING_TYPES } from './building-types.js';
import { STRUCTURE_BLAST, validateStructureDamage } from './structure-blast.js';
import { validateEnvironment } from './environment-interactions.js';
import { FURNITURE, LAYERS, cellKey, ground } from './map-catalog.js';
import { compileBuilding, compileMap, reachableMap } from './compile-map.js';
import { propPlacementError, propBlocksAt } from './props.js';
const placementMessages = {
  'Invalid furniture footprint.': 'Dimensiones de mobiliario no válidas.',
  'Duplicate furniture ID.': 'El mueble ya existe.',
  'Furniture overlaps an obstacle or another object.':
    'El mueble se superpone a un obstáculo u otro objeto.',
  'Unknown room.': 'La habitación no existe.',
  'Furniture must fit inside its room.': 'El mueble debe caber dentro de una habitación.',
  'Furniture leaves no walking space.': 'El mueble no deja espacio para caminar.',
  'Furniture blocks a door approach.': 'El mueble bloquea el acceso a una puerta.',
  'Furniture separates the walking space.': 'El mueble corta la ruta por la habitación.',
  'Furniture has no accessible side.': 'El mueble no tiene un lado accesible.',
};
const location = (e) => `${e.name ?? FURNITURE[e.type]?.name ?? 'Objeto'} (${e.x}, ${e.y})`;

export function blankMap({
  id = 'new-sector',
  title = 'Nuevo sector',
  width = 20,
  height = 16,
} = {}) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 4 ||
    height < 4 ||
    width > 64 ||
    height > 64
  )
    throw Error('Dimensiones no válidas.');
  return {
    schemaVersion: MAP_SCHEMA_VERSION,
    id,
    revision: 0,
    width,
    height,
    metadata: { title },
    wallEdges: [],
    terrain: Array.from({ length: width * height }, (_, i) =>
      ground(i % width, Math.floor(i / width)),
    ),
    ...Object.fromEntries(LAYERS.map((k) => [k, []])),
  };
}
export function validateMap(input, { playable = false } = {}) {
  const { errors, warnings } = validateMapDocument(input);
  if (errors.length) return { errors, warnings, valid: false };
  try {
    const d = input;
    const need = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const wallMetadata = (wall, runtime = false) => {
      need(
        wall.material === undefined || Object.hasOwn(STRUCTURE_BLAST.materials, wall.material),
        'Material de pared no válido.',
      );
      validateStructureDamage(wall);
      if (wall.type === 'door' && runtime) validateEnvironment(wall);
    };
    for (const tile of d.terrain)
      if (['wall', 'door', 'window'].includes(tile.type)) wallMetadata(tile);
    for (const wall of d.wallEdges ?? []) wallMetadata(wall, true);
    for (const building of d.buildings) {
      need(
        building.architecture === undefined || Object.hasOwn(BUILDING_TYPES, building.architecture),
        'Edificio no válido.',
      );
      for (const wall of building.walls) wallMetadata(wall);
    }
    const occupied = new Set();
    for (const building of d.buildings)
      for (let y = building.y; y < building.y + building.height; y++)
        for (let x = building.x; x < building.x + building.width; x++) occupied.add(`${x},${y}`);
    const map = compileMap(d);
    validateTacticalSpace(map);
    const tiles = new Map(map.tiles.map((t) => [cellKey(t), t]));
    const featureKeys = new Set();
    for (const f of d.features) {
      need(
        !occupied.has(cellKey(f)) && !featureKeys.has(cellKey(f)),
        'Accidente superpuesto a un edificio u otro accidente.',
      );
      featureKeys.add(cellKey(f));
    }
    for (const p of map.props) {
      const reason = propPlacementError(
        { ...map, props: map.props.filter((v) => v.id !== p.id) },
        p,
      );
      if (reason) errors.push(`${location(p)}: ${placementMessages[reason] ?? reason}`);
    }
    const spawnKeys = new Set();
    for (const s of [...d.spawns, ...d.exits]) {
      if (tiles.get(cellKey(s)).blocked || propBlocksAt(map, s.x, s.y))
        errors.push(`${location(s)}: casilla bloqueada.`);
      if (d.spawns.includes(s)) {
        if (spawnKeys.has(cellKey(s))) errors.push(`${location(s)}: aparición superpuesta.`);
        spawnKeys.add(cellKey(s));
      }
    }
    for (const i of d.items)
      if (!i.containerId && (tiles.get(cellKey(i)).blocked || propBlocksAt(map, i.x, i.y)))
        errors.push(`${location(i)}: objeto en una casilla bloqueada.`);
    const starts = d.spawns.filter((s) => s.side === 'player');
    if (!starts.length)
      (playable ? errors : warnings).push(
        'Añade al menos una aparición del jugador para probar el mapa.',
      );
    const reachable = reachableMap(map, starts[0]);
    if (starts.length) {
      for (const e of [...d.spawns, ...d.exits])
        if (!reachable.has(cellKey(e)))
          errors.push(`${location(e)}: sin ruta desde la entrada del jugador.`);
    }
    for (const b of map.buildings)
      for (const room of b.rooms) {
        const doors = b.walls.filter(
          (w) =>
            w.type === 'door' &&
            room.cells.some((c) => wallEdgeCells(w).some((n) => cellKey(n) === cellKey(c))),
        );
        if (!doors.length)
          warnings.push(
            `${b.name ?? 'Edificio'}: habitación sin puerta (${room.cells[0].x}, ${room.cells[0].y}).`,
          );
        else if (starts.length && !room.cells.some((c) => reachable.has(cellKey(c))))
          warnings.push(
            `${b.name ?? 'Edificio'}: habitación aislada (${room.cells[0].x}, ${room.cells[0].y}).`,
          );
      }
    for (const b of d.buildings)
      for (const w of b.walls)
        if (w.locked)
          warnings.push(
            `${b.name ?? 'Edificio'}: puerta con llave (${w.x}, ${w.y}); la ruta se comprueba con puertas abiertas.`,
          );
  } catch (e) {
    errors.push(e.message);
  }
  return { errors, warnings, valid: errors.length === 0 };
}
export function parseMap(text) {
  const doc = JSON.parse(text);
  const result = validateMap(doc);
  if (!result.valid) throw Error(result.errors.join('\n'));
  return migrateMapDocument(doc);
}
export function serializeMap(doc) {
  const result = validateMap(doc);
  if (!result.valid) throw Error(result.errors.join('\n'));
  const copy = migrateMapDocument(doc);
  for (const layer of LAYERS) copy[layer].sort((a, b) => a.id.localeCompare(b.id));
  copy.terrain.sort((a, b) => a.y - b.y || a.x - b.x);
  copy.wallEdges.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(copy, null, 2) + '\n';
}

// Import old authored plans once. Runtime compilation always uses edge geometry.
export function migrateMapDocument(document) {
  const copy = structuredClone(document);
  const standalone = copy.terrain.filter((t) => ['wall', 'door', 'window'].includes(t.type));
  const converted = migrateWallGeometry({
    width: copy.width,
    height: copy.height,
    tiles: standalone,
    buildings: [],
  });
  copy.schemaVersion = MAP_SCHEMA_VERSION;
  copy.buildings = copy.buildings.map((building) => compileBuilding(building).building);
  const owned = new Set(copy.buildings.flatMap((b) => b.walls.map(wallEdgeKey)));
  // Legacy terrain under a footprint was hidden by the old building layer.
  // Preserve that precedence only for converted cells, never authored edges.
  copy.wallEdges = [
    ...(copy.wallEdges ?? []),
    ...converted.wallEdges.filter(
      (edge) =>
        !owned.has(wallEdgeKey(edge)) &&
        !copy.buildings.some((b) =>
          wallEdgeCells(edge).every(
            (c) => c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height,
          ),
        ),
    ),
  ];
  return copy;
}
