import { cellKey, neighbours, FEATURES } from "./map-catalog.js";
import { propBlocksAt } from "./props.js";
// Recompute rooms from structural cells; preserve existing IDs by maximum overlap.
export function compileBuilding(source) {
  const b = structuredClone(source),
    walls = new Map(b.walls.map((t) => [cellKey(t), t])),
    cells = [];
  for (let y = b.y; y < b.y + b.height; y++)
    for (let x = b.x; x < b.x + b.width; x++) if (!walls.has(`${x},${y}`)) cells.push({ x, y });
  const remaining = new Map(cells.map((c) => [cellKey(c), c])),
    rooms = [],
    used = new Set();
  for (const first of cells) {
    if (!remaining.has(cellKey(first))) continue;
    const connected = [first];
    remaining.delete(cellKey(first));
    for (let i = 0; i < connected.length; i++)
      for (const next of neighbours(connected[i]))
        if (remaining.has(cellKey(next))) {
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
  for (const w of b.walls)
    tiles.push({
      ...w,
      buildingId: b.id,
      material: b.material,
      roomId: null,
      blocked: w.type !== "door" || !w.open,
      blocksSight: w.type === "wall" || (w.type === "door" && !w.open),
      cover: w.type === "wall" ? 40 : w.type === "window" ? 25 : 0,
    });
  return { building: b, tiles };
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
  const buildings = [];
  for (const source of doc.buildings) {
    const { building, tiles } = compileBuilding(source);
    buildings.push(building);
    for (const t of tiles) terrain.set(cellKey(t), t);
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
    props,
    lights: structuredClone(doc.lights),
    groundItems: doc.items.map((i) => ({ ...i })),
    containers: doc.items.filter((i) => i.containerId),
    spawns: structuredClone(doc.spawns),
    exits: structuredClone(doc.exits),
    decor: structuredClone(doc.decor ?? []),
    sourceMapId: doc.id,
    sourceMapRevision: doc.revision,
    name: doc.metadata.title,
    sector: doc.id,
  };
}
export function reachableMap(map, start, { openDoors = true } = {}) {
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
      if (passable.has(cellKey(n)) && !seen.has(cellKey(n))) {
        seen.add(cellKey(n));
        queue.push(n);
      }
  return seen;
}
