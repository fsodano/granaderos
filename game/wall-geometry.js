// Cell centers are integers. Wall coordinates name grid vertices; the world
// vertex is (x - .5, y - .5). Each edge is exactly one cell long.
export const WALL_GEOMETRY_VERSION = 2;
export const WALL_THICKNESS = .12;
const level = point => point?.tacticalLevel ?? 0;
const cellKey = point => `${point.x},${point.y}`;
const indexes = new WeakMap();
export const wallEdgeKey = edge => `${level(edge)}:${edge.axis}:${edge.x},${edge.y}`;
export const wallEdgeId = edge => edge.id ?? `wall:${level(edge)}:${edge.axis}:${edge.x}:${edge.y}`;
export function wallEdgeEndpoints(edge) {
  const a = {x: edge.x - .5, y: edge.y - .5, tacticalLevel: level(edge)};
  return [a, {...a, x: a.x + (edge.axis === 'x' ? 1 : 0), y: a.y + (edge.axis === 'y' ? 1 : 0)}];
}
export function wallEdgeCenter(edge) {
  const [a, b] = wallEdgeEndpoints(edge);
  return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, tacticalLevel: level(edge)};
}
export function wallEdgeCells(edge) {
  const a = {x: edge.x, y: edge.y, tacticalLevel: level(edge)};
  return edge.axis === 'x' ? [{...a, y: a.y - 1}, a] : [{...a, x: a.x - 1}, a];
}
function edgeIndex(state) {
  const edges = state.wallEdges ?? [];
  let index = indexes.get(edges);
  if (!index || index.length !== edges.length) {
    const byKey = new Map();
    for (const edge of edges) {
      const key = wallEdgeKey(edge), records = byKey.get(key) ?? [];
      records.push(edge); byKey.set(key, records);
    }
    index = {length: edges.length, byKey}; indexes.set(edges, index);
  }
  return index.byKey;
}
export function wallEdgesBetween(state, a, b) {
  if (level(a) !== level(b) || Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return [];
  const edge = a.x !== b.x ? {x: Math.max(a.x, b.x), y: a.y, axis: 'y', tacticalLevel: level(a)} :
    {x: a.x, y: Math.max(a.y, b.y), axis: 'x', tacticalLevel: level(a)};
  return edgeIndex(state).get(wallEdgeKey(edge)) ?? [];
}
export function wallEdgeBlocksMovement(edge, {openDoors = false} = {}) {
  if (edge.destroyed || edge.type === 'rubble') return false;
  if (edge.type === 'door') return !edge.open && !(openDoors && !edge.locked && !edge.jammed);
  return edge.type === 'wall' || edge.type === 'window';
}
// A diagonal must clear both orthogonal routes around its shared corner. This
// prevents crossing a closed edge by touching its endpoint.
export function wallMovementBlocked(state, a, b, options = {}) {
  if (level(a) !== level(b)) return false;
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  if (Math.max(dx, dy) !== 1) return false;
  const blocked = (from, to) => wallEdgesBetween(state, from, to).some(edge => wallEdgeBlocksMovement(edge, options));
  if (!dx || !dy) return blocked(a, b);
  const horizontal = {...a, x: b.x}, vertical = {...a, y: b.y};
  return blocked(a, horizontal) || blocked(a, vertical) || blocked(horizontal, b) || blocked(vertical, b);
}

// Legacy maps author structures as cells. Convert their outer ring to the
// footprint boundary and join internal partitions to that boundary. Runtime
// damage and door fields remain on the corresponding edge records.
export function normalizeBuildingWalls(building) {
  const walls = building.walls ?? [];
  if (walls.every(w => w.axis === 'x' || w.axis === 'y')) return walls.map(w => ({...w,buildingId:building.id,material:w.material??building.material??'adobe',id:wallEdgeId(w)}));
  const source = new Map(walls.map(w => [cellKey(w), w])), result = new Map();
  const x0 = building.x, y0 = building.y, x1 = x0 + building.width - 1, y1 = y0 + building.height - 1;
  const internal = (x, y) => x > x0 && x < x1 && y > y0 && y < y1 && source.has(`${x},${y}`);
  for (const w of walls) {
    const segments = [];
    if (w.y === y0) segments.push({x: w.x, y: y0, axis: 'x'});
    if (w.y === y1) segments.push({x: w.x, y: y1 + 1, axis: 'x'});
    if (w.x === x0) segments.push({x: x0, y: w.y, axis: 'y'});
    if (w.x === x1) segments.push({x: x1 + 1, y: w.y, axis: 'y'});
    if (!segments.length) {
      const horizontal = source.has(`${w.x - 1},${w.y}`) || source.has(`${w.x + 1},${w.y}`);
      const vertical = source.has(`${w.x},${w.y - 1}`) || source.has(`${w.x},${w.y + 1}`);
      if (horizontal || !vertical) segments.push({x: w.x, y: w.y + 1, axis: 'x'});
      if (vertical) segments.push({x: w.x + 1, y: w.y, axis: 'y'});
    } else {
      if ((w.y === y0 && internal(w.x, w.y + 1)) || (w.y === y1 && internal(w.x, w.y - 1))) segments.push({x: w.x + 1, y: w.y, axis: 'y'});
      if ((w.x === x0 && internal(w.x + 1, w.y)) || (w.x === x1 && internal(w.x - 1, w.y))) segments.push({x: w.x, y: w.y + 1, axis: 'x'});
    }
    segments.forEach((segment, index) => {
      const edge = {...w, ...segment, buildingId: building.id,
        id: `${building.id}:wall:${segment.axis}:${segment.x}:${segment.y}`};
      // A corner opening names one leaf, never two independently opened leaves.
      if (index && ['door', 'window'].includes(edge.type)) {
        edge.type = 'wall'; delete edge.doorId; delete edge.open; delete edge.locked;
        edge.blocked = true; edge.blocksSight = true; edge.cover = 40;
      }
      result.set(wallEdgeKey(edge), edge);
    });
  }
  return [...result.values()];
}

export function buildingEdgeRooms(building, walls = normalizeBuildingWalls(building)) {
  const remaining = new Map();
  for (let y = building.y; y < building.y + building.height; y++)
    for (let x = building.x; x < building.x + building.width; x++) remaining.set(`${x},${y}`, {x, y});
  const rooms = [], used = new Set(), geometry = {wallEdges: walls};
  for (const first of [...remaining.values()]) {
    if (!remaining.has(cellKey(first))) continue;
    const cells = [first]; remaining.delete(cellKey(first));
    for (let i = 0; i < cells.length; i++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = {x: cells[i].x + dx, y: cells[i].y + dy}, key = cellKey(next);
      // Doors split rooms even when open; a breach does not rename the rooms.
      if (!remaining.has(key) || wallEdgesBetween(geometry, cells[i], next).length) continue;
      remaining.delete(key); cells.push(next);
    }
    const keys = new Set(cells.map(cellKey)), match = (building.rooms ?? []).filter(r => !used.has(r.id))
      .map(r => ({room: r, score: r.cells.filter(c => keys.has(cellKey(c))).length})).sort((a,b) => b.score-a.score)[0];
    const id = match?.score ? match.room.id : `${building.id}:room:${first.x}:${first.y}`;
    used.add(id); rooms.push({id, ...(match?.score && match.room.name ? {name: match.room.name} : {}), cells});
  }
  return rooms;
}

export function migrateWallGeometry(state) {
  if (Array.isArray(state.wallEdges)) {state.wallGeometryVersion = WALL_GEOMETRY_VERSION; return state;}
  const structural = tile => ['wall','door','window'].includes(tile.type) || tile.destroyed && tile.type === 'rubble';
  const edges = [], assigned = new Set();
  for (const building of state.buildings ?? []) {
    const current = (state.tiles ?? []).filter(t => t.buildingId === building.id && structural(t));
    const live = new Map(current.map(t => [cellKey(t), t]));
    const walls = building.walls?.length ? building.walls.map(w => ({...w, ...live.get(cellKey(w))})) : current;
    const converted = normalizeBuildingWalls({...building, walls});
    const native=walls.every(w=>w.axis==='x'||w.axis==='y');
    building.walls=converted;
    if(!native)building.rooms=[...buildingEdgeRooms({...building,rooms:(building.rooms??[]).filter(room=>(room.tacticalLevel??level(room.cells?.[0]))===0)},converted),...(building.rooms??[]).filter(room=>(room.tacticalLevel??level(room.cells?.[0]))>0)];
    edges.push(...converted);
    const rooms = new Map(building.rooms.flatMap(room => room.cells.filter(cell=>(cell.tacticalLevel??room.tacticalLevel??0)===0).map(cell => [cellKey(cell), room.id])));
    for (const tile of state.tiles ?? []) if (rooms.has(cellKey(tile))) {
      assigned.add(cellKey(tile));
      Object.assign(tile, {type:'floor',blocked:false,blocksSight:false,cover:0,material:building.material ?? tile.material ?? 'adobe',buildingId:building.id,roomId:rooms.get(cellKey(tile))});
      for (const key of ['doorId','open','locked','broken','trap','contents','structureDamage','destroyed','obstacleHeight','projectileResistance']) delete tile[key];
    }
  }
  const free = (state.tiles ?? []).filter(t => !assigned.has(cellKey(t)) && structural(t));
  const source = new Map(free.map(t => [cellKey(t),t]));
  for (const tile of free) {
    const horizontal = source.has(`${tile.x-1},${tile.y}`) || source.has(`${tile.x+1},${tile.y}`);
    const vertical = source.has(`${tile.x},${tile.y-1}`) || source.has(`${tile.x},${tile.y+1}`);
    const axes = [...(horizontal || !vertical ? ['x'] : []), ...(vertical ? ['y'] : [])];
    for (const axis of axes) {
      const edge = {...tile,axis,x:tile.x+(axis==='y'?1:0),y:tile.y+(axis==='x'?1:0)};
      edge.id = wallEdgeId(edge); edges.push(edge);
    }
    Object.assign(tile,{type:'grass',blocked:false,blocksSight:false,cover:0});
    for (const key of ['doorId','open','locked','broken','trap','contents','structureDamage','destroyed','obstacleHeight','projectileResistance']) delete tile[key];
  }
  state.wallEdges = edges; state.wallGeometryVersion = WALL_GEOMETRY_VERSION;
  return state;
}
