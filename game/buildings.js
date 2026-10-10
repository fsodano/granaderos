import {MAX_TACTICAL_LEVEL,DEFAULT_SLAB_THICKNESS} from './tactical-space.js';
import {BUILDING_TYPES} from './building-types.js';
export const DEFAULT_TERRACE_ELEVATION=3;
// Floors occupy cells. Walls and openings occupy the shared edge of two cells.
export function buildBuilding({id,x,y,width,height,name=id,doors=[],windows=[],material='adobe',architecture='house',roof=BUILDING_TYPES[architecture]?.roof??'tile'}){
  if(!id||![x,y,width,height].every(Number.isInteger)||width<3||height<3)throw Error('Building needs an ID and an integer footprint of at least 3×3.');
  if(!Object.hasOwn(BUILDING_TYPES,architecture))throw Error('Unknown building architecture.');
  const roomId=`${id}:interior`,tiles=[],cells=[],walls=[];
  const wall=(x,y,axis)=>walls.push({id:`${id}:wall:${axis}:${x}:${y}`,x,y,axis,type:'wall',blocked:true,blocksSight:true,cover:40});
  for(let col=x;col<x+width;col++){wall(col,y,'x');wall(col,y+height,'x');}
  for(let row=y;row<y+height;row++){wall(x,row,'y');wall(x+width,row,'y');}
  for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){
    tiles.push({x:col,y:row,type:'floor',blocked:false,blocksSight:false,cover:0,material,buildingId:id,roomId});
    cells.push({x:col,y:row});
  }
  function opening(item,type){
    const edge=item.axis?item:item.y===y+height-1?{...item,y:y+height,axis:'x'}:item.y===y?{...item,axis:'x'}:item.x===x?{...item,axis:'y'}:item.x===x+width-1?{...item,x:x+width,axis:'y'}:null;
    const target=edge&&walls.find(w=>w.x===edge.x&&w.y===edge.y&&w.axis===edge.axis);
    if(!target||target.type!=='wall')throw Error('Doors and windows must occupy distinct perimeter edges.');
    Object.assign(target,{type,blocked:type==='window'||!item.open,blocksSight:type==='wall'||type==='door'&&!item.open,cover:type==='window'?25:0,...(item.style?{style:item.style}:{}),...(type==='door'?{doorId:item.doorId||item.id||`${id}:door:${item.x}:${item.y}`,open:Boolean(item.open),locked:Boolean(item.locked)}:{})});
  }
  for(const door of doors)opening(door,'door');for(const window of windows)opening(window,'window');
  const building={id,name,x,y,width,height,roof,material,architecture,walls,rooms:[{id:roomId,cells}]};
  return {tiles,building,wallEdges:walls.map(w=>({...w,buildingId:id,material,blocked:w.type!=='door'||!w.open,blocksSight:w.type==='wall'||w.type==='door'&&!w.open,cover:w.type==='wall'?40:w.type==='window'?25:0}))};
}
export function placeBuilding(ground,options){const result=buildBuilding(options),overrides=new Map(result.tiles.map(t=>[`${t.x},${t.y}`,t]));if(result.tiles.some(t=>!ground.some(g=>g.x===t.x&&g.y===t.y)))throw Error('Building footprint is outside the sector.');return{...result,tiles:ground.map(t=>overrides.get(`${t.x},${t.y}`)||{...t})};}

// Explicit geometry authoring; campaign-terraces.js selects supported house roofs.
export function buildTerrace(building,{elevation=DEFAULT_TERRACE_ELEVATION,tacticalLevel=1,slabThickness=DEFAULT_SLAB_THICKNESS,climbPoints=[]}={}){
 if(building.roof!=='terrace')throw Error('A walkable terrace needs a flat terrace roof.');
 if(!Number.isFinite(elevation)||elevation<=0||!Number.isInteger(tacticalLevel)||tacticalLevel<1||tacticalLevel>MAX_TACTICAL_LEVEL||!Number.isFinite(slabThickness)||slabThickness<=0||slabThickness>=elevation)throw Error('Invalid terrace height or level.');
 if(!Array.isArray(climbPoints)||climbPoints.some(point=>!point||typeof point.id!=='string'||!point.id.length||!point.from||!point.to||![point.from.x,point.from.y,point.to.x,point.to.y].every(Number.isInteger)))throw Error('A terrace access needs a stable ID and integer endpoints.');
 const upperSurfaces=[];
 for(let dy=0;dy<building.height;dy++)for(let dx=0;dx<building.width;dx++)upperSurfaces.push({id:`${building.id}:roof:${dx}:${dy}`,x:building.x+dx,y:building.y+dy,tacticalLevel,elevation,slabThickness,type:'floor',kind:'roof',blocked:false,cover:0,material:building.material,buildingId:building.id});
 const climbLinks=climbPoints.map(point=>({id:`${building.id}:climb:${point.id}`,kind:'climb',from:{...point.from,tacticalLevel:point.from.tacticalLevel===undefined?tacticalLevel-1:point.from.tacticalLevel},to:{...point.to,tacticalLevel:point.to.tacticalLevel===undefined?tacticalLevel:point.to.tacticalLevel}}));
 return {upperSurfaces,climbLinks};
}
