import { incomeSources } from './economy.js';
// Approximate geographic anchors; operational areas are not surveyed city limits.
import { campaignWorld } from './campaign-definition.js';
import { CAMPAIGN_GRID } from './world-grid.js';
export const MAP_PLACES = Object.freeze(campaignWorld().places);
// Campaign coordinates use the same fixed viewport and their own projection.
/** @param {number} lon @param {number} lat @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export function project(lon, lat, context = null) {
  const p = campaignWorld(context).projection ?? {
    minLongitude: 0,
    maxLatitude: 33,
    longitudeScale: 18,
    latitudeScale: 18,
  };
  return {
    x: 36 + (lon - p.minLongitude) * p.longitudeScale,
    y: 36 + (p.maxLatitude - lat) * p.latitudeScale,
  };
}
/** @param {string} id @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export function sectorPosition(id, context = null) {
  const places = campaignWorld(context).places,
    p = Object.hasOwn(places, id) ? places[id] : null;
  return p ? project(p.lon, p.lat, context) : null;
}
export function sectorIncome(state, def) {
  return incomeSources(state).find((source) => source.id === def.id)?.income ?? 0;
}
export const MAP_MODES = Object.freeze([
  { id: 'cities', label: 'Ciudades' },
  { id: 'resources', label: 'Recursos' },
  { id: 'squads', label: 'Tropas' },
  { id: 'militia', label: 'Milicias' },
  { id: 'horses', label: 'Caballos' },
  { id: 'items', label: 'Objetos' },
]);

// Enlarged urban footprints on one shared map grid. Districts share locality
// administration; world-cells.ts gives each physical tile its own scene key.
export const MAP_TILE_SIZE = CAMPAIGN_GRID.size;
/** @returns {Array<{id:string,sectorId:string,col:number,row:number,name:string,x:number,y:number,urban:boolean}>} */
/** @param {string} id @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export function mapTilesForSector(id, context = null) {
  const world = campaignWorld(context);
  return (Object.hasOwn(world.districts, id) ? world.districts[id] : []).map((tile) => ({
    ...tile,
  }));
}
export function mapTileBounds(tiles) {
  return {
    left: Math.min(...tiles.map((t) => t.x)),
    top: Math.min(...tiles.map((t) => t.y)),
    right: Math.max(...tiles.map((t) => t.x + MAP_TILE_SIZE)),
    bottom: Math.max(...tiles.map((t) => t.y + MAP_TILE_SIZE)),
  };
}
// Only external edges are emphasized; internal grid lines remain visible.
/** @returns {string} */
export function mapTileOutline(tiles) {
  const occupied = new Set(tiles.map((t) => `${t.col},${t.row}`));
  return tiles
    .flatMap((t) => [
      !occupied.has(`${t.col},${t.row - 1}`) ? `M${t.x},${t.y}h${MAP_TILE_SIZE}` : '',
      !occupied.has(`${t.col + 1},${t.row}`)
        ? `M${t.x + MAP_TILE_SIZE},${t.y}v${MAP_TILE_SIZE}`
        : '',
      !occupied.has(`${t.col},${t.row + 1}`)
        ? `M${t.x},${t.y + MAP_TILE_SIZE}h${MAP_TILE_SIZE}`
        : '',
      !occupied.has(`${t.col - 1},${t.row}`) ? `M${t.x},${t.y}v${MAP_TILE_SIZE}` : '',
    ])
    .filter(Boolean)
    .join(' ');
}
