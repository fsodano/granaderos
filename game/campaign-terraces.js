import {buildTerrace} from './buildings.js';
import {propBlocksAt} from './props.js';

// The existing single-storey house art has a 3 m flat roof. Taller mansions
// contain a mirador and need a different access model; pitched roofs stay solid.
export function campaignTerraces(map){
 const upperSurfaces=[],climbLinks=[];
 for(const building of map.buildings??[]){
  if(building.architecture!=='house'||building.roof!=='terrace')continue;
  const {x,y,width,height}=building;
  const clearGround=point=>{
   if(point.x<0||point.y<0||point.x>=map.width||point.y>=map.height)return false;
   const tile=map.tiles[point.y*map.width+point.x];
   return tile&&!tile.blocked&&!tile.buildingId&&!propBlocksAt(map,point.x,point.y);
  };
  // West and north have no drawn parapet. Keep each stable access ID while
  // selecting a clear approach near the middle of that side, away from corners.
  const candidates=(length)=>Array.from({length:length-2},(_,i)=>i+1).sort((a,b)=>Math.abs(a-(length-1)/2)-Math.abs(b-(length-1)/2)||a-b);
  const west=candidates(height).map(dy=>({id:'west',from:{x:x-1,y:y+dy},to:{x,y:y+dy}})).find(link=>clearGround(link.from));
  const north=candidates(width).map(dx=>({id:'north',from:{x:x+dx,y:y-1},to:{x:x+dx,y}})).find(link=>clearGround(link.from));
  const accesses=[west,north].filter(Boolean);
  if(!accesses.length)throw Error(`La terraza de ${building.id} no tiene acceso desde el suelo.`);
  const geometry=buildTerrace(building,{elevation:3,climbPoints:accesses});
  for(const surface of geometry.upperSurfaces){
   // Match the current house silhouette: chimney at (1,1), parapets along
   // the east and south edges. Keep the floor slab beneath blocked roof decor.
   if(surface.x===x+1&&surface.y===y+1)Object.assign(surface,{blocked:true,cover:40,obstacleHeight:1.4,projectileResistance:65});
   else if(surface.x===x+width-1||surface.y===y+height-1)Object.assign(surface,{blocked:true,cover:25,obstacleHeight:.45,projectileResistance:45});
  }
  upperSurfaces.push(...geometry.upperSurfaces);climbLinks.push(...geometry.climbLinks);
 }
 return upperSurfaces.length?{upperSurfaces,climbLinks}:{};
}
