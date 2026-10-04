import {surfaceAt,surfaceHeight} from './tactical-space.js';
import {absoluteBodyHeight,relativeBodyHeight as height,usesElevationGeometry,groundTileAt,terrainCoverProfile as terrainObstacle,propCoverProfile,geometryCells,rayHeightIntersection,obstacleVolumesAt} from './sight-geometry.js';

// A body's storage collection does not change its physical silhouette. Keep
// the collection tag separate from its ID: civilian and soldier IDs may match.
export function physicalBodies(state){
 return [...(state.units??[]).filter(body=>body.hp>0&&!body.departure&&!body.fled).map(body=>({body,kind:'unit'})),
  ...(state.npcs??[]).filter(body=>(body.hp??100)>0&&!body.departure&&!body.fled).map(body=>({body,kind:'npc'}))];
}

// Traverse every crossed cell, including the two cells touching a diagonal
// corner. Entry/exit fractions let a sloping shot meet a low obstacle correctly.
export function projectileCells(a,b){
  if(a.x===b.x&&a.y===b.y)return [];
  const dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy),tx=dx?1/Math.abs(dx):Infinity,ty=dy?1/Math.abs(dy):Infinity;
  let x=a.x,y=a.y,nx=tx/2,ny=ty/2,entry=0;const result=[];
  while(entry<=1){
    const exit=Math.min(nx,ny,1);
    if(x!==a.x||y!==a.y)result.push({x,y,entry,exit});
    if(exit===1)break;
    if(Math.abs(nx-ny)<1e-10){result.push({x:x+sx,y,entry:exit,exit},{x,y:y+sy,entry:exit,exit});x+=sx;y+=sy;nx+=tx;ny+=ty;}
    else if(nx<ny){x+=sx;nx+=tx;}else{y+=sy;ny+=ty;}
    entry=exit;
  }
  return result;
}

export function concealmentAt(state,target){
  const tile=surfaceAt(state,target);
  if(!tile)return 0;
  if(tile.concealment!==undefined)return tile.concealment;
  if(['wall','door','window','rubble'].includes(tile.type))return 0;
  return tile.type==='forest'?Math.max(20,tile.cover??0):tile.type==='scrub'?Math.max(15,tile.cover??0):tile.cover??0;
}

export function concealmentSightPenalty(state,target){
  const posture=target.mounted?.25:target.stance==='prone'?1.5:target.stance==='crouched'?1:.5;
  return Math.min(6,concealmentAt(state,target)/10*posture);
}

export function projectilePath(state,attacker,target,weapon,hitLocation='torso',flight={}){
  if(usesElevationGeometry(state,attacker,target))return elevatedProjectilePath(state,attacker,target,weapon,hitLocation,flight);
  const power=Math.max(1,weapon.damage??1),muzzle=height(attacker,'muzzle'),destination=height(target,hitLocation);
  let remaining=power;const obstacles=[],seen=new Set();
  const encounter=(id,point,obstacle)=>{
    if(!obstacle||seen.has(id))return;
    const low=Math.min(muzzle+(destination-muzzle)*point.entry,muzzle+(destination-muzzle)*point.exit);
    if(low>obstacle.height)return;
    seen.add(id);remaining=Math.max(0,remaining-obstacle.resistance);
    const fraction=rayHeightIntersection(muzzle,destination,point,0,obstacle.height)?.entry??point.entry;
    obstacles.push({x:point.x,y:point.y,material:obstacle.material,resistance:obstacle.resistance,stopped:remaining===0,fraction});
  };
  for(const point of projectileCells(attacker,target)){
    if(point.entry>(flight.stopFraction??1))break;
    encounter(`tile:${point.x},${point.y}`,point,terrainObstacle(groundTileAt(state,point)));
    if(!remaining)break;
    for(const prop of state.props??[]){
      const size=prop.footprint??{width:1,height:1};
      if(point.x<prop.x||point.y<prop.y||point.x>=prop.x+size.width||point.y>=prop.y+size.height)continue;
      encounter(`prop:${prop.id}`,point,propCoverProfile(prop));
      if(!remaining)break;
    }
    if(!remaining)break;
  }
  return {blocked:remaining===0,damageFactor:remaining/power,obstacles};
}

// A shot retains its original destination height. Living bodies in
// crossed cells can intercept it, including allies and unconscious soldiers.
// Cell-wide silhouettes and the lack of body penetration are game tuning.
export function projectileFlight(state,attacker,target,weapon,hitLocation='torso',flight={}){
  if(usesElevationGeometry(state,attacker,target))return elevatedProjectileFlight(state,attacker,target,weapon,hitLocation,flight);
  const muzzle=height(attacker,'muzzle'),end=height(target,hitLocation),bodies=physicalBodies(state);
  for(const cell of projectileCells(attacker,target)){
    if(cell.entry===cell.exit)continue; // A corner touch can strike cover, not a cell-wide body.
    const entryHeight=muzzle+(end-muzzle)*cell.entry,exitHeight=muzzle+(end-muzzle)*cell.exit;
    const victims=bodies.filter(({body,kind})=>(kind==='npc'||body.id!==attacker.id)&&body.x===cell.x&&body.y===cell.y).sort((a,b)=>String(a.body.id).localeCompare(String(b.body.id))||a.kind.localeCompare(b.kind));
    for(const {body:victim,kind} of victims){
      const posture=victim.knockedDown||victim.unconscious?{...victim,stance:'prone',mounted:false}:victim;
      const top=height(posture,'head')+.15;
      if(Math.min(entryHeight,exitHeight)>top)continue;
      const z=Math.min(entryHeight,top);
      const location=kind==='unit'&&victim.id===target.id?hitLocation:z>height(posture,'torso')+.2?'head':z<height(posture,'legs')+.15?'legs':'torso';
      const path=projectilePath(state,attacker,target,weapon,hitLocation,{stopFraction:cell.entry});
      return {...path,victimId:path.blocked?null:victim.id,...(!path.blocked&&kind==='npc'?{victimKind:'npc'}:{}),hitLocation:location};
    }
  }
  return {...projectilePath(state,attacker,target,weapon,hitLocation),victimId:null,hitLocation};
}

export function pointProjectileFlight(state,attacker,destination,weapon){
  return projectileFlight(state,attacker,{x:destination.x,y:destination.y,...(destination.tacticalLevel!==undefined?{tacticalLevel:destination.tacticalLevel}:{}),stance:'standing',mounted:false},weapon);
}

function elevatedProjectilePath(state,attacker,target,weapon,hitLocation,flight={}){
 const power=Math.max(1,weapon.damage??1),muzzle=absoluteBodyHeight(state,attacker,'muzzle'),destination=flight.destinationHeight??absoluteBodyHeight(state,target,hitLocation);
 if(muzzle===null||!Number.isFinite(destination))return {blocked:true,damageFactor:0,obstacles:[]};
 let remaining=power;const obstacles=[],seen=new Set(),stopFraction=flight.stopFraction??1;
 for(const cell of geometryCells(attacker,target)){
  if(cell.entry>stopFraction)break;
  const hits=obstacleVolumesAt(state,cell).map(volume=>({volume,hit:rayHeightIntersection(muzzle,destination,cell,volume.bottom,volume.top,stopFraction)})).filter(entry=>entry.hit).sort((a,b)=>a.hit.entry-b.hit.entry||a.volume.id.localeCompare(b.volume.id));
  for(const {volume,hit} of hits){
   if(seen.has(volume.id))continue;seen.add(volume.id);
   remaining=volume.solid?0:Math.max(0,remaining-volume.resistance);
   obstacles.push({x:cell.x,y:cell.y,tacticalLevel:volume.tacticalLevel,kind:volume.kind,material:volume.material,resistance:volume.solid?power:volume.resistance,stopped:remaining===0,fraction:hit.entry});
   if(!remaining)return {blocked:true,damageFactor:0,obstacles};
  }
 }
 return {blocked:false,damageFactor:remaining/power,obstacles};
}

function elevatedProjectileFlight(state,attacker,target,weapon,hitLocation,flight){
 const muzzle=absoluteBodyHeight(state,attacker,'muzzle'),destination=flight.destinationHeight??absoluteBodyHeight(state,target,hitLocation);
 if(muzzle===null||!Number.isFinite(destination))return {blocked:true,damageFactor:0,obstacles:[],victimId:null,hitLocation};
 const bodies=physicalBodies(state);
 for(const cell of geometryCells(attacker,target)){
  if(cell.entry===cell.exit)continue;
  const victims=bodies.filter(({body,kind})=>(kind==='npc'||body.id!==attacker.id)&&body.x===cell.x&&body.y===cell.y).map(({body:unit,kind})=>{
   const base=surfaceHeight(state,unit),top=absoluteBodyHeight(state,unit,'head');
   return {unit,kind,base,hit:base===null||top===null?null:rayHeightIntersection(muzzle,destination,cell,base,top+.15)};
  }).filter(victim=>victim.hit).sort((a,b)=>a.hit.entry-b.hit.entry||String(a.unit.id).localeCompare(String(b.unit.id))||a.kind.localeCompare(b.kind));
  if(!victims.length)continue;
  const {unit:victim,kind,base,hit}=victims[0],relative=muzzle+(destination-muzzle)*hit.entry-base;
  const location=kind==='unit'&&victim.id===target.id?hitLocation:relative>height(victim,'torso')+.2?'head':relative<height(victim,'legs')+.15?'legs':'torso';
  const path=elevatedProjectilePath(state,attacker,target,weapon,hitLocation,{...flight,destinationHeight:destination,stopFraction:hit.entry});
  return {...path,victimId:path.blocked?null:victim.id,...(!path.blocked&&kind==='npc'?{victimKind:'npc'}:{}),hitLocation:location};
 }
 return {...elevatedProjectilePath(state,attacker,target,weapon,hitLocation,{...flight,destinationHeight:destination}),victimId:null,hitLocation};
}

export function validateCoverMetadata(value){
  for(const [key,max]of [['obstacleHeight',10],['projectileResistance',1000],['concealment',100]]){
    if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>max))throw Error('La cobertura guardada no es válida.');
  }
}
