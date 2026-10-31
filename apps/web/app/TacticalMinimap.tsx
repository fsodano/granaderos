'use client';

import { useMemo } from 'react';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';
import { sceneWallEdges } from '../../../packages/game/scene-wall-edges.js';
import { tacticalMinimapLabel } from '../../../packages/game/tactical-minimap-label.js';
import { tacticalLevel } from '../../../packages/game/tactical-space.js';
import { isInteriorVisible } from '../../../packages/game/tactical-visibility.ts';
import { canSee, visibleRooms } from '../../../packages/game/tactical.js';
type Props = {
  state: BattleSnapshot;
  units: BattleUnit[];
  selected: string | undefined;
  project: (x: number, y: number) => { x: number; y: number };
  width: number;
  height: number;
  camera: { x: number; y: number; width: number; height: number };
  onCenter: (x: number, y: number) => void;
};
const terrainColors: Record<string, string> = {
  grass: '#73744c',
  forest: '#3c5439',
  scrub: '#697249',
  road: '#a08b5c',
  floor: '#9d8061',
  water: '#4b7271',
  wall: '#c0b592',
  window: '#a89e7c',
  door: '#786344',
  stone: '#777662',
  mud: '#74644b',
};

export default function TacticalMinimap({
  state,
  units,
  selected,
  project,
  width,
  height,
  camera,
  onCenter,
}: Props) {
  const label = tacticalMinimapLabel(state);
  const revealed = useMemo(
    () => new Set([...(state.revealedRooms ?? []), ...visibleRooms(state)]),
    [state],
  );
  const players = useMemo(() => state.units.filter((u) => u.side === 'player'), [state]);
  const wallEdges = useMemo(() => {
    const level = tacticalLevel(state.units.find((u) => u.id === selected));
    return (sceneWallEdges(state, players) ?? [])
      .filter((edge) => tacticalLevel(edge) === level && !edge.destroyed && edge.type !== 'rubble')
      .map((edge) => {
        const a = project(edge.x - 0.5, edge.y - 0.5),
          b = project(
            edge.x + (edge.axis === 'x' ? 0.5 : -0.5),
            edge.y + (edge.axis === 'y' ? 0.5 : -0.5),
          );
        return (
          <path
            key={edge.id ?? `${edge.axis}:${edge.x},${edge.y}`}
            data-minimap-wall-edge={edge.id}
            d={`M${a.x},${a.y}L${b.x},${b.y}`}
            fill="none"
            stroke={edge.type === 'door' ? (edge.open ? '#bfac76' : '#786344') : '#c0b592'}
            strokeWidth="4"
          />
        );
      });
  }, [state, players, project, selected]);
  // One compound path per color replaces thousands of independent mini tiles.
  const terrain = useMemo(() => {
    const paths = new Map<string, string[]>();
    for (const t of state.tiles) {
      const p = project(t.x, t.y),
        color = !isInteriorVisible(state, t, revealed)
          ? '#685037'
          : (terrainColors[t.type] ?? '#736f51');
      const colorPaths = paths.get(color) ?? [];
      colorPaths.push(`M${p.x},${p.y - 14}l26,14-26,14-26,-14Z`);
      paths.set(color, colorPaths);
    }
    return [...paths].map(([color, paths]) => <path key={color} d={paths.join('')} fill={color} />);
  }, [state, project, revealed]);
  const markers = useMemo(
    () =>
      units
        .filter(
          (u) =>
            u.hp > 0 &&
            !u.fled &&
            isInteriorVisible(state, u, revealed) &&
            (u.side === 'player' || players.some((p) => canSee(state, p, u))),
        )
        .map((u) => {
          const p = project(u.x, u.y);
          return (
            <circle
              key={u.id}
              cx={p.x}
              cy={p.y}
              r={u.id === selected ? 11 : 7}
              fill={u.side === 'player' ? '#dcdf9d' : '#d7755a'}
            />
          );
        }),
    [state, units, revealed, players, project, selected],
  );
  return (
    <svg
      className="tactical-minimap"
      viewBox={`0 0 ${width} ${height}`}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG geometry requires its accessible role.
      role="button"
      tabIndex={0}
      aria-label={`Minimapa: ${label.sectorCode} · ${label.sectorName} · Día ${label.day}, ${label.time}. Clic para centrar; flechas para desplazar la cámara.`}
      onClick={(e) => {
        const matrix = e.currentTarget.getScreenCTM();
        if (!matrix) {
          return;
        }
        const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
        onCenter(point.x, point.y);
      }}
      onKeyDown={(e) => {
        const offsets: Record<string, [number, number]> = {
          ArrowLeft: [-80, 0],
          ArrowRight: [80, 0],
          ArrowUp: [0, -60],
          ArrowDown: [0, 60],
        };
        const d = offsets[e.key];
        if (d) {
          e.preventDefault();
          e.stopPropagation();
          onCenter(camera.x + camera.width / 2 + d[0], camera.y + camera.height / 2 + d[1]);
        }
      }}
    >
      <title>{`${label.sectorCode} · ${label.sectorName} · Día ${label.day}, ${label.time}`}</title>
      <rect width={width} height={height} fill="#17211a" />
      {terrain}

      {wallEdges}
      {markers}
      <rect
        x={camera.x}
        y={camera.y}
        width={camera.width}
        height={camera.height}
        fill="none"
        stroke="#ded387"
        strokeWidth="6"
      />
    </svg>
  );
}
