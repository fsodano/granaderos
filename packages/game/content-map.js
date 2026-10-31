import { campaignWorld } from './campaign-definition.js';
import { CAMPAIGN_GRID } from './world-grid.js';
// Same extent and origin as StrategicMap. The bottom row is partially visible.
export const CONTENT_MAP = {
  left: 36,
  top: 36,
  width: 648,
  height: 588,
  size: CAMPAIGN_GRID.size,
  columns: 36,
  rows: 33,
};
/** @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] */
export function contentCells(context = null) {
  return campaignWorld(context).cells.map(({ id, col, row, grid, name, x, y, district }) => ({
    id,
    col,
    row,
    grid,
    name,
    x,
    y,
    district,
  }));
}
export const CONTENT_CELLS = contentCells();
// Old packages used a whole locality. Use its first authored district as the
// explicit anchor when opening it in the cell editor; never invent outskirts.
/** @param {string[]} ids @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] @returns {string[]} */
export function contentCellIds(ids, context = null) {
  return [
    ...new Set(
      ids.map((id) => {
        const districts = campaignWorld(context).districts;
        const tile = Object.hasOwn(districts, id) ? districts[id][0] : null;
        return tile ? `cell-${tile.col}-${tile.row}` : id;
      }),
    ),
  ];
}
/** @param {string[]} ids @param {string} id @param {import('./public/compatibility-types.ts').CampaignContext | null} [context] @returns {string[]} */
export function toggleContentCell(ids, id, context = null) {
  if (!contentCells(context).some((c) => c.id === id)) {
    throw Error('La celda no existe en el mapa.');
  }
  const selected = contentCellIds(ids, context);
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}
