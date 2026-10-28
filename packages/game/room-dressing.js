import {wallEdgeCells} from './wall-geometry.js';
import {propCells} from './props.js';
import {spaceKey,tacticalLevel} from './tactical-space.js';

// Small wall-side objects and floor treatments add place and use to rooms.
// They are visual dressing: authored collision and furniture remain unchanged.
const NAMED_PROFILES={
 archive:{purpose:'archive',floor:'wood',details:['shelf','chest','candle']},
 office:{purpose:'office',floor:'wood',details:['shelf','candle','rug']},
 reception:{purpose:'reception',floor:'floor',details:['rug','candle','pottery']},
 bedroom:{purpose:'bedroom',floor:'wood',details:['rug','candle','shelf']},
 kitchen:{purpose:'kitchen',floor:'cobble',details:['hearth','shelf','pottery','candle']},
 washroom:{purpose:'washroom',floor:'cobble',details:['washstand','pottery','shelf']},
 store:{purpose:'store',floor:'dirt',details:['sacks','shelf','pottery']},
 workshop:{purpose:'workshop',floor:'cobble',details:['hearth','shelf','sacks']},
};
const nameRules=[
 ['archive',/\b(archivo|archive)\b/],
 ['office',/\b(despacho|contaduria|secretaria|oficina|office|study)\b/],
 ['bedroom',/\b(dormitorio|alcoba|camara|huespedes|bedroom|chamber)\b/],
 ['washroom',/\b(lavadero|lavatorio|aseo|bano|washroom)\b/],
 ['kitchen',/\b(cocina|kitchen)\b/],
 ['store',/\b(despensa|almacen|deposito|mercaderias|pantry|stock|store)\b/],
 ['workshop',/\b(forja|taller|herreria|workshop)\b/],
 ['reception',/\b(recepcion|salon|concejo|reception|council)\b|\bsala familiar\b/],
];
function namedProfile(room){
 // Names survive the map compiler. IDs and room order are not semantic labels.
 if(Object.hasOwn(NAMED_PROFILES,room.purpose))return NAMED_PROFILES[room.purpose];
 const name=typeof room.name==='string'?room.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase():'';
 const purpose=nameRules.find(([,pattern])=>pattern.test(name))?.[0];
 return purpose?NAMED_PROFILES[purpose]:null;
}
export function roomDecorProfile(building,room,index=0){
 const kind=building.kind??building.architecture??'house';
 if(building.ruined||building.ruin||room.ruined||/ruin/.test(kind))return {purpose:'ruin',floor:'stone',details:['rubble','broken-timber','pottery']};
 const named=namedProfile(room);if(named)return {...named,details:[...named.details]};
 if(['warehouse','depot','stable'].includes(kind))return {purpose:'store',floor:'dirt',details:['sacks','shelf','pottery']};
 if(['smithy'].includes(kind))return {purpose:'workshop',floor:'cobble',details:['hearth','shelf','sacks']};
 if(['church','chapel','cabildo','townhall','palace','barracks'].includes(kind)&&index===0)return {purpose:'hall',floor:'floor',details:['shelf','rug','candle']};
 if(index%3===1)return {purpose:'washroom',floor:'cobble',details:['washstand','pottery','shelf']};
 if(index%3===2)return {purpose:'quarters',floor:'wood',details:['rug','shelf','candle']};
 return {purpose:'kitchen',floor:'cobble',details:['hearth','shelf','pottery','candle']};
}

export function roomDressings(state){
 const occupied=new Set((state.props??[]).flatMap(propCells).map(spaceKey)),dressings=[];
 const surfaces=[...(state.tiles??[]),...(state.upperSurfaces??[])],floor=new Map(surfaces.map(tile=>[spaceKey(tile),tile]));
 const doors=surfaces.filter(tile=>tile.type==='door'),doorApproaches=new Set((state.wallEdges??[]).filter(w=>w.type==='door').flatMap(wallEdgeCells).map(spaceKey));
 for(const building of state.buildings??[])for(const [index,room]of (building.rooms??[]).entries()){
  if((room.cells?.length??0)<4)continue;
  const profile=roomDecorProfile(building,room,index),cells=room.cells.map(cell=>({...cell,tacticalLevel:cell.tacticalLevel??room.tacticalLevel??0}));
  const roomCells=new Set(cells.map(spaceKey));
  const boundary=cells.filter(cell=>!roomCells.has(spaceKey({...cell,x:cell.x-1}))||!roomCells.has(spaceKey({...cell,y:cell.y-1})));
  const candidates=[...new Map(boundary.map(cell=>[spaceKey(cell),cell])).values()].filter(cell=>{
   const tile=floor.get(spaceKey(cell));
   return tile&&!tile.blocked&&!['wall','window','door'].includes(tile.type)&&!occupied.has(spaceKey(cell))&&!doorApproaches.has(spaceKey(cell))&&!doors.some(door=>tacticalLevel(door)===tacticalLevel(cell)&&Math.abs(door.x-cell.x)+Math.abs(door.y-cell.y)<=1);
  }).sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
  const count=Math.min(candidates.length,profile.details.length,Math.max(1,Math.floor(cells.length/5)));
  for(let i=0;i<count;i++){
   const cell=candidates[Math.floor(i*candidates.length/count)];
   dressings.push({id:`${room.id}:dressing-${i}`,type:profile.details[i],...cell,roomId:room.id,buildingId:building.id,purpose:profile.purpose,decorative:true,blocksMovement:false,footprint:{width:1,height:1}});
   occupied.add(spaceKey(cell));
  }
 }
 return dressings;
}
