import type { ReactNode } from 'react';
import {
  getBuildingProfile,
  getBuildingRenderProfile,
} from '../../../packages/game/building-profile.ts';
import { BUILDING_OPENINGS } from '../../../packages/game/building-scale.js';
import { buildingStyle } from '../../../packages/game/building-types.ts';
import type {
  BattleBuilding,
  BattleSnapshot,
  BattleTile,
  BattleUnit,
  TacticalPoint,
} from '../../../packages/game/public/compatibility-types.ts';
import { pointInViewport } from '../../../packages/game/tactical-viewport.js';
import { canSee } from '../../../packages/game/tactical.js';
import {
  wallEdgeCells,
  wallEdgeCenter,
  wallEdgeEndpoints,
  wallEdgeId,
} from '../../../packages/game/wall-geometry.js';
import {
  ELEVATION_PIXELS_PER_METRE,
  projectSurface,
  surfaceDrawDepth,
} from '../lib/tactical-elevation';
import type { TacticalPointer, Viewport } from './tactical-ui-types';

type Args = {
  state: BattleSnapshot;
  players: BattleUnit[];
  revealed: Set<string>;
  cursorLevel: number;
  mode: string;
  interactive: boolean;
  hover: TacticalPointer | null;
  viewport: Viewport | undefined;
  project: (x: number, y: number) => { x: number; y: number };
  onTile: (point: TacticalPointer | null) => void;
  onHover: (point: TacticalPointer | null) => void;
  renderer?: 'svg' | 'three';
};
/** Match each renderer's visible wall height, including room cutaways. */
function controlHeight(
  state: BattleSnapshot,
  edge: BattleTile,
  building: BattleBuilding | undefined,
  base: number,
  adjacent: TacticalPoint[],
  known: Set<string>,
  renderer: 'svg' | 'three',
) {
  if (!building) {
    return renderer === 'three'
      ? (edge.obstacleHeight ?? 2.5) * ELEVATION_PIXELS_PER_METRE
      : getBuildingRenderProfile(undefined, known).wallHeight;
  }
  const kind = building.kind ?? (renderer === 'three' ? building.architecture : undefined),
    b = {
      ...building,
      ...(kind
        ? { kind: kind === 'estancia' ? 'farmhouse' : kind === 'mansion' ? 'palace' : kind }
        : {}),
    },
    legacy = Boolean(building.architecture && (!building.kind || building.roof === 'terrace'));
  const rooms = (b.rooms ?? []).filter(
      (room) => renderer === 'svg' || !(room.tacticalLevel ?? room.cells[0]?.tacticalLevel ?? 0),
    ),
    allOpen = rooms.length > 0 && rooms.every((room) => known.has(room.id)),
    someOpen = rooms.some((room) => known.has(room.id));
  const perimeter =
      edge.axis === 'x'
        ? edge.y === b.y || edge.y === b.y + b.height
        : edge.x === b.x || edge.x === b.x + b.width,
    front = edge.axis === 'x' ? edge.y === b.y + b.height : edge.x === b.x + b.width;
  const roomOpen =
    allOpen ||
    rooms.some(
      (room) =>
        known.has(room.id) &&
        room.cells.some((cell) => adjacent.some((at) => at.x === cell.x && at.y === cell.y)),
    );
  if (roomOpen && (front || !perimeter)) {
    return BUILDING_OPENINGS.cutawayHeight;
  }
  if (renderer === 'svg') {
    const shown = getBuildingRenderProfile(b, known);
    return legacy
      ? buildingStyle(b).height
      : perimeter
        ? shown.wallHeight
        : shown.groundFloorHeight;
  }
  const profile = getBuildingProfile(b),
    roofs = (state.upperSurfaces ?? []).filter(
      (surface) => surface.kind === 'roof' && surface.buildingId === b.id,
    );
  const fullHeight = roofs.length
      ? Math.min(...roofs.map((surface) => (surface.elevation ?? 3) - base))
      : Math.max(
          2.5,
          (legacy ? buildingStyle(b).height : profile.wallHeight) / ELEVATION_PIXELS_PER_METRE,
        ),
    floorHeight = roofs.length
      ? fullHeight
      : Math.min(fullHeight, Math.max(2.5, profile.groundFloorHeight / ELEVATION_PIXELS_PER_METRE));
  return (
    (perimeter && !(profile.floors > 1 && someOpen) ? fullHeight : floorHeight) *
    ELEVATION_PIXELS_PER_METRE
  );
}
/** Edge controls have their own target. Both adjacent cell centres remain selectable. */
export function wallEdgeControlObjects({
  state,
  players,
  revealed,
  cursorLevel,
  mode,
  interactive,
  hover,
  viewport,
  project,
  onTile,
  onHover,
  renderer = 'svg',
}: Args): { key: string; depth: number; node: ReactNode }[] {
  if (!interactive || !['move', 'useItem'].includes(mode)) {
    return [];
  }
  const known = new Set(revealed);
  if (cursorLevel) {
    const terraces = new Set(
      (state.upperSurfaces ?? [])
        .filter(
          (surface) => surface.kind === 'roof' && (surface.tacticalLevel ?? 0) === cursorLevel,
        )
        .map((surface) => surface.buildingId),
    );
    for (const building of state.buildings ?? []) {
      if (terraces.has(building.id)) {
        for (const room of building.rooms ?? []) {
          if (!(room.tacticalLevel ?? 0)) {
            known.delete(room.id);
          }
        }
      }
    }
  }
  return (state.wallEdges ?? [])
    .filter(
      (edge) =>
        !edge.destroyed &&
        (edge.tacticalLevel ?? 0) === cursorLevel &&
        ['wall', 'door', 'window'].includes(edge.type) &&
        players.some((player) => canSee(state, player, edge)),
    )
    .flatMap((edge) => {
      const center = wallEdgeCenter(edge),
        building = (state.buildings ?? []).find((record) => record.id === edge.buildingId);
      // Three uses the authored wall base; SVG artwork uses raw ground projection.
      const base = building
          ? ((state.tiles ?? []).find((tile) => tile.x === building.x && tile.y === building.y)
              ?.elevation ?? 0)
          : 0,
        elevation = edge.elevation ?? base;
      const wallPoint = (point: TacticalPoint) =>
        renderer === 'three'
          ? projectSurface(state, project, {
              ...point,
              renderedHeight: elevation,
              renderedOffset: { x: 0, y: 0, height: 0 },
            })
          : project(point.x, point.y);
      if (!pointInViewport(viewport, wallPoint(center), 150)) {
        return [];
      }
      const [start, end] = wallEdgeEndpoints(edge);
      if (!start || !end) {
        return [];
      }
      const a = wallPoint(start),
        b = wallPoint(end),
        id = wallEdgeId(edge),
        target = { ...edge, wallEdgeId: id },
        adjacent = wallEdgeCells(edge);
      const height = controlHeight(state, edge, building, base, adjacent, known, renderer);
      // A tall transparent wall face can cover a visible door farther back. Keep
      // solid walls selectable at their base without intercepting that door.
      const hitHeight =
        renderer === 'three' && edge.type === 'wall'
          ? Math.min(height, BUILDING_OPENINGS.cutawayHeight)
          : height;
      const label = `${edge.type === 'door' ? 'Puerta' : edge.type === 'window' ? 'Ventana' : 'Pared'} entre ${adjacent.map((at) => `${at.x},${at.y}`).join(' y ')}${edge.type === 'door' ? (edge.open ? ', abierta' : ', cerrada') : ''}`;
      return [
        {
          key: `edge-control-${id}`,
          depth:
            renderer === 'three'
              ? surfaceDrawDepth(state, center, 0.02)
              : center.x + center.y + 0.02,
          node: (
            <g
              data-wall-edge-control={id}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG geometry requires its accessible role.
              role="button"
              tabIndex={0}
              aria-label={label}
              onClick={() => onTile(target)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onTile(target);
                }
              }}
              onMouseEnter={() => onHover(target)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(target)}
              onBlur={() => onHover(null)}
            >
              <path
                d={`M${a.x},${a.y}L${b.x},${b.y}L${b.x},${b.y - hitHeight}L${a.x},${a.y - hitHeight}Z`}
                fill="transparent"
                pointerEvents="all"
              />
              {hover?.wallEdgeId === id && (
                <path
                  d={`M${a.x},${a.y}L${b.x},${b.y}`}
                  fill="none"
                  stroke="#eddda3"
                  strokeWidth="3"
                  pointerEvents="none"
                />
              )}
            </g>
          ),
        },
      ];
    });
}
