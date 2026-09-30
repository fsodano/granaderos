import {MAX_TACTICAL_LEVEL,DEFAULT_SLAB_THICKNESS} from './tactical-space.js';
import {BUILDING_TYPES} from './building-types.js';
// Multi-tile buildings with walkable interiors and independently operated door leaves.
export function buildBuilding({id,x,y,width,height,name=id,doors=[],windows=[],material='adobe',architecture='house',roof=BUILDING_TYPES[architecture]?.roof??'tile'}){
  if(!id||![x,y,width,height].every(Number.isInteger)||width<3||height<3)throw Error('Building needs an ID and an integer footprint of at least 3×3.');
  if(!Object.hasOwn(BUILDING_TYPES,architecture))throw Error('Unknown building architecture.');
  const roomId=`${id}:interior`,tiles=[],cells=[];
  for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){
    const edge=col===x||col===x+width-1||row===y||row===y+height-1;
    tiles.push({x:col,y:row,type:edge?'wall':'floor',blocked:edge,blocksSight:edge,cover:edge?40:0,material,buildingId:id,roomId:edge?null:roomId});
    if(!edge)cells.push({x:col,y:row});
  }
  function opening(item,type){const tile=tiles.find(t=>t.x===item.x&&t.y===item.y);if(!tile||tile.type!=='wall')throw Error('Doors and windows must occupy distinct perimeter cells.');Object.assign(tile,{type,blocked:type==='window'||!item.open,blocksSight:type==='window'?false:!item.open,cover:type==='window'?25:0,...(type==='door'?{doorId:item.id||`${id}:door:${item.x}:${item.y}`,open:Boolean(item.open),locked:Boolean(item.locked)}:{})});}
  for(const door of doors)opening(door,'door');for(const window of windows)opening(window,'window');
  return {tiles,building:{id,name,x,y,width,height,roof,material,architecture,rooms:[{id:roomId,cells}]}};
}
export function placeBuilding(ground,options){const result=buildBuilding(options),overrides=new Map(result.tiles.map(t=>[`${t.x},${t.y}`,t]));if(result.tiles.some(t=>!ground.some(g=>g.x===t.x&&g.y===t.y)))throw Error('Building footprint is outside the sector.');return{tiles:ground.map(t=>overrides.get(`${t.x},${t.y}`)||{...t}),building:result.building};}

// Explicit geometry authoring; campaign-terraces.js selects supported house roofs.
export function buildTerrace(building,{elevation=3,tacticalLevel=1,slabThickness=DEFAULT_SLAB_THICKNESS,climbPoints=[]}={}){
 if(building.roof!=='terrace')throw Error('A walkable terrace needs a flat terrace roof.');
 if(!Number.isFinite(elevation)||elevation<=0||!Number.isInteger(tacticalLevel)||tacticalLevel<1||tacticalLevel>MAX_TACTICAL_LEVEL||!Number.isFinite(slabThickness)||slabThickness<=0||slabThickness>=elevation)throw Error('Invalid terrace height or level.');
 if(!Array.isArray(climbPoints)||climbPoints.some(point=>!point||typeof point.id!=='string'||!point.id.length||!point.from||!point.to||![point.from.x,point.from.y,point.to.x,point.to.y].every(Number.isInteger)))throw Error('A terrace access needs a stable ID and integer endpoints.');
 const upperSurfaces=[];
 for(let dy=0;dy<building.height;dy++)for(let dx=0;dx<building.width;dx++)upperSurfaces.push({id:`${building.id}:roof:${dx}:${dy}`,x:building.x+dx,y:building.y+dy,tacticalLevel,elevation,slabThickness,type:'floor',kind:'roof',blocked:false,cover:0,material:building.material,buildingId:building.id});
 const climbLinks=climbPoints.map(point=>({id:`${building.id}:climb:${point.id}`,kind:'climb',from:{...point.from,tacticalLevel:point.from.tacticalLevel===undefined?tacticalLevel-1:point.from.tacticalLevel},to:{...point.to,tacticalLevel:point.to.tacticalLevel===undefined?tacticalLevel:point.to.tacticalLevel}}));
 return {upperSurfaces,climbLinks};
}
