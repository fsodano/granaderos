import {wallEdgeKey} from './wall-geometry.js';
import { LAYERS, ground, cellKey, FURNITURE, TERRAIN } from "./map-catalog.js";
import { compileBuilding } from "./compile-map.js";
import { validateMap, migrateMapDocument } from "./map-schema.js";
import { BUILDING_TYPES } from "./building-types.js";
import { buildBuilding } from "./buildings.js";
export function makeBuilding({
  id,
  x,
  y,
  width = 5,
  height = 5,
  name = "Casa",
  material = "adobe",
  kind,
  architecture,
  roof,
  wallFinish,
  roofFinish,
  doorStyle,
  windowStyle,
}) {
  if (
    ![x, y, width, height].every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    width < 3 ||
    height < 3 ||
    width > 64 ||
    height > 64
  )
    throw Error("Dimensiones de edificio no válidas.");
  const { building, tiles } = buildBuilding({
    id,
    x,
    y,
    width,
    height,
    name,
    material,
    architecture,
    roof: roof ?? (architecture ? undefined : "tile"),
    doors: [{ x: x + Math.floor(width / 2), y: y + height - 1 }],
  });
  // A template without an architecture uses its authored kind and profile.
  // Do not let the gameplay helper's default house override that choice.
  if (architecture === undefined) delete building.architecture;
  return {
    ...building,
    ...Object.fromEntries(
      Object.entries({ kind, wallFinish, roofFinish, doorStyle, windowStyle }).filter(
        ([, value]) => value !== undefined,
      ),
    ),
    walls: building.walls,
  };
}
function commandEdge(building,command) {
  const {x,y,axis} = command;
  if(axis!==undefined)return {x,y,axis};
  const existing = building.walls.filter(w=>w.x===x&&w.y===y);
  if(existing.length===1)return {x,y,axis:existing[0].axis};
  if(y===building.y+building.height-1)return {x,y:y+1,axis:"x"};
  if(y===building.y)return {x,y,axis:"x"};
  if(x===building.x)return {x,y,axis:"y"};
  if(x===building.x+building.width-1)return {x:x+1,y,axis:"y"};
  const horizontal=building.walls.some(w=>w.axis==="x"&&w.y===y&&Math.abs(w.x-x)===1);
  return {x,y,axis:horizontal?"x":"y"};
}
function entity(doc, id) {
  for (const layer of LAYERS) {
    const index = doc[layer].findIndex((e) => e.id === id);
    if (index >= 0) return { layer, index, object: doc[layer][index] };
  }
  throw Error(`Objeto desconocido: ${id}`);
}
function children(doc, b) {
  return LAYERS.filter((l) => l !== "buildings")
    .flatMap((l) => doc[l])
    .filter((e) => e.x >= b.x && e.x < b.x + b.width && e.y >= b.y && e.y < b.y + b.height);
}
function transform(doc, id, { x, y, rotate = false }) {
  const { object: e, layer } = entity(doc, id),
    old = {
      x: e.x,
      y: e.y,
      width: e.width ?? e.footprint?.width ?? 1,
      height: e.height ?? e.footprint?.height ?? 1,
    };
  const inside = layer === "buildings" ? children(doc, e) : [];
  const point = (p) => {
    const dx = p.x - old.x,
      dy = p.y - old.y;
    return rotate
      ? { x: old.x + old.height - 1 - dy, y: old.y + dx }
      : { x: p.x + (x - old.x), y: p.y + (y - old.y) };
  };
  for (const child of inside) {
    const at = point(child);
    if (rotate && child.footprint) at.x -= child.footprint.height - 1;
    Object.assign(child, at);
    if (rotate && child.footprint) {
      [child.footprint.width, child.footprint.height] = [
        child.footprint.height,
        child.footprint.width,
      ];
      child.rotation = ((child.rotation ?? 0) + 90) % 360;
      if (!child.rotation) delete child.rotation;
    }
  }
  for (const item of doc.items.filter((i) => i.containerId)) {
    const container = doc.props.find((p) => p.id === item.containerId);
    if (container) {
      item.x = container.x;
      item.y = container.y;
    }
  }
  if (layer === "buildings") {
    e.walls = e.walls.map((w) => rotate
      ? {...w, x:old.x+old.height-(w.y-old.y)-(w.axis==="y"?1:0), y:old.y+w.x-old.x, axis:w.axis==="x"?"y":"x"}
      : {...w,...point(w)});
    e.rooms = e.rooms.map((r) => ({ ...r, cells: r.cells.map(point) }));
    if (rotate) [e.width, e.height] = [e.height, e.width];
    else {
      e.x = x;
      e.y = y;
    }
  } else {
    if (rotate && e.footprint) {
      [e.footprint.width, e.footprint.height] = [e.footprint.height, e.footprint.width];
      e.rotation = ((e.rotation ?? 0) + 90) % 360;
      if (!e.rotation) delete e.rotation;
    }
    if (!rotate) {
      const dx = x - e.x,
        dy = y - e.y;
      e.x = x;
      e.y = y;
      for (const i of doc.items.filter((i) => i.containerId === id)) {
        i.x += dx;
        i.y += dy;
      }
    }
  }
}
export function selectionRoots(doc, ids) {
  const selected = LAYERS.flatMap((layer) =>
    doc[layer].map((object) => ({ ...object, layer })),
  ).filter((e) => ids.includes(e.id));
  return selected.filter(
    (e) =>
      !selected.some(
        (parent) =>
          parent.id !== e.id &&
          (e.containerId === parent.id ||
            (parent.layer === "buildings" &&
              e.layer !== "buildings" &&
              e.x >= parent.x &&
              e.x < parent.x + parent.width &&
              e.y >= parent.y &&
              e.y < parent.y + parent.height)),
      ),
  );
}
export function applyMapCommands(
  original,
  commands,
  { expectedRevision = original.revision } = {},
) {
  if (expectedRevision !== original.revision)
    return {
      document: original,
      errors: ["La revisión cambió. Recarga antes de aplicar estos cambios."],
      warnings: [],
    };
  const doc = migrateMapDocument(original);
  try {
    if (!Array.isArray(commands) || commands.length > 10000)
      throw Error("Lote de comandos no válido.");
    for (const c of commands) {
      if (c.type === "transformSelection") {
        if (!Array.isArray(c.ids)) throw Error("Selección no válida.");
        const roots = selectionRoots(doc, c.ids);
        const left = Math.min(...roots.map((e) => e.x)),
          top = Math.min(...roots.map((e) => e.y));
        const height =
          Math.max(...roots.map((e) => e.y + (e.height ?? e.footprint?.height ?? 1))) - top;
        for (const e of roots) {
          if (c.rotate) {
            transform(doc, e.id, { rotate: true });
            transform(doc, e.id, {
              x: left + height - (e.y - top) - (e.height ?? e.footprint?.height ?? 1),
              y: top + e.x - left,
            });
          } else transform(doc, e.id, { x: e.x + (c.dx ?? 0), y: e.y + (c.dy ?? 0) });
        }
      } else if (c.type === "paintTerrain") {
        if (!Object.hasOwn(TERRAIN, c.terrain) || !Array.isArray(c.cells) || c.cells.length > 4096)
          throw Error("Pincel no válido.");
        for (const p of c.cells) {
          const index = doc.terrain.findIndex((t) => cellKey(t) === cellKey(p));
          if (index < 0) throw Error("Casilla fuera del mapa.");
          doc.terrain[index] = ground(p.x, p.y, c.terrain);
        }
      } else if (c.type === "addBuilding") {
        doc.buildings.push(makeBuilding(c.building));
      } else if (c.type === "addObject") {
        if (!LAYERS.includes(c.layer) || c.layer === "buildings") throw Error("Capa no válida.");
        const object = structuredClone(c.object);
        if (c.layer === "props") {
          const spec = FURNITURE[object.type];
          if (!spec) throw Error("Mueble desconocido.");
          object.footprint ??= { width: spec.width, height: spec.height };
          object.blocksMovement ??= true;
        }
        doc[c.layer].push(object);
      } else if (c.type === "moveObject") {
        transform(doc, c.id, c);
      } else if (c.type === "rotateObject") {
        transform(doc, c.id, { rotate: true });
      } else if (c.type === "deleteObject") {
        const { layer, index, object } = entity(doc, c.id);
        if (layer === "buildings") {
          const ids = new Set(children(doc, object).map((e) => e.id));
          for (const l of LAYERS)
            if (l !== "buildings") doc[l] = doc[l].filter((e) => !ids.has(e.id));
        }
        doc[layer].splice(index, 1);
        doc.items = doc.items.filter((i) => i.containerId !== c.id);
      } else if (c.type === "setObject") {
        const { object, layer } = entity(doc, c.id);
        if (
          ["id", "x", "y", "walls", "rooms", "width", "height", "footprint"].some(
            (k) => k in c.values,
          )
        )
          throw Error("Usa una operación geométrica para cambiar la posición o el tamaño.");
        if (layer === "buildings" && "kind" in c.values && !("architecture" in c.values)) {
          // A new editor type must not leave the former campaign silhouette.
          const previous = BUILDING_TYPES[object.architecture];
          if (previous) {
            const next = BUILDING_TYPES[c.values.kind];
            if (next) object.architecture = c.values.kind;
            else delete object.architecture;
            if (!("roof" in c.values) && object.roof === previous.roof)
              object.roof = next?.roof ?? "tile";
          }
        }
        Object.assign(object, structuredClone(c.values));
        if ("containerId" in c.values && object.containerId) {
          const container = entity(doc, object.containerId).object;
          object.x = container.x;
          object.y = container.y;
        }
        if (c.values.containerId === null) delete object.containerId;
      } else if (c.type === "setMetadata") {
        Object.assign(doc.metadata, c.values);
      } else if (c.type === "setDoor") {
        const door = doc.buildings.flatMap((b) => b.walls).find((w) => w.doorId === c.id);
        if (!door) throw Error("Puerta desconocida.");
        if (c.open !== undefined) door.open = c.open;
        if (c.locked !== undefined) door.locked = c.locked;
      } else if (c.type === "setOpeningStyle") {
        const { object: b } = entity(doc, c.buildingId);
        const at = commandEdge(b,c);
        const opening = b.walls?.find(w => wallEdgeKey(w) === wallEdgeKey(at) && ["door", "window"].includes(w.type));
        if (!opening) throw Error("Selecciona una puerta o ventana.");
        if (c.style === null) delete opening.style;
        else opening.style = c.style;
      } else if (c.type === "setWall") {
        const b = entity(doc, c.buildingId).object, at = commandEdge(b,c);
        if (!b.walls || !["x","y"].includes(at.axis) || at.x < b.x || at.x > b.x+b.width || at.y < b.y || at.y > b.y+b.height || (at.axis==="x" && at.x>=b.x+b.width) || (at.axis==="y" && at.y>=b.y+b.height))
          throw Error("La pared debe estar en un borde del edificio.");
        const previous = b.walls.find(w=>wallEdgeKey(w)===wallEdgeKey(at));
        if (["door", "window"].includes(c.wallType) && !previous)
          throw Error("Las aberturas deben ocupar una pared.");
        b.walls = b.walls.filter(w=>wallEdgeKey(w)!==wallEdgeKey(at));
        if (c.wallType !== "floor")
          b.walls.push({
            id: previous?.id ?? `${b.id}:wall:${at.axis}:${at.x}:${at.y}`,
            ...at,
            type: c.wallType,
            ...(c.style ? { style: c.style } : {}),
            ...(c.wallType === "door"
              ? { doorId: c.doorId ?? previous?.doorId ?? `${b.id}:door:${c.x}:${c.y}`, open: false, locked: false }
              : {}),
          });
      } else if (c.type === "resizeBuilding") {
        const { object: b } = entity(doc, c.id),
          fresh = makeBuilding({ ...b, width: c.width, height: c.height });
        for (const w of b.walls) {
          const perimeter = w.axis==="x" ? w.y===b.y || w.y===b.y+b.height : w.x===b.x || w.x===b.x+b.width;
          const at = {...w};
          if (w.axis==="x" && w.y===b.y+b.height) at.y=b.y+c.height;
          if (w.axis==="y" && w.x===b.x+b.width) at.x=b.x+c.width;
          const target = fresh.walls.find(v=>wallEdgeKey(v)===wallEdgeKey(at));
          if (perimeter && target && w.type!=="wall") Object.assign(target,at);
          else if (!perimeter && at.x>=b.x && at.x<b.x+c.width && at.y>=b.y && at.y<b.y+c.height) fresh.walls.push(at);
        }
        Object.assign(b, fresh, { rooms: b.rooms });
      } else if (c.type === "duplicateObject") {
        const { object, layer } = entity(doc, c.id),
          copy = structuredClone(object),
          oldId = copy.id;
        copy.id = c.newId;
        if (layer === "buildings") {
          copy.walls = copy.walls.map((w) => ({
            ...w,
            id: `${copy.id}:${w.id}`,
            ...(w.doorId ? { doorId: `${copy.id}:${w.doorId}` } : {}),
          }));
          copy.rooms = copy.rooms.map((r) => ({ ...r, id: `${copy.id}:${r.id}` }));
          const contents = children(doc, object).map((e) => ({
            layer: entity(doc, e.id).layer,
            object: structuredClone(e),
          }));
          const dx = c.x - object.x,
            dy = c.y - object.y;
          copy.x = c.x;
          copy.y = c.y;
          copy.walls = copy.walls.map((w) => ({ ...w, x: w.x + dx, y: w.y + dy }));
          copy.rooms = copy.rooms.map((r) => ({
            ...r,
            cells: r.cells.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          }));
          for (const entry of contents) {
            const e = entry.object;
            e.id = `${copy.id}:${e.id}`;
            e.x += dx;
            e.y += dy;
            if (e.containerId) e.containerId = `${copy.id}:${e.containerId}`;
            delete e.roomId;
            delete e.buildingId;
            doc[entry.layer].push(e);
          }
        } else {
          copy.x = c.x;
          copy.y = c.y;
          for (const i of doc.items.filter((i) => i.containerId === oldId))
            doc.items.push({
              ...i,
              id: `${copy.id}:${i.id}`,
              containerId: copy.id,
              x: c.x,
              y: c.y,
            });
        }
        doc[layer].push(copy);
      } else if (c.type === "stampTemplate") {
        const template = structuredClone(c.template);
        if (template.version !== 1) throw Error("Versión de plantilla no válida.");
        const shape = template.building;
        if (!shape || ![shape.x,shape.y,shape.width,shape.height].every(Number.isInteger) || shape.width<3 || shape.height<3 || shape.width>64 || shape.height>64 || !Array.isArray(shape.walls) || !Array.isArray(shape.rooms)) throw Error("Dimensiones de plantilla no válidas.");
        const root = compileBuilding(shape).building,
          dx = c.x - root.x,
          dy = c.y - root.y,
          b = { ...root, id: c.id, x: c.x, y: c.y };
        b.walls = root.walls.map((w) => ({
          ...w,
          id: `${c.id}:${w.id}`,
          x: w.x + dx,
          y: w.y + dy,
          ...(w.doorId ? { doorId: `${c.id}:${w.doorId}` } : {}),
        }));
        b.rooms = root.rooms.map((r) => ({
          ...r,
          id: `${c.id}:${r.id}`,
          cells: r.cells.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        }));
        doc.buildings.push(b);
        for (const l of LAYERS.filter((l) => l !== "buildings"))
          for (const e of template[l] ?? [])
            doc[l].push({
              ...e,
              id: `${c.id}:${e.id}`,
              x: e.x + dx,
              y: e.y + dy,
              ...(e.containerId ? { containerId: `${c.id}:${e.containerId}` } : {}),
            });
      } else throw Error(`Comando desconocido: ${c.type}`);
    }
    const preflight = validateMap(doc);
    if (!preflight.valid) return { document: original, ...preflight };
    doc.buildings = doc.buildings.map((b) => compileBuilding(b).building);
    doc.revision++;
    const checked = validateMap(doc);
    return checked.valid
      ? { document: doc, errors: [], warnings: checked.warnings }
      : { document: original, ...checked };
  } catch (e) {
    return { document: original, errors: [e.message], warnings: [] };
  }
}
export function buildingTemplate(doc, id) {
  const b = entity(doc, id).object,
    content = new Set(children(doc, b).map((e) => e.id));
  return {
    version: 1,
    name: b.name ?? "Edificio",
    building: structuredClone(b),
    ...Object.fromEntries(
      LAYERS.filter((l) => l !== "buildings").map((l) => [
        l,
        structuredClone(doc[l].filter((e) => content.has(e.id))),
      ]),
    ),
  };
}
export function createHistory(document) {
  return { document, past: [], future: [] };
}
export function editHistory(history, commands) {
  const result = applyMapCommands(history.document, commands);
  return result.errors.length
    ? { ...history, errors: result.errors }
    : {
        document: result.document,
        past: [...history.past, history.document].slice(-100),
        future: [],
        errors: [],
      };
}
export function undoHistory(history) {
  if (!history.past.length) return history;
  return {
    document: { ...history.past.at(-1), revision: history.document.revision + 1 },
    past: history.past.slice(0, -1),
    future: [history.document, ...history.future],
    errors: [],
  };
}
export function redoHistory(history) {
  if (!history.future.length) return history;
  return {
    document: { ...history.future[0], revision: history.document.revision + 1 },
    past: [...history.past, history.document],
    future: history.future.slice(1),
    errors: [],
  };
}
