import {campaignWorld} from './campaign-definition.js';
import {validWorldLocation,worldCell} from './world-cells.js';
import {wallMovementBlocked} from './wall-geometry.js';

export const EXIT_EDGES = ['N', 'E', 'S', 'W'];
const descriptor = (source, edge, destination, entryEdge, x, y) => ({
  id: `${source}:${destination}`, edge, destination, entryEdge, entryAnchor: {x, y},
});

export function sectorExits(sectorId, sceneId = null,context=null) {
  const world=campaignWorld(context),links=world.exitLinks??[];
  const scene=world.sceneExits?.[sceneId??sectorId];
  if(scene?.sector===sectorId)return structuredClone(scene.exits);
  if (sceneId != null) return [];
  if (!validWorldLocation(sectorId,context)) return [];
  const result = links.flatMap(([a, aEdge, ax, ay, b, bEdge, bx, by]) =>
    a === sectorId ? [descriptor(a, aEdge, b, bEdge, bx, by)] :
    b === sectorId ? [descriptor(b, bEdge, a, aEdge, ax, ay)] : []);
  result.sort((a,b)=>a.id.localeCompare(b.id));
  // Preserve named road routes first. Rural cells use their physical neighbours.
  const cell=worldCell(sectorId,context);
  for(const [dx,dy,edge,entryEdge,x,y] of [[0,-1,'N','S',2,15],[1,0,'E','W',0,8],[0,1,'S','N',2,0],[-1,0,'W','E',19,8]]){
    const next=worldCell(`cell-${cell.col+dx}-${cell.row+dy}`,context);
    if(next?.land&&!result.some(e=>e.destination===next.location))result.push(descriptor(sectorId,edge,next.location,entryEdge,x,y));
  }
  return result;
}

export function findSectorExit(sectorId, sceneId, exitId,context=null) {
  return sectorExits(sectorId, sceneId,context).find(exit => exit.id === exitId) ?? null;
}

export function entryFromSector(fromSector,toSector,sceneId=null,context=null){
 const entry=(campaignWorld(context).sceneEntries??[]).find(e=>e.from===fromSector&&e.to===toSector&&e.scene===sceneId);
 if(entry)return {entryEdge:entry.entryEdge,entryAnchor:{...entry.entryAnchor}};
 if(sceneId!=null)return null;
 const exit=sectorExits(fromSector,null,context).find(item=>item.destination===toSector);
 return exit?{entryEdge:exit.entryEdge,entryAnchor:{...exit.entryAnchor}}:null;
}
export function exitAnchorFor(sectorId,sceneId,exitId,context=null){
 const exit=findSectorExit(sectorId,sceneId,exitId,context);if(!exit)return null;
 const anchor=campaignWorld(context).sceneExitAnchors?.[sceneId??sectorId];
 return anchor?{...anchor}:entryFromSector(exit.destination,sectorId,null,context)?.entryAnchor??null;
}

// Geometry only: terrain, occupancy, condition, and action costs belong to callers.
export function boundaryMatches(state, point, edge) {
  if (!state || !point || !EXIT_EDGES.includes(edge) || !Number.isInteger(state.width) || !Number.isInteger(state.height) || state.width < 1 || state.height < 1 || !Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= state.width || point.y >= state.height) return false;
  return edge === 'N' ? point.y === 0 : edge === 'E' ? point.x === state.width - 1 : edge === 'S' ? point.y === state.height - 1 : point.x === 0;
}

// The boundary cell remains usable when a wall occupies its outside edge.
// Leaving or arriving must also clear that physical edge.
export function boundaryPassable(state, point, edge) {
  if ((point?.tacticalLevel ?? 0) !== 0 || !boundaryMatches(state, point, edge)) return false;
  const outside = {...point, x: point.x + (edge === 'W' ? -1 : edge === 'E' ? 1 : 0), y: point.y + (edge === 'N' ? -1 : edge === 'S' ? 1 : 0)};
  return !wallMovementBlocked(state, point, outside);
}

export function validEntry(edge, anchor, width = 20, height = 16) {
  return Boolean(anchor && typeof anchor === 'object' && !Array.isArray(anchor) && Object.keys(anchor).length === 2 && Object.hasOwn(anchor, 'x') && Object.hasOwn(anchor, 'y') && boundaryMatches({width, height}, anchor, edge));
}

export function inwardFromBoundary(point, edge) {
  if (!point || !EXIT_EDGES.includes(edge)) return null;
  return {x: point.x + (edge === 'W' ? 1 : edge === 'E' ? -1 : 0), y: point.y + (edge === 'N' ? 1 : edge === 'S' ? -1 : 0)};
}

export function validateSectorExits(sectorId, sceneId, exits,context=null) {
  if (!Array.isArray(exits) || !(campaignWorld(context).sceneExits?.[sceneId??sectorId]?.sector===sectorId || sceneId==null&&validWorldLocation(sectorId,context))) return false;
  const allowed = sectorExits(sectorId, sceneId,context), seen = new Set();
  return exits.every(exit => {
    if (!exit || typeof exit !== 'object' || Array.isArray(exit) || Object.keys(exit).length !== 5 || seen.has(exit.id)) return false;
    const canonical = allowed.find(item => item.id === exit.id);
    if (!canonical || !validEntry(exit.entryEdge, exit.entryAnchor)) return false;
    seen.add(exit.id);
    return ['id', 'edge', 'destination', 'entryEdge'].every(key => exit[key] === canonical[key]) && exit.entryAnchor.x === canonical.entryAnchor.x && exit.entryAnchor.y === canonical.entryAnchor.y;
  });
}
