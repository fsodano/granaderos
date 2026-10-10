import {normalizeBuildingWalls,migrateWallGeometry,wallEdgeKey,wallEdgeCells,wallEdgesBetween,wallMovementBlocked} from './wall-geometry.js';
import { cellKey, neighbours, FEATURES } from "./map-catalog.js";
import { propBlocksAt } from "./props.js";
// Recompute rooms from structural cells; preserve existing IDs by maximum overlap.
export function compileBuilding(source) {
  const b = structuredClone(source);
  b.walls = normalizeBuildingWalls(b);
  const cells = [];
  for (let y = b.y; y < b.y + b.height; y++)
    for (let x = b.x; x < b.x + b.width; x++) cells.push({ x, y });
  const remaining = new Map(cells.map((c) => [cellKey(c), c])),
    rooms = [],
    used = new Set();
  for (const first of cells) {
    if (!remaining.has(cellKey(first))) continue;
    const connected = [first];
    remaining.delete(cellKey(first));
    for (let i = 0; i < connected.length; i++)
      for (const next of neighbours(connected[i]))
        if (remaining.has(cellKey(next)) && !wallEdgesBetween({wallEdges:b.walls},connected[i],next).length) {
          connected.push(next);
          remaining.delete(cellKey(next));
        }
    const keys = new Set(connected.map(cellKey));
    const match = (b.rooms ?? [])
      .filter((r) => !used.has(r.id))
      .map((r) => ({ r, score: r.cells.filter((c) => keys.has(cellKey(c))).length }))
      .sort((a, z) => z.score - a.score)[0];
    let id = match?.score ? match.r.id : `${b.id}:room:${first.x}:${first.y}`;
    let serial = 1;
    while (used.has(id)) id = `${b.id}:room:${first.x}:${first.y}:${serial++}`;
    used.add(id);
    rooms.push({
      id,
      ...(match?.score && match.r.name ? { name: match.r.name } : {}),
      cells: connected,
    });
  }
  b.rooms = rooms;
  const tiles = cells.map((c) => ({
    ...c,
    type: "floor",
    blocked: false,
    blocksSight: false,
    cover: 0,
    material: b.material,
    buildingId: b.id,
    roomId: rooms.find((r) => r.cells.some((t) => cellKey(t) === cellKey(c))).id,
  }));
  const wallEdges = b.walls.map((w) => ({
    ...w,
    buildingId: b.id,
    material: b.material,
    blocked: w.type !== "door" || !w.open,
    blocksSight: w.type === "wall" || (w.type === "door" && !w.open),
    cover: w.type === "wall" ? 40 : w.type === "window" ? 25 : 0,
  }));
  return { building: b, tiles, wallEdges };
}
export function compileMap(doc) {
  const terrain = new Map(doc.terrain.map((t) => [cellKey(t), structuredClone(t)]));
  for (const f of doc.features) {
    const kind = FEATURES[f.type];
    terrain.set(cellKey(f), {
      ...terrain.get(cellKey(f)),
      type: kind.terrain,
      blocked: kind.blocked,
      cover: kind.cover,
    });
  }
  const buildings = [], wallEdges = structuredClone(doc.wallEdges??[]);
  for (const source of doc.buildings) {
    const { building, tiles, wallEdges: edges } = compileBuilding(source);
    wallEdges.push(...edges);
    buildings.push(building);
    for (const t of tiles) terrain.set(cellKey(t), t);
  }
  const standalone = [...terrain.values()].filter(t=>["wall","door","window"].includes(t.type) && !t.buildingId);
  if(standalone.length){
    const converted=migrateWallGeometry({width:doc.width,height:doc.height,tiles:standalone,buildings:[]});
    const owned = new Set(buildings.flatMap(b=>b.walls.map(wallEdgeKey)));
    wallEdges.push(...converted.wallEdges.filter(edge=>!owned.has(wallEdgeKey(edge)) && !buildings.some(b=>wallEdgeCells(edge).every(c=>c.x>=b.x&&c.x<b.x+b.width&&c.y>=b.y&&c.y<b.y+b.height))));
    for(const tile of converted.tiles)terrain.set(cellKey(tile),tile);
  }
  const props = doc.props.map((p) => {
    const room = buildings
      .flatMap((b) => b.rooms.map((r) => ({ ...r, buildingId: b.id })))
      .find((r) => r.cells.some((c) => cellKey(c) === cellKey(p)));
    const copy = structuredClone(p);
    if (room) {
      copy.roomId = room.id;
      copy.buildingId = room.buildingId;
    } else {
      delete copy.roomId;
      delete copy.buildingId;
    }
    return copy;
  });
  return {
    width: doc.width,
    height: doc.height,
    tiles: [...terrain.values()].sort((a, b) => a.y - b.y || a.x - b.x),
    buildings,
    wallEdges,
    wallGeometryVersion: 2,
    props,
    lights: structuredClone(doc.lights),
    groundItems: doc.items.map((i) => ({ ...i })),
    containers: doc.items.filter((i) => i.containerId),
    spawns: structuredClone(doc.spawns),
    exits: structuredClone(doc.exits),
    decor: structuredClone(doc.decor ?? []),
    boundaryRoads: structuredClone(doc.boundaryRoads ?? doc.terrain.filter(t=>t.type === "road" && (t.x === 0 || t.x === doc.width-1 || t.y === 0 || t.y === doc.height-1))),
    sourceMapId: doc.id,
    sourceMapRevision: doc.revision,
    name: doc.metadata.title,
    sector: doc.id,
  };
}
export function reachableMap(map, start, { openDoors = true } = {}) {
  // Authoring checks potential access, including doors that begin locked.
  const geometry = openDoors ? {wallEdges:(map.wallEdges??[]).map(edge=>edge.type==="door"?{...edge,open:true}:edge)} : map;
  const passable = new Map(
    map.tiles
      .filter(
        (t) => (!t.blocked || (openDoors && t.type === "door")) && !propBlocksAt(map, t.x, t.y),
      )
      .map((t) => [cellKey(t), t]),
  );
  if (!start || !passable.has(cellKey(start))) return new Set();
  const seen = new Set([cellKey(start)]),
    queue = [start];
  for (let i = 0; i < queue.length; i++)
    for (const n of neighbours(queue[i]))
      if (passable.has(cellKey(n)) && !seen.has(cellKey(n)) && !wallMovementBlocked(geometry,queue[i],n)) {
        seen.add(cellKey(n));
        queue.push(n);
      }
  return seen;
}
