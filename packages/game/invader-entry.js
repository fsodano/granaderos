import { scenarioFor } from './campaign-scenario.js';
import { entryTerrainCells, exteriorComponent } from './sector-entry.js';
import { physicalEntryAnchor } from './sector-expansion.js';
import { spaceKey } from './tactical-space.js';
import { movementStepCost } from './tactical.js';

export function invaderEntry(request) {
  return scenarioFor(request).invaderEntry(request);
}

export function placeInvaders(state, units, request, occupied) {
  if (!units.length) {
    return;
  }
  const { entryEdge, entryAnchor } = invaderEntry(request),
    actor = units[0];
  const component = exteriorComponent(state, actor),
    boundary = entryTerrainCells(state, actor, entryEdge, component);
  if (!boundary.length) {
    throw Error('La incursión no tiene una entrada transitable.');
  }
  const anchor = physicalEntryAnchor(
    entryEdge,
    entryAnchor,
    state.width,
    state.height,
    state.sceneId ?? state.sectorId,
    request,
  );
  const available = new Map(
    state.tiles.filter((t) => component.has(spaceKey(t))).map((t) => [spaceKey(t), t]),
  );
  // Fill the boundary first. A narrow gorge needs additional ranks on its
  // connected approach; each added cell must have an actual traversable step.
  const blocked = new Set([...occupied, ...state.artillery.map(spaceKey)]),
    entries = boundary.filter((t) => !blocked.has(spaceKey(t)));
  const maxDepth = Math.max(2, Math.ceil(units.length / boundary.length));
  const depth = new Map(entries.map((t) => [spaceKey(t), 0])),
    queue = [...entries];
  for (let i = 0; i < queue.length; i++) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const from = queue[i],
        next = available.get(spaceKey({ x: from.x + dx, y: from.y + dy }));
      if (
        depth.get(spaceKey(from)) >= maxDepth ||
        !next ||
        blocked.has(spaceKey(next)) ||
        depth.has(spaceKey(next)) ||
        !Number.isFinite(movementStepCost(state, actor, from, next))
      )
        {continue;}
      depth.set(spaceKey(next), depth.get(spaceKey(from)) + 1);
      queue.push(next);
    }
  }
  const cells = queue
    .filter((t) => !occupied.has(spaceKey(t)))
    .sort(
      (a, b) =>
        depth.get(spaceKey(a)) - depth.get(spaceKey(b)) ||
        Math.abs(a.x - anchor.x) +
          Math.abs(a.y - anchor.y) -
          Math.abs(b.x - anchor.x) -
          Math.abs(b.y - anchor.y) ||
        a.y - b.y ||
        a.x - b.x,
    );
  if (cells.length < units.length) {
    throw Error('No queda espacio para la columna enemiga en su entrada.');
  }
  units.forEach((unit, i) => {
    const { x, y } = cells[i];
    Object.assign(unit, {
      x,
      y,
      tacticalLevel: 0,
      facing: { N: 4, E: 6, S: 0, W: 2 }[entryEdge],
      patrolOrigin: { x, y },
    });
    occupied.add(spaceKey(unit));
  });
}
