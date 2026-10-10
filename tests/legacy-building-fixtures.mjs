// Historical renderer regressions keep their original cell-centred reference
// geometry. Native edge geometry is tested in wall-edge-renderer.test.mjs.
import {BUILDING_TEMPLATES} from '../game/map-templates.js';
import {BUILDING_TYPES} from '../game/building-types.js';
import {buildTerrace} from '../game/buildings.js';

export function buildBuilding({id,x,y,width,height,name=id,doors=[],windows=[],material='adobe',architecture='house',roof=BUILDING_TYPES[architecture]?.roof??'tile'}){
 const roomId=`${id}:interior`,tiles=[],cells=[];
 for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){
  const edge=col===x||col===x+width-1||row===y||row===y+height-1;
  tiles.push({x:col,y:row,type:edge?'wall':'floor',blocked:edge,blocksSight:edge,cover:edge?40:0,material,buildingId:id,roomId:edge?null:roomId});if(!edge)cells.push({x:col,y:row});
 }
 for(const [type,items]of [['door',doors],['window',windows]])for(const item of items){const tile=tiles.find(t=>t.x===item.x&&t.y===item.y);Object.assign(tile,{type,blocked:type==='window'||!item.open,blocksSight:type==='window'?false:!item.open,cover:type==='window'?25:0,...(type==='door'?{doorId:item.id||`${id}:door:${item.x}:${item.y}`,open:Boolean(item.open),locked:Boolean(item.locked)}:{})});}
 return {tiles,building:{id,name,x,y,width,height,roof,material,architecture,rooms:[{id:roomId,cells}]}};
}
export function createArchitectureReviewBattle(id='casa',rotation=0,view='exterior',roof='original'){
 const template=structuredClone(BUILDING_TEMPLATES[id]),source=template.building,b={...source,id:`review-${id}`,x:4,y:4};
 const byCell=new Map();
 for(const original of source.walls){let wall={...original};if(wall.axis){if(wall.axis==='x')wall.y=wall.y===source.y?wall.y:wall.y-1;else wall.x=wall.x===source.x?wall.x:wall.x-1;delete wall.axis;delete wall.id;}
  const key=`${wall.x},${wall.y}`,previous=byCell.get(key);if(!previous||previous.type==='wall')byCell.set(key,wall);
 }
 // The former parish tower had one isolated support cell. Keep it only in
 // this historical artwork reference; native floors must remain reachable.
 if(id==='iglesia')byCell.set('1,10',{x:1,y:10,type:'wall'});
 b.walls=[...byCell.values()].map(wall=>({...wall,x:wall.x+4,y:wall.y+4,buildingId:b.id}));
 let rooms=(source.rooms??[]).map(room=>({...room,id:`review-${id}:${room.id}`,cells:room.cells.filter(cell=>!byCell.has(`${cell.x},${cell.y}`)).map(cell=>({x:cell.x+4,y:cell.y+4}))})).filter(room=>room.cells.length);
 let props=(template.props??[]).map(prop=>({...prop,x:prop.x+4,y:prop.y+4,buildingId:b.id}));
 for(let turn=0;turn<rotation/90;turn++){const h=b.height,rotate=point=>({...point,x:b.x+h-1-(point.y-b.y),y:b.y+(point.x-b.x)});b.walls=b.walls.map(rotate);rooms=rooms.map(room=>({...room,cells:room.cells.map(rotate)}));props=props.map(rotate);[b.width,b.height]=[b.height,b.width];}
 const available=new Map();for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(!b.walls.some(wall=>wall.x===x&&wall.y===y))available.set(`${x},${y}`,{x,y});
 const computed=[],used=new Set();while(available.size){const start=available.values().next().value,cells=[start];available.delete(`${start.x},${start.y}`);for(let i=0;i<cells.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const key=`${cells[i].x+dx},${cells[i].y+dy}`,next=available.get(key);if(next){available.delete(key);cells.push(next);}}const match=rooms.filter(room=>!used.has(room.id)).map(room=>({room,score:room.cells.filter(cell=>cells.some(at=>at.x===cell.x&&at.y===cell.y)).length})).sort((a,b)=>b.score-a.score)[0],id=match?.score?match.room.id:`${b.id}:room:${start.x}:${start.y}`;used.add(id);computed.push({id,cells});}rooms=computed;
 const entrance=b.walls.find(wall=>wall.type==='door'&&(wall.x===b.x||wall.x===b.x+b.width-1||wall.y===b.y||wall.y===b.y+b.height-1));if(entrance)rooms.sort((a,z)=>Math.min(...a.cells.map(cell=>Math.abs(cell.x-entrance.x)+Math.abs(cell.y-entrance.y)))-Math.min(...z.cells.map(cell=>Math.abs(cell.x-entrance.x)+Math.abs(cell.y-entrance.y))));
 b.rooms=rooms;if(['terrace','roof-route'].includes(roof))b.roof='terrace';
 const size=Math.max(source.width,source.height)+10,tiles=Array.from({length:size*size},(_,i)=>({x:i%size,y:Math.floor(i/size),type:'grass',blocked:false,cover:0}));
 for(const tile of tiles){const wall=b.walls.find(wall=>wall.x===tile.x&&wall.y===tile.y),room=rooms.find(room=>room.cells.some(cell=>cell.x===tile.x&&cell.y===tile.y));if(wall)Object.assign(tile,wall,{blocked:wall.type!=='door'||!wall.open,blocksSight:wall.type==='wall'||wall.type==='door'&&!wall.open});else if(room)Object.assign(tile,{type:'floor',buildingId:b.id,roomId:room.id,material:b.material});}
 const upper=['slab','roof-route'].includes(roof)?buildTerrace({...b,roof:'terrace'}):{};if(roof==='slab')upper.upperSurfaces=upper.upperSurfaces.map(surface=>({...surface,blocked:true,obstacleHeight:0}));
 return {width:size,height:size,tiles,buildings:[b],props,...upper,revealedRooms:view==='exterior'?[]:view==='partial'?rooms.slice(0,1).map(room=>room.id):rooms.map(room=>room.id),units:[],npcs:[],artillery:[],lights:[],smoke:[]};
}
export function legacyCellMap(source){
 const map=structuredClone(source);delete map.wallEdges;
 for(const building of map.buildings??[]){
  const walls=new Map();for(const source of building.walls){const wall={...source};if(wall.axis==='x')wall.y=wall.y===building.y?wall.y:wall.y-1;else if(wall.axis==='y')wall.x=wall.x===building.x?wall.x:wall.x-1;delete wall.axis;delete wall.id;const key=`${wall.x},${wall.y}`,old=walls.get(key);if(!old||old.type==='wall')walls.set(key,wall);}
  building.walls=[...walls.values()];building.rooms=building.rooms.map(room=>({...room,cells:room.cells.filter(cell=>!walls.has(`${cell.x},${cell.y}`))})).filter(room=>room.cells.length);
  map.tiles=map.tiles.map(tile=>{if(tile.buildingId!==building.id)return tile;const wall=walls.get(`${tile.x},${tile.y}`);if(wall)return {...tile,...wall,roomId:null,blocked:wall.type!=='door'||!wall.open};return tile;});
 }
 return map;
}
