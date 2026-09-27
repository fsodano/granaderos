'use client';
import { useId, useState } from 'react';
import geography from '../../../game/strategic-geography.json';
import {
  project,
  MAP_PLACES,
  mapTilesForSector,
} from '../../../game/strategic-map.js';
import {
  CONTENT_CELLS,
  CONTENT_MAP,
  contentCellIds,
  toggleContentCell,
} from '../../../game/content-map.js';
function path(geometry: any): string {
  const lines =
    geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat()
      : geometry.type === 'Polygon' || geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : [geometry.coordinates];
  return lines
    .map(
      (ring: number[][]) =>
        ring
          .map(([lon, lat], i) => {
            const p = project(lon, lat);
            return `${i ? 'L' : 'M'}${p.x},${p.y}`;
          })
          .join('') + (geometry.type.includes('Polygon') ? 'Z' : ''),
    )
    .join('');
}
export default function PlacementMap({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const clip = useId();
  const [focused, setFocused] = useState('cell-0-0');
  const [hovered, setHovered] = useState('');
  const chosen = new Set<string>(contentCellIds(selected));
  function toggle(id: string) {
    onChange(toggleContentCell(selected, id));
  }
  return (
    <div className="placement-map">
      <p>
        Hacé clic en cualquier celda para marcarla con una X. Otro clic la
        desmarca. Podés elegir celdas separadas, dentro o fuera de las
        localidades.
      </p>
      <div className="toolbar">
        <strong>{chosen.size} celdas seleccionadas</strong>
        <button disabled={!chosen.size} onClick={() => onChange([])}>
          Quitar todas
        </button>
      </div>
      <div className="placement-map-scroll">
        <svg
          viewBox="0 0 720 655"
          role="group"
          aria-label="Elegir celdas de aparición en el mapa"
        >
          <defs>
            <clipPath id={clip}>
              <rect x="36" y="36" width="648" height="588" />
            </clipPath>
          </defs>
          <rect width="720" height="655" fill="#18211e" />
          <g clipPath={`url(#${clip})`}>
            <rect x="36" y="36" width="648" height="588" fill="#25454d" />
            {geography.land.map((g: any, i: number) => (
              <path key={i} d={path(g)} fill="#69704c" />
            ))}
            {geography.rivers.map((g: any, i: number) => (
              <path
                key={i}
                d={path(g)}
                fill="none"
                stroke="#80b1b6"
                strokeWidth="2"
              />
            ))}
            {CONTENT_CELLS.map((cell) => (
              <g
                key={cell.id}
                role="button"
                aria-label={cell.name}
                aria-pressed={chosen.has(cell.id)}
                tabIndex={focused === cell.id ? 0 : -1}
                onFocus={() => {
                  setFocused(cell.id);
                  setHovered(cell.name);
                }}
                onMouseEnter={() => setHovered(cell.name)}
                onClick={() => {
                  setFocused(cell.id);
                  toggle(cell.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(cell.id);
                    return;
                  }
                  const step: Record<string, number[]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  if (step[e.key]) {
                    e.preventDefault();
                    const [dx, dy] = step[e.key];
                    const col = Math.max(0, Math.min(35, cell.col + dx)),
                      row = Math.max(0, Math.min(32, cell.row + dy));
                    const next = `cell-${col}-${row}`;
                    setFocused(next);
                    e.currentTarget.parentElement
                      ?.querySelector<SVGGElement>(`[data-cell="${next}"]`)
                      ?.focus();
                  }
                }}
                data-cell={cell.id}
              >
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={CONTENT_MAP.size}
                  height={Math.min(CONTENT_MAP.size, 624 - cell.y)}
                  fill={
                    chosen.has(cell.id)
                      ? '#e8cd6b'
                      : cell.district
                        ? '#b89b68'
                        : 'transparent'
                  }
                  fillOpacity={
                    chosen.has(cell.id) ? 0.6 : cell.district ? 0.75 : 1
                  }
                  stroke="#192b22"
                  strokeWidth=".7"
                />
                {chosen.has(cell.id) && (
                  <path
                    d={`M${cell.x + 4},${cell.y + 3}l10,8m0,-8l-10,8`}
                    stroke="#fff5be"
                    strokeWidth="2.3"
                    pointerEvents="none"
                  />
                )}
                <title>{cell.name}</title>
              </g>
            ))}
            <g
              pointerEvents="none"
              fill="#fff2c5"
              fontSize="9"
              stroke="#18211e"
              strokeWidth="2.5"
              paintOrder="stroke"
            >
              {Object.entries(MAP_PLACES).map(([id, place]) => {
                const tile = mapTilesForSector(id)[0];
                return (
                  <text key={id} x={tile.x} y={tile.y - 4}>
                    {place.label}
                  </text>
                );
              })}
            </g>
          </g>
          {Array.from({ length: 36 }, (_, col) => (
            <text
              key={col}
              x={45 + col * 18}
              y="27"
              textAnchor="middle"
              fill="#d7ddcc"
              fontSize="9"
            >
              {col + 1}
            </text>
          ))}
          {Array.from({ length: 33 }, (_, row) => (
            <text
              key={row}
              x="26"
              y={48 + row * 18}
              textAnchor="end"
              fill="#d7ddcc"
              fontSize="9"
            >
              {row + 1}
            </text>
          ))}
        </svg>
      </div>
      <p role="status">
        {hovered || 'Columnas y filas de la cuadrícula del mapa.'}
      </p>
      <small>
        Teclado: flechas para recorrer las celdas; espacio para marcar. Estas
        ubicaciones se usan en las pruebas del editor; su integración en la
        campaña sigue pendiente.
      </small>
    </div>
  );
}
