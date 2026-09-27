import { CAMPAIGN_SECTORS } from "./data.js";
import { MAP_TILE_SIZE, mapTilesForSector } from "./strategic-map.js";
// Same extent and origin as StrategicMap. The bottom row is partially visible.
export const CONTENT_MAP = {
  left: 36,
  top: 36,
  width: 648,
  height: 588,
  size: MAP_TILE_SIZE,
  columns: 36,
  rows: 33,
};
const districts = CAMPAIGN_SECTORS.flatMap((sector) =>
  mapTilesForSector(sector.id).map((tile) => ({ ...tile, sectorName: sector.name })),
);
export const CONTENT_CELLS = Array.from(
  { length: CONTENT_MAP.columns * CONTENT_MAP.rows },
  (_, i) => {
    const col = i % CONTENT_MAP.columns,
      row = Math.floor(i / CONTENT_MAP.columns);
    const district = districts.find((d) => d.col === col && d.row === row);
    const grid = `${col + 1},${row + 1}`;
    return {
      id: `cell-${col}-${row}`,
      col,
      row,
      grid,
      name: `Celda ${grid}${district ? ` · ${district.sectorName} · ${district.name}` : ""}`,
      x: 36 + col * MAP_TILE_SIZE,
      y: 36 + row * MAP_TILE_SIZE,
      district: Boolean(district),
    };
  },
);
// Old packages used a whole locality. Use its first authored district as the
// explicit anchor when opening it in the cell editor; never invent outskirts.
export function contentCellIds(ids) {
  return [
    ...new Set(
      ids.map((id) => {
        const tile = mapTilesForSector(id)[0];
        return tile ? `cell-${tile.col}-${tile.row}` : id;
      }),
    ),
  ];
}
export function toggleContentCell(ids, id) {
  if (!CONTENT_CELLS.some((c) => c.id === id)) throw Error("La celda no existe en el mapa.");
  const selected = contentCellIds(ids);
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}
