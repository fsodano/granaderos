import {CAMPAIGN_SECTORS} from './data.js';

export const EXIT_EDGES = ['N', 'E', 'S', 'W'];
// Explicit road links on schematic maps. Mountain passages need not retain
// the strategic chart's compass direction. See docs/gameplay/tactical/tactical-exit-layouts.md.
const links = [
  ['buenos_aires', 'N', 9, 0, 'retiro', 'S', 14, 15],
  ['buenos_aires', 'E', 19, 7, 'ensenada', 'W', 0, 7],
  ['buenos_aires', 'N', 10, 0, 'san_nicolas', 'S', 11, 15],
  ['buenos_aires', 'W', 0, 7, 'cordoba', 'E', 19, 8],
  ['san_nicolas', 'N', 11, 0, 'santa_fe', 'S', 4, 15],
  ['cordoba', 'E', 19, 7, 'san_nicolas', 'W', 0, 6],
  ['cordoba', 'E', 19, 8, 'santa_fe', 'W', 0, 7],
  ['santa_fe', 'W', 0, 8, 'tucuman', 'E', 19, 8],
  ['cordoba', 'N', 9, 0, 'tucuman', 'S', 12, 15],
  ['cordoba', 'S', 9, 15, 'mendoza', 'N', 12, 0],
  ['mendoza', 'W', 0, 7, 'uspallata', 'E', 19, 7],
  ['mendoza', 'W', 0, 8, 'los_patos', 'E', 19, 6],
  ['uspallata', 'W', 0, 7, 'los_patos', 'E', 19, 7],
  ['tucuman', 'N', 12, 0, 'salta', 'S', 10, 15],
  ['salta', 'N', 10, 0, 'jujuy', 'E', 19, 7],
  ['jujuy', 'W', 0, 7, 'humahuaca', 'E', 19, 7],
];
const campaignIds = new Set(CAMPAIGN_SECTORS.map(s => s.id));
const descriptor = (source, edge, destination, entryEdge, x, y) => ({
  id: `${source}:${destination}`, edge, destination, entryEdge, entryAnchor: {x, y},
});

export function sectorExits(sectorId, sceneId = null) {
  if (sceneId === 'yatasto' && sectorId === 'tucuman') return [descriptor('yatasto', 'S', 'tucuman', 'N', 13, 0)];
  if (sceneId != null) return [];
  if (sectorId === 'san_lorenzo') return [descriptor('san_lorenzo', 'S', 'san_nicolas', 'N', 12, 0)];
  if (!campaignIds.has(sectorId)) return [];
  const result = links.flatMap(([a, aEdge, ax, ay, b, bEdge, bx, by]) =>
    a === sectorId ? [descriptor(a, aEdge, b, bEdge, bx, by)] :
    b === sectorId ? [descriptor(b, bEdge, a, aEdge, ax, ay)] : []);
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function findSectorExit(sectorId, sceneId, exitId) {
  return sectorExits(sectorId, sceneId).find(exit => exit.id === exitId) ?? null;
}

export function entryFromSector(fromSector, toSector, sceneId = null) {
  if (sceneId === 'yatasto' && fromSector === 'tucuman' && toSector === 'tucuman') return {entryEdge: 'S', entryAnchor: {x: 3, y: 15}};
  if (sceneId != null) return null;
  if (fromSector === 'san_nicolas' && toSector === 'san_lorenzo') return {entryEdge: 'S', entryAnchor: {x: 11, y: 15}};
  const exit = sectorExits(fromSector).find(item => item.destination === toSector);
  return exit ? {entryEdge: exit.entryEdge, entryAnchor: {...exit.entryAnchor}} : null;
}

export function exitAnchorFor(sectorId, sceneId, exitId) {
  const exit = findSectorExit(sectorId, sceneId, exitId);
  if (!exit) return null;
  if (sceneId === 'yatasto') return {x: 3, y: 15};
  if (sectorId === 'san_lorenzo') return {x: 11, y: 15};
  return entryFromSector(exit.destination, sectorId)?.entryAnchor ?? null;
}

// Geometry only: terrain, occupancy, condition, and action costs belong to callers.
export function boundaryMatches(state, point, edge) {
  if (!state || !point || !EXIT_EDGES.includes(edge) || !Number.isInteger(state.width) || !Number.isInteger(state.height) || state.width < 1 || state.height < 1 || !Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= state.width || point.y >= state.height) return false;
  return edge === 'N' ? point.y === 0 : edge === 'E' ? point.x === state.width - 1 : edge === 'S' ? point.y === state.height - 1 : point.x === 0;
}

export function validEntry(edge, anchor, width = 20, height = 16) {
  return Boolean(anchor && typeof anchor === 'object' && !Array.isArray(anchor) && Object.keys(anchor).length === 2 && Object.hasOwn(anchor, 'x') && Object.hasOwn(anchor, 'y') && boundaryMatches({width, height}, anchor, edge));
}

export function inwardFromBoundary(point, edge) {
  if (!point || !EXIT_EDGES.includes(edge)) return null;
  return {x: point.x + (edge === 'W' ? 1 : edge === 'E' ? -1 : 0), y: point.y + (edge === 'N' ? 1 : edge === 'S' ? -1 : 0)};
}

export function validateSectorExits(sectorId, sceneId, exits) {
  if (!Array.isArray(exits) || !(sceneId === 'yatasto' && sectorId === 'tucuman' || sceneId == null && (campaignIds.has(sectorId) || sectorId === 'san_lorenzo'))) return false;
  const allowed = sectorExits(sectorId, sceneId), seen = new Set();
  return exits.every(exit => {
    if (!exit || typeof exit !== 'object' || Array.isArray(exit) || Object.keys(exit).length !== 5 || seen.has(exit.id)) return false;
    const canonical = allowed.find(item => item.id === exit.id);
    if (!canonical || !validEntry(exit.entryEdge, exit.entryAnchor)) return false;
    seen.add(exit.id);
    return ['id', 'edge', 'destination', 'entryEdge'].every(key => exit[key] === canonical[key]) && exit.entryAnchor.x === canonical.entryAnchor.x && exit.entryAnchor.y === canonical.entryAnchor.y;
  });
}
