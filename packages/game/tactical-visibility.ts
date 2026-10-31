import type { BuildingReadModel, BuildingRoomReadModel } from './public/building-types.ts';
import type { BattleTile, TacticalPoint } from './public/compatibility-types.ts';
type RoomTerrain = {
  buildings?: readonly BuildingReadModel[] | undefined;
  tiles: readonly BattleTile[];
  upperSurfaces?: readonly BattleTile[] | undefined;
  width: number;
  height: number;
};
type RoomEntry = {
  room: BuildingRoomReadModel;
  id: string;
  level: number | undefined;
  cells: readonly TacticalPoint[];
  size: number;
  levels: Set<number>;
};
type RoomIndex = {
  buildings: readonly BuildingReadModel[];
  structures: {
    building: BuildingReadModel;
    rooms: readonly BuildingRoomReadModel[];
    entries: RoomEntry[];
  }[];
  byCell: Map<string, BuildingRoomReadModel>;
  byId: Map<string, RoomEntry>;
};
// Interior contents follow room discovery, independently of neighbouring rooms.
// Resolve cells as well as IDs so legacy props cannot leak through an absent tag.
import { spaceKey, surfaceAt, tacticalLevel } from './tactical-space.js';
const roomIndexes = new WeakMap<RoomTerrain, RoomIndex>();
const emptyBuildings: BuildingReadModel[] = [];
const emptyRooms: BuildingRoomReadModel[] = [];

// Simulation snapshots own their room topology. Keep only weak references to
// snapshots, and invalidate when authored arrays or their ordered rooms change.
// Editing cell coordinates or levels requires a fresh snapshot or cells array.
function roomIndex(state: RoomTerrain) {
  const buildings = state.buildings ?? emptyBuildings,
    previous = roomIndexes.get(state);
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
  const byCell = new Map<string, BuildingRoomReadModel>(),
    byId = new Map<string, RoomEntry>();
  const structures = buildings.map((building) => {
    const rooms = building.rooms ?? emptyRooms;
    const entries = rooms.map((room) => {
      const levels = new Set<number>(),
        entry = {
          room,
          id: room.id,
          level: room.tacticalLevel,
          cells: room.cells,
          size: room.cells?.length ?? 0,
          levels,
        };
      for (const cell of room.cells ?? []) {
        const level = cell.tacticalLevel ?? room.tacticalLevel ?? 0,
          key = spaceKey({ ...cell, tacticalLevel: level });
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
  const index = { buildings, structures, byCell, byId };
  roomIndexes.set(state, index);
  return index;
}
const pointKey = (point: TacticalPoint) =>
  spaceKey({ x: Math.round(point.x), y: Math.round(point.y), tacticalLevel: tacticalLevel(point) });
export function roomAt(
  state: RoomTerrain,
  point: TacticalPoint,
): BuildingRoomReadModel | undefined {
  return roomIndex(state).byCell.get(pointKey(point));
}

export function isInteriorVisible(
  state: RoomTerrain,
  point: TacticalPoint & { roomId?: string | null; buildingId?: string | null },
  revealed: ReadonlySet<string>,
): boolean {
  const index = roomIndex(state),
    room = index.byCell.get(pointKey(point));
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
