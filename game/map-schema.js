import {wallEdgeKey,wallEdgeCells,migrateWallGeometry} from './wall-geometry.js';
import {BUILDING_TYPES} from './building-types.js';
import {validateCoverMetadata} from './projectile-cover.js';
import {STRUCTURE_BLAST,validateStructureDamage} from './structure-blast.js';
import {validateEnvironment} from './environment-interactions.js';
import { WALL_FINISHES, ROOF_FINISHES, DOOR_STYLES, WINDOW_STYLES } from "./building-appearance.js";
import {
  TERRAIN,
  BUILDING_KINDS,
  FEATURES,
  FURNITURE,
  ITEM_TYPES,
  LAYERS,
  cellKey,
  ground,
  neighbours,
} from "./map-catalog.js";
import { compileBuilding, compileMap, reachableMap } from "./compile-map.js";
import { propCells, propPlacementError, propBlocksAt } from "./props.js";
export const MAP_SCHEMA_VERSION = 2;
const placementMessages = {
  "Invalid furniture footprint.": "Dimensiones de mobiliario no válidas.",
  "Duplicate furniture ID.": "El mueble ya existe.",
  "Furniture overlaps an obstacle or another object.":
    "El mueble se superpone a un obstáculo u otro objeto.",
  "Unknown room.": "La habitación no existe.",
  "Furniture must fit inside its room.": "El mueble debe caber dentro de una habitación.",
  "Furniture leaves no walking space.": "El mueble no deja espacio para caminar.",
  "Furniture blocks a door approach.": "El mueble bloquea el acceso a una puerta.",
  "Furniture separates the walking space.": "El mueble corta la ruta por la habitación.",
  "Furniture has no accessible side.": "El mueble no tiene un lado accesible.",
};
const location = (e) => `${e.name ?? FURNITURE[e.type]?.name ?? "Objeto"} (${e.x}, ${e.y})`;

export function blankMap({
  id = "new-sector",
  title = "Nuevo sector",
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
    throw Error("Dimensiones no válidas.");
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
const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => typeof v === "string" && v.length > 0 && v.length <= 200;
function guard(v, depth = 0) {
  if (depth > 15) throw Error("Documento demasiado anidado.");
  if (typeof v === "number" && !Number.isFinite(v)) throw Error("Número no válido.");
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k)) throw Error("Clave no permitida.");
      guard(x, depth + 1);
    }
}
export function validateMap(input, { playable = false } = {}) {
  const errors = [],
    warnings = [];
  try {
    if (!obj(input) || JSON.stringify(input).length > 3000000)
      throw Error("Documento no válido o demasiado grande.");
    guard(input);
    const d = input,
      need = (ok, message) => {
        if (!ok) throw Error(message);
      };
    const wallMetadata = (wall, {runtime = false} = {}) => {
      // Map authoring describes ground floors; upper geometry is a separate
      // runtime layer. A displaced edge must never silently miss that floor.
      need((wall.tacticalLevel === undefined || wall.tacticalLevel === 0) &&
        (wall.elevation === undefined || wall.elevation === 0), "La pared debe estar al nivel del suelo.");
      for (const field of ["blocked", "blocksSight", "open", "locked"])
        need(wall[field] === undefined || typeof wall[field] === "boolean", "Estado de pared no válido.");
      need(wall.cover === undefined || Number.isFinite(wall.cover) && wall.cover >= 0 && wall.cover <= 100, "Cobertura de pared no válida.");
      need(wall.material === undefined || typeof wall.material === "string" && Object.hasOwn(STRUCTURE_BLAST.materials, wall.material), "Material de pared no válido.");
      validateCoverMetadata(wall);
      validateStructureDamage(wall);
      if (wall.type === "door") {
        // Building compilation derives these two flags from the door state.
        // Freestanding edges are already runtime records and retain them.
        if (runtime) {
          validateEnvironment(wall);
          need((wall.blocked === undefined || wall.blocked === !wall.open) &&
            (wall.blocksSight === undefined || wall.blocksSight === !wall.open), "Paso de puerta exterior no válido.");
        }
      }
    };
    need([1, MAP_SCHEMA_VERSION].includes(d.schemaVersion), "Versión de mapa no compatible.");
    need(
      str(d.id) && Number.isSafeInteger(d.revision) && d.revision >= 0,
      "Identidad o revisión no válida.",
    );
    need(
      Number.isInteger(d.width) &&
        Number.isInteger(d.height) &&
        d.width >= 4 &&
        d.height >= 4 &&
        d.width <= 64 &&
        d.height <= 64,
      "Las dimensiones deben estar entre 4 y 64.",
    );
    need(obj(d.metadata) && str(d.metadata.title), "Falta el nombre del sector.");
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
      "Faltan casillas de terreno.",
    );
    const keys = new Set();
    for (const t of d.terrain) {
      need(
        coord(t) &&
          !keys.has(cellKey(t)) &&
          typeof t.blocked === "boolean" &&
          Number.isFinite(t.cover) &&
          t.cover >= 0 &&
          t.cover <= 100 &&
          [...Object.keys(TERRAIN), "floor", "rubble", "cliff", ...(d.schemaVersion===1?["wall","door","window"]:[])].includes(
            t.type,
          ),
        "Terreno no válido o duplicado.",
      );
      for (const field of ["blocksSight", "locked", "open"])
        if (t[field] !== undefined)
          need(typeof t[field] === "boolean", "Propiedad de terreno no válida.");
      need(
        t.buildingId == null && t.roomId == null,
        "La estructura debe estar en la capa de edificios.",
      );
      if (["wall", "door", "window"].includes(t.type)) wallMetadata(t);
      keys.add(cellKey(t));
    }
    if (d.boundaryRoads !== undefined) {
      need(Array.isArray(d.boundaryRoads) && d.boundaryRoads.length <= 2*(d.width+d.height), "Accesos del camino no válidos.");
      const roads = new Set();
      for (const entry of d.boundaryRoads) {
        need(coord(entry) && (entry.x===0 || entry.x===d.width-1 || entry.y===0 || entry.y===d.height-1) && !roads.has(cellKey(entry)), "Acceso del camino fuera del borde o duplicado.");
        roads.add(cellKey(entry));
      }
    }
    const edgeCoord = (p) => obj(p) && Number.isInteger(p.x) && Number.isInteger(p.y) &&
      ((p.axis === "x" && p.x >= 0 && p.x < d.width && p.y >= 0 && p.y <= d.height) ||
       (p.axis === "y" && p.x >= 0 && p.x <= d.width && p.y >= 0 && p.y < d.height));
    const ids = new Set(), globalWallKeys = new Set();
    if(d.wallEdges!==undefined){
      need(Array.isArray(d.wallEdges)&&d.wallEdges.length<=2*d.width*d.height+d.width+d.height,"Bordes de pared no válidos.");
      for(const wall of d.wallEdges){
        need(edgeCoord(wall)&&str(wall.id)&&!ids.has(wall.id)&&!globalWallKeys.has(wallEdgeKey(wall))&&["wall","door","window"].includes(wall.type)&&wall.buildingId==null,"Pared exterior no válida o duplicada.");
        wallMetadata(wall, {runtime:true});
        ids.add(wall.id);globalWallKeys.add(wallEdgeKey(wall));
        if(wall.type==="door"){
          need(str(wall.doorId)&&(!ids.has(wall.doorId)||wall.doorId===wall.id)&&typeof wall.open==="boolean"&&typeof wall.locked==="boolean","Puerta exterior no válida.");
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
    for (const f of d.features) need(Boolean(FEATURES[f.type]), "Accidente del terreno no válido.");
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
          "Acabado de edificio no válido.",
        );
      need(
        Number.isInteger(b.width) &&
          Number.isInteger(b.height) &&
          b.width >= 3 &&
          b.height >= 3 &&
          b.x + b.width <= d.width &&
          b.y + b.height <= d.height &&
          ["adobe", "stone"].includes(b.material) &&
          ["tile", "thatch", "terrace"].includes(b.roof) &&
          (b.architecture === undefined || Object.hasOwn(BUILDING_TYPES,b.architecture)) &&
          (b.kind === undefined || Object.hasOwn(BUILDING_KINDS, b.kind)) &&
          Array.isArray(b.walls) &&
          Array.isArray(b.rooms),
        "Edificio no válido.",
      );
      for (let y = b.y; y < b.y + b.height; y++)
        for (let x = b.x; x < b.x + b.width; x++) {
          need(!occupied.has(`${x},${y}`), "Los edificios se superponen.");
          occupied.add(`${x},${y}`);
        }
      need(!(d.wallEdges??[]).some(edge=>wallEdgeCells(edge).every(c=>c.x>=b.x&&c.x<b.x+b.width&&c.y>=b.y&&c.y<b.y+b.height)), "Las paredes interiores deben estar en el edificio.");
      const wallKeys = new Set();
      for (const w of b.walls) {
        wallMetadata(w);
        const edge = w.axis !== undefined;
        need(
          (edge ? edgeCoord(w) &&
            w.x >= b.x && w.x <= b.x + b.width &&
            w.y >= b.y && w.y <= b.y + b.height &&
            (w.axis !== "x" || w.x < b.x + b.width) &&
            (w.axis !== "y" || w.y < b.y + b.height)
            : d.schemaVersion === 1 && coord(w) &&
              w.x >= b.x && w.x < b.x + b.width &&
              w.y >= b.y && w.y < b.y + b.height) &&
            !wallKeys.has(edge ? wallEdgeKey(w) : cellKey(w)) &&
            ["wall", "door", "window"].includes(w.type),
          "Pared o abertura no válida.",
        );
        if (edge) {
          need(str(w.id) && !ids.has(w.id) && !globalWallKeys.has(wallEdgeKey(w)), "Borde de pared o ID duplicado.");
          ids.add(w.id); globalWallKeys.add(wallEdgeKey(w));
        }
        need(
          w.style === undefined ||
            (w.type === "door" && Object.hasOwn(DOOR_STYLES, w.style)) ||
            (w.type === "window" && Object.hasOwn(WINDOW_STYLES, w.style)),
          "Estilo de abertura no válido.",
        );
        wallKeys.add(edge ? wallEdgeKey(w) : cellKey(w));
        if (w.type === "door")
          need(
            str(w.doorId) &&
              (!ids.has(w.doorId) || w.doorId === w.id) &&
              typeof w.open === "boolean" &&
              typeof w.locked === "boolean",
            "Puerta no válida.",
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
          "Habitación no válida.",
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
          typeof p.blocksMovement === "boolean",
        "Mueble no válido.",
      );
      need(propCells(p).every(coord), "Mueble fuera del mapa.");
      if (p.rotation !== undefined)
        need([0, 90, 180, 270].includes(p.rotation), "Rotación no válida.");
    }
    for (const i of d.items)
      need(
        Boolean(ITEM_TYPES[i.type]) &&
          Number.isInteger(i.count) &&
          i.count > 0 &&
          i.count <= 100000 &&
          (i.containerId === undefined ||
            d.props.some(
              (p) => p.id === i.containerId && p.type === "chest" && p.x === i.x && p.y === i.y,
            )),
        "Objeto o contenedor no válido.",
      );
    for (const s of d.spawns)
      need(["player", "enemy", "civilian"].includes(s.side), "Punto de aparición no válido.");
    for (const l of d.lights)
      need(
        Number.isFinite(l.radius) &&
          l.radius > 0 &&
          l.radius <= 20 &&
          Number.isFinite(l.intensity) &&
          l.intensity >= 0 &&
          l.intensity <= 1,
        "Luz no válida.",
      );
    for (const e of d.exits) need(str(e.target), "Destino de salida no válido.");
    const map = compileMap(d),
      tiles = new Map(map.tiles.map((t) => [cellKey(t), t]));
    const featureKeys = new Set();
    for (const f of d.features) {
      need(
        !occupied.has(cellKey(f)) && !featureKeys.has(cellKey(f)),
        "Accidente superpuesto a un edificio u otro accidente.",
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
    const starts = d.spawns.filter((s) => s.side === "player");
    if (!starts.length)
      (playable ? errors : warnings).push(
        "Añade al menos una aparición del jugador para probar el mapa.",
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
            w.type === "door" &&
            room.cells.some((c) => wallEdgeCells(w).some((n) => cellKey(n) === cellKey(c))),
        );
        if (!doors.length)
          warnings.push(
            `${b.name ?? "Edificio"}: habitación sin puerta (${room.cells[0].x}, ${room.cells[0].y}).`,
          );
        else if (starts.length && !room.cells.some((c) => reachable.has(cellKey(c))))
          warnings.push(
            `${b.name ?? "Edificio"}: habitación aislada (${room.cells[0].x}, ${room.cells[0].y}).`,
          );
      }
    for (const b of d.buildings)
      for (const w of b.walls)
        if (w.locked)
          warnings.push(
            `${b.name ?? "Edificio"}: puerta con llave (${w.x}, ${w.y}); la ruta se comprueba con puertas abiertas.`,
          );
  } catch (e) {
    errors.push(e.message);
  }
  return { errors, warnings, valid: errors.length === 0 };
}
export function parseMap(text) {
  const doc = JSON.parse(text);
  const result = validateMap(doc);
  if (!result.valid) throw Error(result.errors.join("\n"));
  return migrateMapDocument(doc);
}
export function serializeMap(doc) {
  const result = validateMap(doc);
  if (!result.valid) throw Error(result.errors.join("\n"));
  const copy = migrateMapDocument(doc);
  for (const layer of LAYERS) copy[layer].sort((a, b) => a.id.localeCompare(b.id));
  copy.terrain.sort((a, b) => a.y - b.y || a.x - b.x);
  copy.wallEdges.sort((a,b)=>a.id.localeCompare(b.id));
  return JSON.stringify(copy, null, 2) + "\n";
}

// Import old authored plans once. Runtime compilation always uses edge geometry.
export function migrateMapDocument(document) {
  const copy = structuredClone(document);
  const standalone=copy.terrain.filter(t=>["wall","door","window"].includes(t.type));
  const converted=migrateWallGeometry({width:copy.width,height:copy.height,tiles:standalone,buildings:[]});
  copy.schemaVersion = MAP_SCHEMA_VERSION;
  copy.buildings = copy.buildings.map((building) => compileBuilding(building).building);
  const owned = new Set(copy.buildings.flatMap(b=>b.walls.map(wallEdgeKey)));
  // Legacy terrain under a footprint was hidden by the old building layer.
  // Preserve that precedence only for converted cells, never authored edges.
  copy.wallEdges=[...(copy.wallEdges??[]),...converted.wallEdges.filter(edge=>!owned.has(wallEdgeKey(edge)) && !copy.buildings.some(b=>wallEdgeCells(edge).every(c=>c.x>=b.x&&c.x<b.x+b.width&&c.y>=b.y&&c.y<b.y+b.height)))];
  return copy;
}
