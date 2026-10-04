import {propCells} from './props.js';
import {spaceKey,tacticalLevel} from './tactical-space.js';

// Small wall-side objects and floor treatments add place and use to rooms.
// They are visual dressing: authored collision and furniture remain unchanged.
export function roomDecorProfile(building,room,index=0){
 const kind=building.kind??building.architecture??'house';
 if(building.ruined||building.ruin||room.ruined||/ruin/.test(kind))return {purpose:'ruin',floor:'stone',details:['rubble','broken-timber','pottery']};
 if(['warehouse','depot','stable'].includes(kind))return {purpose:'store',floor:'dirt',details:['sacks','shelf','pottery']};
 if(['smithy'].includes(kind))return {purpose:'workshop',floor:'cobble',details:['hearth','shelf','sacks']};
 if(['church','chapel','cabildo','townhall','palace','barracks'].includes(kind)&&index===0)return {purpose:'hall',floor:'floor',details:['shelf','rug','candle']};
 if(index%3===1)return {purpose:'washroom',floor:'cobble',details:['washstand','pottery','shelf']};
 if(index%3===2)return {purpose:'quarters',floor:'wood',details:['rug','shelf','candle']};
 return {purpose:'kitchen',floor:'cobble',details:['hearth','shelf','pottery','candle']};
}

export function roomDressings(state){
 const occupied=new Set((state.props??[]).flatMap(propCells).map(spaceKey)),dressings=[];
 const doors=(state.tiles??[]).filter(tile=>tile.type==='door');
 for(const building of state.buildings??[])for(const [index,room]of (building.rooms??[]).entries()){
  if((room.cells?.length??0)<4)continue;
  const profile=roomDecorProfile(building,room,index),cells=room.cells.map(cell=>({...cell,tacticalLevel:cell.tacticalLevel??room.tacticalLevel??0}));
  const boundary=cells.filter(cell=>!cells.some(other=>other.x===cell.x-1&&other.y===cell.y)||!cells.some(other=>other.y===cell.y-1&&other.x===cell.x));
  const candidates=boundary.filter(cell=>!occupied.has(spaceKey(cell))&&!doors.some(door=>tacticalLevel(door)===tacticalLevel(cell)&&Math.abs(door.x-cell.x)+Math.abs(door.y-cell.y)<=1)).sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
  const count=Math.min(candidates.length,profile.details.length,Math.max(1,Math.floor(cells.length/5)));
  for(let i=0;i<count;i++){
   const cell=candidates[Math.floor(i*candidates.length/count)];
   dressings.push({id:`${room.id}:dressing-${i}`,type:profile.details[i],...cell,roomId:room.id,buildingId:building.id,purpose:profile.purpose,decorative:true,blocksMovement:false,footprint:{width:1,height:1}});
  }
 }
 return dressings;
}
