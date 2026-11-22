import {
  sameCell,
  spaceKey,
  tacticalLevel,
  validTacticalLevel,
} from '../sector-sessions/tactical-space.ts';

// Interior contents follow room discovery, independently of neighbouring rooms.
// Resolve cells as well as IDs so legacy props cannot leak through an absent tag.
export type InteriorPoint = Readonly<{
  x: number;
  y: number;
  tacticalLevel?: number | undefined;
}>;

export type InteriorSurface = InteriorPoint &
  Readonly<{
    kind?: string | undefined;
    roomId?: string | null | undefined;
  }>;

export type InteriorRoom = Readonly<{
  id: string;
  cells?: readonly InteriorPoint[] | undefined;
  tacticalLevel?: number | undefined;
}>;

export type InteriorBuilding = Readonly<{
  id: string;
  rooms?: readonly InteriorRoom[] | undefined;
}>;

/** The map records the rule reads: buildings with rooms, and their surfaces. */
export type InteriorTerrain = Readonly<{
  buildings?: readonly InteriorBuilding[] | undefined;
  tiles: readonly InteriorSurface[];
  upperSurfaces?: readonly InteriorSurface[] | undefined;
  width: number;
  height: number;
}>;

export type InteriorTaggedPoint = InteriorPoint &
  Readonly<{
    roomId?: string | null | undefined;
    buildingId?: string | null | undefined;
  }>;

type RoomEntry = Readonly<{
  room: InteriorRoom;
  id: string;
  level: number | undefined;
  cells: readonly InteriorPoint[] | undefined;
  size: number;
  levels: ReadonlySet<number>;
}>;

type RoomStructure = Readonly<{
  building: InteriorBuilding;
  rooms: readonly InteriorRoom[];
  entries: readonly RoomEntry[];
}>;

type RoomIndex = Readonly<{
  buildings: readonly InteriorBuilding[];
  structures: readonly RoomStructure[];
  byCell: ReadonlyMap<string, InteriorRoom>;
  byId: ReadonlyMap<string, RoomEntry>;
}>;

const upperSurfaceIndexes = new WeakMap<readonly InteriorSurface[], Map<string, InteriorSurface>>();

function surfaceAt(
  state: InteriorTerrain,
  point: InteriorPoint | null | undefined,
): InteriorSurface | null {
  if (
    !point ||
    !Number.isInteger(point.x) ||
    !Number.isInteger(point.y) ||
    !validTacticalLevel(tacticalLevel(point))
  ) {
    return null;
  }
  if (point.x < 0 || point.y < 0 || point.x >= state.width || point.y >= state.height) {
    return null;
  }
  if (tacticalLevel(point) === 0) {
    const candidate = state.tiles[point.y * state.width + point.x];
    return candidate && sameCell(candidate, point)
      ? candidate
      : (state.tiles.find((tile) => sameCell(tile, point)) ?? null);
  }
  if (!Array.isArray(state.upperSurfaces)) {
    return null;
  }
  const surfaces: readonly InteriorSurface[] = state.upperSurfaces;
  let index = upperSurfaceIndexes.get(surfaces);
  if (!index) {
    index = new Map<string, InteriorSurface>(
      surfaces.map((surface): [string, InteriorSurface] => [spaceKey(surface), surface]),
    );
    upperSurfaceIndexes.set(surfaces, index);
  }
  return index.get(spaceKey(point)) ?? null;
}

const roomIndexes = new WeakMap<InteriorTerrain, RoomIndex>();
const emptyBuildings: readonly InteriorBuilding[] = [];
const emptyRooms: readonly InteriorRoom[] = [];

// Simulation snapshots own their room topology. Keep only weak references to
// snapshots, and invalidate when authored arrays or their ordered rooms change.
// Editing cell coordinates or levels requires a fresh snapshot or cells array.
function roomIndex(state: InteriorTerrain): RoomIndex {
  const buildings = state.buildings ?? emptyBuildings;
  const previous = roomIndexes.get(state);
  if (
    previous &&
    previous.buildings === buildings &&
    previous.structures.length === buildings.length &&
    previous.structures.every((record, i) => {
      const building = buildings[i];
      if (!building) {
        return false;
      }
      const rooms = building.rooms ?? emptyRooms;
      return (
        record.building === building &&
        record.rooms === rooms &&
        record.entries.length === rooms.length &&
        record.entries.every((entry, j) => {
          const room = rooms[j];
          if (!room) {
            return false;
          }
          return (
            entry.room === room &&
            entry.id === room.id &&
            entry.level === room.tacticalLevel &&
            entry.cells === room.cells &&
            entry.size === (room.cells?.length ?? 0)
          );
        })
      );
    })
  ) {
    return previous;
  }
  const byCell = new Map<string, InteriorRoom>();
  const byId = new Map<string, RoomEntry>();
  const structures = buildings.map((building) => {
    const rooms = building.rooms ?? emptyRooms;
    const entries = rooms.map((room) => {
      const levels = new Set<number>();
      const entry: RoomEntry = {
        room,
        id: room.id,
        level: room.tacticalLevel,
        cells: room.cells,
        size: room.cells?.length ?? 0,
        levels,
      };
      for (const cell of room.cells ?? []) {
        const level = cell.tacticalLevel ?? room.tacticalLevel ?? 0;
        const key = spaceKey({ ...cell, tacticalLevel: level });
        levels.add(level);
        if (!byCell.has(key)) {
          byCell.set(key, room);
        }
      }
      if (!byId.has(room.id)) {
        byId.set(room.id, entry);
      }
      return entry;
    });
    return { building, rooms, entries };
  });
  const index: RoomIndex = { buildings, structures, byCell, byId };
  roomIndexes.set(state, index);
  return index;
}

const pointKey = (point: InteriorPoint): string =>
  spaceKey({ x: Math.round(point.x), y: Math.round(point.y), tacticalLevel: tacticalLevel(point) });

export function roomAt(state: InteriorTerrain, point: InteriorPoint): InteriorRoom | undefined {
  return roomIndex(state).byCell.get(pointKey(point));
}

export function isInteriorVisible(
  state: InteriorTerrain,
  point: InteriorTaggedPoint,
  revealed: ReadonlySet<string>,
): boolean {
  const index = roomIndex(state);
  const room = index.byCell.get(pointKey(point));
  const tile = surfaceAt(state, { ...point, x: Math.round(point.x), y: Math.round(point.y) });
  const taggedRoom = point.roomId && index.byId.get(point.roomId);
  const inheritedGroundRoom =
    tacticalLevel(point) > 0 && taggedRoom && !taggedRoom.levels.has(tacticalLevel(point));
  const roomId = room?.id ?? tile?.roomId ?? (inheritedGroundRoom ? undefined : point.roomId);
  if (roomId) {
    return revealed.has(roomId);
  }
  // An interior prop with invalid membership stays hidden, not building-wide.
  if (point.buildingId && (!tacticalLevel(point) || tile?.kind !== 'roof')) {
    return false;
  }
  return true;
}
