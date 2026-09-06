// Interior contents follow room discovery, independently of neighbouring rooms.
// Resolve cells as well as IDs so legacy props cannot leak through an absent tag.
export function roomAt(state, point) {
  return (state.buildings ?? []).flatMap(building => building.rooms ?? [])
    .find(room => room.cells?.some(cell => cell.x === Math.round(point.x) && cell.y === Math.round(point.y)));
}

export function isInteriorVisible(state, point, revealed) {
  const room = roomAt(state, point);
  const tile = state.tiles?.find(tile => tile.x === Math.round(point.x) && tile.y === Math.round(point.y));
  const roomId = room?.id ?? tile?.roomId ?? point.roomId;
  if (roomId) return revealed.has(roomId);
  // An interior prop with invalid membership stays hidden, not building-wide.
  if (point.buildingId) return false;
  return true;
}
