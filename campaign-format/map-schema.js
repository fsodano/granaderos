import { validateEnvironmentRecord } from './environment-record-schema.js';
import { validateTacticalSpaceRecords } from './tactical-space-schema.js';
import { wallEdgeKey, wallEdgeCells, propCells } from './map-coordinates.js';
import { validateCoverMetadata } from './cover-metadata-schema.js';
import {
  WALL_FINISHES,
  ROOF_FINISHES,
  DOOR_STYLES,
  WINDOW_STYLES,
} from './building-appearance-schema.js';
import {
  TERRAIN,
  BUILDING_KINDS,
  FEATURES,
  FURNITURE,
  ITEM_TYPES,
  LAYERS,
  cellKey,
} from './map-catalog.js';
export const MAP_SCHEMA_VERSION = 2;
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
function guard(v, depth = 0) {
  if (depth > 15) throw Error('Documento demasiado anidado.');
  if (typeof v === 'number' && !Number.isFinite(v)) throw Error('Número no válido.');
  if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('Clave no permitida.');
      guard(x, depth + 1);
    }
}
export function validateMapDocument(input) {
  const errors = [],
    warnings = [];
  try {
    if (!obj(input) || JSON.stringify(input).length > 3000000)
      throw Error('Documento no válido o demasiado grande.');
    guard(input);
    const d = input,
      need = (ok, message) => {
        if (!ok) throw Error(message);
      };
    const wallMetadata = (wall, { runtime = false } = {}) => {
      // Authored wall edges belong to the ground floor. Upper floors and
      // platforms use upperSurfaces; a displaced edge cannot replace them.
      need(
        (wall.tacticalLevel === undefined || wall.tacticalLevel === 0) &&
          (wall.elevation === undefined || wall.elevation === 0),
        'La pared debe estar al nivel del suelo.',
      );
      for (const field of ['blocked', 'blocksSight', 'open', 'locked'])
        need(
          wall[field] === undefined || typeof wall[field] === 'boolean',
          'Estado de pared no válido.',
        );
      need(
        wall.cover === undefined ||
          (Number.isFinite(wall.cover) && wall.cover >= 0 && wall.cover <= 100),
        'Cobertura de pared no válida.',
      );
      need(
        wall.material === undefined ||
          (typeof wall.material === 'string' && wall.material.length > 0),
        'Material de pared no válido.',
      );
      validateCoverMetadata(wall);
      if (wall.type === 'door') {
        // Building compilation derives these two flags from the door state.
        // Freestanding edges are already runtime records and retain them.
        if (runtime) {
          validateEnvironmentRecord(wall);
          need(
            (wall.blocked === undefined || wall.blocked === !wall.open) &&
              (wall.blocksSight === undefined || wall.blocksSight === !wall.open),
            'Paso de puerta exterior no válido.',
          );
        }
      }
    };
    need([1, MAP_SCHEMA_VERSION].includes(d.schemaVersion), 'Versión de mapa no compatible.');
    need(
      str(d.id) && Number.isSafeInteger(d.revision) && d.revision >= 0,
      'Identidad o revisión no válida.',
    );
    need(
      Number.isInteger(d.width) &&
        Number.isInteger(d.height) &&
        d.width >= 4 &&
        d.height >= 4 &&
        d.width <= 64 &&
        d.height <= 64,
      'Las dimensiones deben estar entre 4 y 64.',
    );
    need(obj(d.metadata) && str(d.metadata.title), 'Falta el nombre del sector.');
    const coord = (p) =>
      obj(p) &&
      Number.isInteger(p.x) &&
      Number.isInteger(p.y) &&
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < d.width &&
      p.y < d.height;
    need(
      Array.isArray(d.terrain) && d.terrain.length === d.width * d.height,
      'Faltan casillas de terreno.',
    );
    const keys = new Set();
    for (const t of d.terrain) {
      need(
        coord(t) &&
          !keys.has(cellKey(t)) &&
          typeof t.blocked === 'boolean' &&
          Number.isFinite(t.cover) &&
          t.cover >= 0 &&
          t.cover <= 100 &&
          [
            ...Object.keys(TERRAIN),
            'floor',
            'rubble',
            'cliff',
            ...(d.schemaVersion === 1 ? ['wall', 'door', 'window'] : []),
          ].includes(t.type),
        'Terreno no válido o duplicado.',
      );
      for (const field of ['blocksSight', 'locked', 'open'])
        if (t[field] !== undefined)
          need(typeof t[field] === 'boolean', 'Propiedad de terreno no válida.');
      need(
        t.buildingId == null && t.roomId == null,
        'La estructura debe estar en la capa de edificios.',
      );
      if (['wall', 'door', 'window'].includes(t.type)) wallMetadata(t);
      keys.add(cellKey(t));
    }
    if (d.boundaryRoads !== undefined) {
      need(
        Array.isArray(d.boundaryRoads) && d.boundaryRoads.length <= 2 * (d.width + d.height),
        'Accesos del camino no válidos.',
      );
      const roads = new Set();
      for (const entry of d.boundaryRoads) {
        need(
          coord(entry) &&
            (entry.x === 0 ||
              entry.x === d.width - 1 ||
              entry.y === 0 ||
              entry.y === d.height - 1) &&
            !roads.has(cellKey(entry)),
          'Acceso del camino fuera del borde o duplicado.',
        );
        roads.add(cellKey(entry));
      }
    }
    const edgeCoord = (p) =>
      obj(p) &&
      Number.isInteger(p.x) &&
      Number.isInteger(p.y) &&
      ((p.axis === 'x' && p.x >= 0 && p.x < d.width && p.y >= 0 && p.y <= d.height) ||
        (p.axis === 'y' && p.x >= 0 && p.x <= d.width && p.y >= 0 && p.y < d.height));
    const ids = new Set(),
      globalWallKeys = new Set();
    if (d.wallEdges !== undefined) {
      need(
        Array.isArray(d.wallEdges) &&
          d.wallEdges.length <= 2 * d.width * d.height + d.width + d.height,
        'Bordes de pared no válidos.',
      );
      for (const wall of d.wallEdges) {
        need(
          edgeCoord(wall) &&
            str(wall.id) &&
            !ids.has(wall.id) &&
            !globalWallKeys.has(wallEdgeKey(wall)) &&
            ['wall', 'door', 'window'].includes(wall.type) &&
            wall.buildingId == null,
          'Pared exterior no válida o duplicada.',
        );
        wallMetadata(wall, { runtime: true });
        ids.add(wall.id);
        globalWallKeys.add(wallEdgeKey(wall));
        if (wall.type === 'door') {
          need(
            str(wall.doorId) &&
              (!ids.has(wall.doorId) || wall.doorId === wall.id) &&
              typeof wall.open === 'boolean' &&
              typeof wall.locked === 'boolean',
            'Puerta exterior no válida.',
          );
          ids.add(wall.doorId);
        }
      }
    }

    for (const layer of LAYERS) {
      need(Array.isArray(d[layer]) && d[layer].length <= 2000, `Capa no válida: ${layer}`);
      for (const e of d[layer]) {
        need(coord(e) && str(e.id) && !ids.has(e.id), `Objeto no válido o ID duplicado: ${layer}`);
        ids.add(e.id);
      }
    }
    for (const f of d.features) need(Boolean(FEATURES[f.type]), 'Accidente del terreno no válido.');
    const occupied = new Set(),
      roomIds = new Set();
    for (const b of d.buildings) {
      for (const [key, catalog] of Object.entries({
        wallFinish: WALL_FINISHES,
        roofFinish: ROOF_FINISHES,
        doorStyle: DOOR_STYLES,
        windowStyle: WINDOW_STYLES,
      }))
        need(
          b[key] === undefined || Object.hasOwn(catalog, b[key]),
          'Acabado de edificio no válido.',
        );
      need(
        Number.isInteger(b.width) &&
          Number.isInteger(b.height) &&
          b.width >= 3 &&
          b.height >= 3 &&
          b.x + b.width <= d.width &&
          b.y + b.height <= d.height &&
          ['adobe', 'stone'].includes(b.material) &&
          ['tile', 'thatch', 'terrace'].includes(b.roof) &&
          (b.architecture === undefined || str(b.architecture)) &&
          (b.kind === undefined || Object.hasOwn(BUILDING_KINDS, b.kind)) &&
          Array.isArray(b.walls) &&
          Array.isArray(b.rooms),
        'Edificio no válido.',
      );
      for (let y = b.y; y < b.y + b.height; y++)
        for (let x = b.x; x < b.x + b.width; x++) {
          need(!occupied.has(`${x},${y}`), 'Los edificios se superponen.');
          occupied.add(`${x},${y}`);
        }
      need(
        !(d.wallEdges ?? []).some((edge) =>
          wallEdgeCells(edge).every(
            (c) => c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height,
          ),
        ),
        'Las paredes interiores deben estar en el edificio.',
      );
      const wallKeys = new Set();
      for (const w of b.walls) {
        wallMetadata(w);
        const edge = w.axis !== undefined;
        need(
          (edge
            ? edgeCoord(w) &&
              w.x >= b.x &&
              w.x <= b.x + b.width &&
              w.y >= b.y &&
              w.y <= b.y + b.height &&
              (w.axis !== 'x' || w.x < b.x + b.width) &&
              (w.axis !== 'y' || w.y < b.y + b.height)
            : d.schemaVersion === 1 &&
              coord(w) &&
              w.x >= b.x &&
              w.x < b.x + b.width &&
              w.y >= b.y &&
              w.y < b.y + b.height) &&
            !wallKeys.has(edge ? wallEdgeKey(w) : cellKey(w)) &&
            ['wall', 'door', 'window'].includes(w.type),
          'Pared o abertura no válida.',
        );
        if (edge) {
          need(
            str(w.id) && !ids.has(w.id) && !globalWallKeys.has(wallEdgeKey(w)),
            'Borde de pared o ID duplicado.',
          );
          ids.add(w.id);
          globalWallKeys.add(wallEdgeKey(w));
        }
        need(
          w.style === undefined ||
            (w.type === 'door' && Object.hasOwn(DOOR_STYLES, w.style)) ||
            (w.type === 'window' && Object.hasOwn(WINDOW_STYLES, w.style)),
          'Estilo de abertura no válido.',
        );
        wallKeys.add(edge ? wallEdgeKey(w) : cellKey(w));
        if (w.type === 'door')
          need(
            str(w.doorId) &&
              (!ids.has(w.doorId) || w.doorId === w.id) &&
              typeof w.open === 'boolean' &&
              typeof w.locked === 'boolean',
            'Puerta no válida.',
          );
        if (w.doorId) ids.add(w.doorId);
      }
      for (const r of b.rooms) {
        need(
          str(r.id) &&
            !roomIds.has(r.id) &&
            !ids.has(r.id) &&
            Array.isArray(r.cells) &&
            r.cells.every(coord),
          'Habitación no válida.',
        );
        roomIds.add(r.id);
        ids.add(r.id);
      }
    }
    for (const p of d.props) {
      need(
        Boolean(FURNITURE[p.type]) &&
          obj(p.footprint) &&
          Number.isInteger(p.footprint.width) &&
          Number.isInteger(p.footprint.height) &&
          p.footprint.width >= 1 &&
          p.footprint.width <= 8 &&
          p.footprint.height >= 1 &&
          p.footprint.height <= 8 &&
          typeof p.blocksMovement === 'boolean',
        'Mueble no válido.',
      );
      need(propCells(p).every(coord), 'Mueble fuera del mapa.');
      if (p.rotation !== undefined)
        need([0, 90, 180, 270].includes(p.rotation), 'Rotación no válida.');
    }
    for (const i of d.items)
      need(
        Boolean(ITEM_TYPES[i.type]) &&
          Number.isInteger(i.count) &&
          i.count > 0 &&
          i.count <= 100000 &&
          (i.containerId === undefined ||
            d.props.some(
              (p) => p.id === i.containerId && p.type === 'chest' && p.x === i.x && p.y === i.y,
            )),
        'Objeto o contenedor no válido.',
      );
    for (const s of d.spawns)
      need(['player', 'enemy', 'civilian'].includes(s.side), 'Punto de aparición no válido.');
    for (const l of d.lights)
      need(
        Number.isFinite(l.radius) &&
          l.radius > 0 &&
          l.radius <= 20 &&
          Number.isFinite(l.intensity) &&
          l.intensity >= 0 &&
          l.intensity <= 1,
        'Luz no válida.',
      );
    for (const e of d.exits) need(str(e.target), 'Destino de salida no válido.');
    validateTacticalSpaceRecords({ ...d, tiles: d.terrain });
  } catch (error) {
    errors.push(error.message);
  }
  return { errors, warnings, valid: errors.length === 0 };
}
