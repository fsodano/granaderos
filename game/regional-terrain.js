import {propCells} from './props.js';

// Original regional landscapes, not surveyed historical plans. Terrain is
// fixed geography: weather and campaign time must never reroll a saved map.
const landscapes={
 ensenada:'wetland',santa_fe:'wetland',san_nicolas:'river',san_lorenzo:'river',
 cordoba:'scrub',mendoza:'dry-foothills',tucuman:'woodland',yatasto:'woodland',
 salta:'wooded-foothills',jujuy:'wooded-foothills',
 uspallata:'dry-mountain',los_patos:'dry-mountain',humahuaca:'dry-mountain',
};
const key=p=>`${p.x},${p.y}`;
const hash=(x,y,seed)=>{
 let value=Math.imul(x+seed,374761393)^Math.imul(y-seed,668265263);
 value=Math.imul(value^(value>>>13),1274126177);
 return ((value^(value>>>16))>>>0)%100;
};
export const regionalLandscape=sectorId=>landscapes[sectorId]??'settlement';

function terrainAt(landscape,x,y,seed,shoreDistance){
 // Broad patches with irregular edges avoid both checkerboards and a single
 // solid field. No battle RNG is consumed by geography.
 const patch=hash(Math.floor(x/4),Math.floor(y/4),seed);
 const score=patch*.75+hash(x,y,seed)*.25;
 if(landscape==='wetland')return score<(shoreDistance<=6?85:42)?'mud':score>77?'forest':'grass';
 if(landscape==='river')return shoreDistance<=5&&score<55?'mud':shoreDistance<=12&&score>55?'forest':score>74?'scrub':'grass';
 if(landscape==='woodland')return score<62?'forest':score<80?'scrub':'grass';
 if(landscape==='wooded-foothills')return score<38?'forest':score<62?'scrub':score>83?'stone':'grass';
 if(landscape==='scrub')return score<62?'scrub':score>84?'stone':'grass';
 return score<(landscape==='dry-mountain'?76:49)?'stone':score<88?'scrub':'grass';
}

// Called only for newly expanded maps, after every building, road and prop.
// Existing tiles and movement topology are retained: all added ground is open.
export function applyRegionalTerrain(map,landmark){
 const id=map.sceneId??map.sector,landscape=regionalLandscape(id);
 if(landscape==='settlement')return map;
 const seed=[...id].reduce((value,char)=>Math.imul(value,31)+char.charCodeAt(0)|0,17);
 const reserved=new Set();
 const reserve=(point,padding=1)=>{
  for(let y=point.y-padding;y<=point.y+padding;y++)for(let x=point.x-padding;x<=point.x+padding;x++)reserved.add(`${x},${y}`);
 };
 for(const prop of map.props??[])for(const cell of propCells(prop))reserve(cell);
 for(const collection of ['squad','enemies','artillery','garrison','missionAllies','npcs','lights'])for(const point of map[collection]??[])reserve(point);
 for(const building of map.buildings??[]){
  for(let y=building.y-1;y<=building.y+building.height;y++)for(let x=building.x-1;x<=building.x+building.width;x++)reserved.add(`${x},${y}`);
 }
 const waterByRow=new Map();
 for(const tile of map.tiles)if(tile.type==='water')waterByRow.set(tile.y,Math.min(waterByRow.get(tile.y)??Infinity,tile.x));
 for(const tile of map.tiles){
  const {x,y}=tile;
  if(tile.blocked||tile.buildingId||tile.type!=='grass'||reserved.has(key(tile)))continue;
  if(x<2||x>=map.width-2||y<2||y>=map.height-2)continue;
  if(x>=landmark.x&&x<landmark.x+landmark.width&&y>=landmark.y&&y<landmark.y+landmark.height)continue;
  const type=terrainAt(landscape,x,y,seed,(waterByRow.get(y)??Infinity)-x);
  if(type==='grass')continue;
  Object.assign(tile,{type,cover:type==='forest'?20:type==='scrub'?15:type==='stone'?10:0});
  if(type==='stone')tile.material='stone';
 }
 return map;
}

// Existing textures retain their world scale. Natural stone uses bare earth
// and loose rock scenery; authored stone paving keeps its cobbled surface.
export function terrainMaterial(tile,sectorId){
 if(tile.type==='road')return 'dirt';
 if(tile.type==='stone')return tile.material==='stone'&&!tile.buildingId?'dirt':'cobble';
 if(tile.type==='mud')return 'mud';
 if(tile.type==='floor')return 'floor';
 if(tile.type==='forest')return 'green-grass';
 if(tile.type==='grass'&&['wetland','river','woodland','wooded-foothills'].includes(regionalLandscape(sectorId)))return 'green-grass';
 return 'dry-grass';
}
