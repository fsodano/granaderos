import {propCells,PROP_TYPES} from './props.js';
import {surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';
import {geometryCells,obstacleVolumesAt,rayHeightIntersection,propCoverProfile} from './sight-geometry.js';

// JA2 1.13 TileEngine/structure.cpp, DamageStructure: explosions subtract
// material armour before damaging a structure. These values and percentages
// are Granaderos tuning, not engine constants or historical measurements.
export const STRUCTURE_BLAST = Object.freeze({strength:160,
  materials:Object.freeze({wood:Object.freeze({durability:100,armour:10}),adobe:Object.freeze({durability:200,armour:25}),stone:Object.freeze({durability:350,armour:50}),hay:Object.freeze({durability:60,armour:0})}),
  factors:Object.freeze({wall:1,door:.6,window:.25,table:.45,bench:.3,bed:.4,chest:.55,barrels:.55,hay:.5,cart:.9})});
const epsilon=1e-9;
const surfaceTypes=['wall','door','window'];
export function structureBlastProfile(target,kind='surface'){
  if(!target||target.destroyed||!(kind==='prop'?PROP_TYPES:surfaceTypes).includes(target.type))return null;
  const fallback=kind==='prop'&&target.type==='hay'?'hay':kind==='prop'||['door','window'].includes(target.type)?'wood':'adobe';
  const material=['door','window'].includes(target.type)?'wood':Object.hasOwn(STRUCTURE_BLAST.materials,target.material)?target.material:fallback;
  const spec=STRUCTURE_BLAST.materials[material];
  return {material,durability:Math.round(spec.durability*STRUCTURE_BLAST.factors[target.type]),armour:spec.armour};
}

export function validateStructureDamage(target,kind='surface'){
  if(target.structureDamage===undefined&&target.destroyed===undefined)return true;
  const fail=()=>{throw Error('El daño guardado de la estructura no es válido.');};
  if(target.structureDamage!==undefined&&(!Number.isInteger(target.structureDamage)||target.structureDamage<0||target.structureDamage>100))fail();
  if(target.destroyed!==undefined&&typeof target.destroyed!=='boolean')fail();
  if(target.destroyed){
    if(target.structureDamage!==100||target.blocksSight!==false)fail();
    if(target.obstacleHeight!==undefined&&target.obstacleHeight!==0||target.projectileResistance!==undefined&&target.projectileResistance!==0||target.concealment!==undefined&&target.concealment!==0)fail();
    if(kind==='prop'){
      if(!PROP_TYPES.includes(target.type)||target.blocksMovement!==false)fail();
    }else if(!['rubble','door'].includes(target.type)||target.blocked!==false)fail();
    if(kind==='surface'&&target.type==='rubble'&&target.cover>20)fail();
    if(['door','chest'].includes(target.type)&&(target.open!==true||target.locked!==false||target.broken!==true||target.trap?.armed===true))fail();
  }else if(target.structureDamage===100||!structureBlastProfile(target,kind))fail();
  return true;
}

// A near face receives the blast without its own volume shielding it. Every
// intervening structure, raised ground and floor slab remains physical cover.
// Multi-cell furniture takes the strongest exposed hit once, never per cell.
function exposure(state,origin,target,kind,point,radius){
  const base=surfaceHeight(state,origin),endBase=surfaceHeight(state,point);
  if(!Number.isFinite(base)||!Number.isFinite(endBase))return 0;
  const distance=Math.hypot(point.x-origin.x,point.y-origin.y,endBase-base);
  if(distance>radius+epsilon)return 0;
  const own=kind==='prop'?`prop:${target.id}`:`surface:${tacticalLevel(target)}:${target.x},${target.y}`;
  const height=kind==='prop'?Math.min(.6,(propCoverProfile(target)?.height??1.2)/2):.6;
  for(const cell of geometryCells(origin,point)){
    const ground=surfaceAt(state,cell);
    if(ground&&rayHeightIntersection(base+.2,endBase+height,cell,-1000,ground.elevation??0))return 0;
    for(const volume of obstacleVolumesAt(state,cell)){
      if(volume.id===own)continue;
      if(rayHeightIntersection(base+.2,endBase+height,cell,volume.bottom,volume.top))return 0;
    }
  }
  return Math.max(0,(radius-distance+1)/(radius+1));
}
export function destroyStructure(target,kind='surface'){
  Object.assign(target,{structureDamage:100,destroyed:true,blocksSight:false});
  delete target.obstacleHeight;delete target.projectileResistance;delete target.concealment;
  if(kind==='prop')target.blocksMovement=false;
  else if(target.type==='door')target.blocked=false;
  else Object.assign(target,{type:'rubble',blocked:false,cover:15});
  if(['door','chest'].includes(target.type)){
    Object.assign(target,{open:true,locked:false,broken:true,lockIntegrity:0});
    if(target.trap)target.trap.armed=false;
  }
}

// Resolve against one intact geometry snapshot, then apply together. A hole
// affects subsequent actions; this model does not spread pressure through a
// wall that collapses during the same blast, or collapse roofs and floors.
export function applyStructureBlast(state,origin,radius,{strength=STRUCTURE_BLAST.strength}={}){
  if(!Number.isFinite(radius)||radius<0||radius>20||!Number.isFinite(strength)||strength<0||strength>1000)return [];
  const hits=[];
  for(const [kind,targets]of [['surface',state.tiles??[]],['prop',state.props??[]]])for(const target of targets){
    const spec=structureBlastProfile(target,kind);if(!spec)continue;
    const points=kind==='prop'?propCells(target):[target];
    const multiplier=Math.max(0,...points.map(point=>exposure(state,origin,target,kind,point,radius)));
    const damage=Math.round(Math.max(0,strength*multiplier-spec.armour)*100/spec.durability);
    if(damage<=0)continue;
    hits.push({target,kind,damage:Math.min(100,(target.structureDamage??0)+damage)});
  }
  for(const hit of hits){hit.target.structureDamage=hit.damage;if(hit.damage===100)destroyStructure(hit.target,hit.kind);}
  return hits.map(({target,kind,damage})=>({kind,id:target.id??target.doorId??`wall:${target.x}:${target.y}`,x:target.x,y:target.y,tacticalLevel:tacticalLevel(target),structureDamage:damage,destroyed:Boolean(target.destroyed)}));
}
