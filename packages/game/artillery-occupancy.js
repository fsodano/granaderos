import { canWalkBetween, sameCell, spaceKey, tacticalLevel } from './tactical-space.js';
import { propBlocksAt } from './props.js';

export const ARTILLERY_OCCUPANCY_VERSION = 1;
export const artillerySpaceKeys = (state) => new Set((state.artillery ?? []).map(spaceKey));
export const artilleryCellOccupied = (state, point) =>
  (state.artillery ?? []).some((gun) => sameCell(gun, point));
const present = (person) => (person.hp ?? 100) > 0 && !person.departure && !person.fled;
const people = (state) => [...(state.units ?? []), ...(state.npcs ?? [])].filter(present);
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};

// This is placement, not a paid tactical movement. Saved records are validated
// before this migration. Only coordinates and this version marker may change.
export function initializeArtilleryOccupancy(state) {
  const version = state.artilleryOccupancyVersion;
  need(
    version === undefined || version === ARTILLERY_OCCUPANCY_VERSION,
    'La versión de ocupación de artillería no es válida.',
  );
  const occupants = people(state),
    overlaps = occupants.filter((person) => artilleryCellOccupied(state, person));
  if (version === ARTILLERY_OCCUPANCY_VERSION) {
    need(!overlaps.length, 'Una persona no puede ocupar la casilla de un cañón.');
    return state;
  }
  const reserved = artillerySpaceKeys(state);
  for (const person of occupants) {
    reserved.add(spaceKey(person));
  }
  const planned = [];
  overlaps.sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
  for (const person of overlaps) {
    const gun = state.artillery.find((piece) => sameCell(piece, person)),
      level = tacticalLevel(person),
      facing = gun.facing ?? 0;
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) {
          continue;
        }
        const point = { x: person.x + dx, y: person.y + dy, tacticalLevel: level };
        if (
          reserved.has(spaceKey(point)) ||
          propBlocksAt(state, point.x, point.y, level) ||
          !canWalkBetween(state, person, point)
        ) {
          continue;
        }
        if (
          dx &&
          dy &&
          [
            { x: point.x, y: person.y, tacticalLevel: level },
            { x: person.x, y: point.y, tacticalLevel: level },
          ].some(
            (corner) =>
              propBlocksAt(state, corner.x, corner.y, level) ||
              artilleryCellOccupied(state, corner),
          )
        ) {
          continue;
        }
        const forward = dx * Math.cos(facing) + dy * Math.sin(facing);
        candidates.push({
          ...point,
          rank: forward > 1e-9 ? 2 : forward < -1e-9 ? 0 : 1,
          distance: Math.abs(dx) + Math.abs(dy),
          forward,
        });
      }
    }
    candidates.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.distance - b.distance ||
        a.forward - b.forward ||
        a.y - b.y ||
        a.x - b.x,
    );
    const point = candidates[0];
    need(point, 'No queda una casilla libre adyacente para separar a la persona del cañón.');
    reserved.add(spaceKey(point));
    planned.push({ person, x: point.x, y: point.y });
  }
  // Commit only after every overlap has a legal adjacent place.
  for (const { person, x, y } of planned) {
    Object.assign(person, { x, y });
  }
  state.artilleryOccupancyVersion = ARTILLERY_OCCUPANCY_VERSION;
  return state;
}
