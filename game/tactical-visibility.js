// Interior contents follow room discovery, independently of neighbouring rooms.
// Resolve cells as well as IDs so legacy props cannot leak through an absent tag.
import {sameCell, surfaceAt, tacticalLevel} from './tactical-space.js';
export function roomAt(state, point) {
  return (state.buildings ?? []).flatMap(building => building.rooms ?? [])
    .find(room => room.cells?.some(cell => sameCell({...cell,tacticalLevel:cell.tacticalLevel??room.tacticalLevel??0},{...point,x:Math.round(point.x),y:Math.round(point.y)})));
}

export function isInteriorVisible(state, point, revealed) {
  const room = roomAt(state, point);
  const tile = surfaceAt(state,{...point,x:Math.round(point.x),y:Math.round(point.y)});
  const taggedRoom=point.roomId&&(state.buildings??[]).flatMap(building=>building.rooms??[]).find(room=>room.id===point.roomId);
  const inheritedGroundRoom=tacticalLevel(point)>0&&taggedRoom&&!taggedRoom.cells?.some(cell=>tacticalLevel({...cell,tacticalLevel:cell.tacticalLevel??taggedRoom.tacticalLevel??0})===tacticalLevel(point));
  const roomId = room?.id ?? tile?.roomId ?? (inheritedGroundRoom?undefined:point.roomId);
  if (roomId) return revealed.has(roomId);
  // An interior prop with invalid membership stays hidden, not building-wide.
  if (point.buildingId && (!tacticalLevel(point)||tile?.kind!=='roof')) return false;
  return true;
}
