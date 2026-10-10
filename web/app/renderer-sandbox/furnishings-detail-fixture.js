import {wallMovementBlocked,wallEdgesBetween} from '../../../game/wall-geometry.js';
import {createBattle,actBattle} from '../../../game/tactical.js';
import {placeBuilding} from '../../../game/buildings.js';
import {propBlocksAt} from '../../../game/props.js';

export const FURNISHINGS_DETAIL_SCENARIO=Object.freeze({id:'furnishings-detail',label:'Mobiliario',help:'Mesa, banco, cama y baúles cerrado y abierto junto al guardia. La cocina, el lavadero, la despensa, la oficina y el archivo muestran su mobiliario habitual. El guardia abrió las puertas y visitó las seis salas. Usa las órdenes normales para recorrerlas.'});
const buildingId='furnishings-detail-house',key=point=>`${point.x},${point.y}`;
const rooms=Object.freeze([
 {id:'main',name:'Dormitorio de muestra',purpose:'bedroom',x:5,y:5},
 {id:'kitchen',name:'Cocina',purpose:'kitchen',x:10,y:5},
 {id:'washroom',name:'Lavadero',purpose:'washroom',x:15,y:5},
 {id:'store',name:'Despensa',purpose:'store',x:5,y:11},
 {id:'office',name:'Oficina',purpose:'office',x:10,y:11},
 {id:'archive',name:'Archivo',purpose:'archive',x:15,y:11},
].map(room=>Object.freeze(room)));
const visits=Object.freeze([
 {room:'office',x:11,y:13},{room:'archive',x:16,y:13},{room:'washroom',x:16,y:7},
 {room:'kitchen',x:11,y:7},{room:'main',x:6,y:7},{room:'store',x:6,y:13},
 {room:'main',x:6,y:8},
].map(point=>Object.freeze(point)));

function freshBattle(){
 const width=24,height=20,ground=Array.from({length:width*height},(_,n)=>({x:n%width,y:Math.floor(n/width),type:'grass',cover:0,blocked:false}));
 const placed=placeBuilding(ground,{id:buildingId,name:'Casa del mobiliario',x:4,y:4,width:16,height:13,architecture:'house',doors:[{id:`${buildingId}:entrance`,x:11,y:17,axis:'x',open:false}]});
 const namedRooms=rooms.map((room,n)=>{const col=n%3,row=Math.floor(n/3),x=[4,9,14][col],y=[4,10][row],w=[5,5,6][col],h=[6,7][row];return {id:`${buildingId}:${room.id}`,name:room.name,purpose:room.purpose,cells:Array.from({length:w*h},(_,i)=>({x:x+i%w,y:y+Math.floor(i/w)}))};});
 const byCell=new Map(namedRooms.flatMap(room=>room.cells.map(cell=>[key(cell),room.id])));
 const tiles=placed.tiles.map(tile=>tile.type==='floor'?{...tile,roomId:byCell.get(key(tile))}:tile);
 const partitions=[];
 for(const x of [9,14])for(let y=4;y<17;y++)partitions.push({x,y,axis:'y',type:y===7||y===13?'door':'wall'});
 for(let x=4;x<20;x++)partitions.push({x,y:10,axis:'x',type:[6,11,16].includes(x)?'door':'wall'});
 const walls=[...placed.building.walls,...partitions.map(edge=>({...edge,id:`${buildingId}:partition:${edge.axis}:${key(edge)}`,blocked:true,blocksSight:true,cover:40,...(edge.type==='door'?{doorId:`${buildingId}:door:${edge.axis}:${key(edge)}`,open:false,locked:false}:{})}))];
 const tag={buildingId,roomId:`${buildingId}:main`,rotation:0,blocksMovement:true};
 const props=[
  {id:'detail-table',type:'table',x:5,y:5,footprint:{width:2,height:1},...tag},
  {id:'detail-bench',type:'bench',x:7,y:5,footprint:{width:2,height:1},...tag},
  {id:'detail-bed',type:'bed',x:5,y:7,footprint:{width:1,height:2},...tag},
  {id:'detail-chest-closed',type:'chest',x:8,y:6,footprint:{width:1,height:1},open:false,...tag},
  {id:'detail-chest-open',type:'chest',x:8,y:9,footprint:{width:1,height:1},open:true,...tag},
 ];
 const guard={id:'furnishings-detail-guard',name:'Mobiliario',nickname:'Mobiliario',x:11,y:18,facing:0,weapon:1800,loaded:1,ammo:12,blade:1810,activeSlot:'unarmed',condition:100,energy:100,agility:90,dexterity:85,strength:85,marksmanship:85,spriteAppearance:'granadero',skinTone:'brown',headwear:null,outfit:null,legwear:null};
 return createBattle([guard],{id:'renderer-furnishings-detail',name:'Mobiliario de la casa',width,height,tiles,buildings:[{...placed.building,walls,rooms:namedRooms}],props,enemies:[],exploration:true,seed:45});
}

/** Only normal movement and door orders discover these rooms. The returned
 * review trace records each order without adding fields to the battle save. */
export function createFurnishingsDetailReview(view='interior'){
 if(!['interior','exterior'].includes(view))throw Error(`Unknown furniture review view: ${view}`);
 let battle=freshBattle();const trace=[];
 if(view==='interior')for(const destination of visits){
  const start=battle.units[0],tiles=new Map(battle.tiles.map(tile=>[key(tile),tile])),queue=[{x:start.x,y:start.y}],previous=new Map([[key(start),null]]);
  for(let n=0;n<queue.length&&!previous.has(key(destination));n++)for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
   const point={x:queue[n].x+dx,y:queue[n].y+dy},tile=tiles.get(key(point));
   if(previous.has(key(point))||!tile||propBlocksAt(battle,point.x,point.y)||wallMovementBlocked(battle,queue[n],point,{openDoors:true})||tile.blocked&&(tile.type!=='door'||tile.locked))continue;
   previous.set(key(point),queue[n]);queue.push(point);
  }
  if(!previous.has(key(destination)))throw Error(`No legal furniture review route to ${destination.room}`);
  const path=[];for(let point={x:destination.x,y:destination.y};previous.get(key(point));point=previous.get(key(point)))path.unshift(point);
  const actions=[],before=[...battle.revealedRooms];
  const order=action=>{const next=actBattle(battle,action);if(next.lastError)throw Error(`Furniture review ${action.type}: ${next.lastError}`);battle=next;actions.push(action);};
  for(const point of path){
   const door=wallEdgesBetween(battle,battle.units.find(unit=>unit.id===start.id),point).find(edge=>edge.type==='door');
   if(door&&!door.open)order({type:'door',unitId:start.id,doorId:door.doorId,open:true});
   order({type:'move',unitId:start.id,...point});
  }
  trace.push({roomId:`${buildingId}:${destination.room}`,destination:{x:destination.x,y:destination.y},actions,newlyRevealed:battle.revealedRooms.filter(id=>!before.includes(id))});
 }
 return {battle:{...battle,deploymentComplete:true},visits:trace};
}
export function createFurnishingsDetailBattle(view='interior'){return createFurnishingsDetailReview(view).battle;}
