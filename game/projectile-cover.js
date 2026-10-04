import {surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';
import {COMBAT_BALANCE} from './combat-balance.js';
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
// Cell-wide silhouettes and body resistance are explicit game tuning.
export function projectileFlight(state,attacker,target,weapon,hitLocation='torso',flight={}){
  if(Number.isFinite(weapon.range)&&weapon.range>0&&weapon.loadPattern!=='cone'&&!(weapon.id===1807&&!weapon.loadPattern))return continuedProjectileFlight(state,attacker,target,weapon,hitLocation,flight);
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

export function pointProjectileFlight(state,attacker,destination,weapon,flight={}){
  return projectileFlight(state,attacker,{x:destination.x,y:destination.y,...(destination.tacticalLevel!==undefined?{tacticalLevel:destination.tacticalLevel}:{}),stance:'standing',mounted:false},weapon,'torso',flight);
}

// Keep the resolved aim direction and height. Effective range affects accuracy;
// this separate finite limit controls flight. Existing farther aim points remain
// legal, but never extend the ray through a map boundary. No RNG is read here.
export function firearmRay(state,attacker,target,weapon,hitLocation='torso',flight={}){
 const source={x:attacker.x,y:attacker.y,height:absoluteBodyHeight(state,attacker,'muzzle'),tacticalLevel:tacticalLevel(attacker)};
 const aim={x:target.x,y:target.y,height:flight.destinationHeight??absoluteBodyHeight(state,target,hitLocation),tacticalLevel:tacticalLevel(target)};
 if(![source.x,source.y,source.height,aim.x,aim.y,aim.height].every(Number.isFinite))return null;
 const dx=aim.x-source.x,dy=aim.y-source.y,distance=Math.hypot(dx,dy);
 const limit=Math.max(distance,Number.isFinite(weapon.range)?Math.max(0,weapon.range)*COMBAT_BALANCE.firearmFlightRangeMultiplier:distance);
 let scale=distance?limit/distance:1,termination='range';
 for(const [value,delta,size] of [[source.x,dx,state.width],[source.y,dy,state.height]]){
  const edge=delta>0?(size-.5-value)/delta:delta<0?(-.5-value)/delta:Infinity;
  if(edge<scale){scale=Math.max(0,edge);termination='edge';}
 }
 const destination={x:source.x+dx*scale,y:source.y+dy*scale,height:source.height+(aim.height-source.height)*scale,tacticalLevel:aim.tacticalLevel};
 return {source,aim,destination,termination};
}

// Resolve cover, solid ground/floors and bodies in physical intersection order.
// The same ray serves actual fire and knowledge-filtered forecasts. Forecasts
// assume possible body passage without RNG; actual fire supplies resolveBody.
// Body and cover force loss accumulate independently. The ray never ricochets.
function continuedProjectileFlight(state,attacker,target,weapon,hitLocation,flight){
 const ray=firearmRay(state,attacker,target,weapon,hitLocation,flight),power=Math.max(1,weapon.damage??1);
 if(!ray)return {blocked:true,damageFactor:0,obstacles:[],victimId:null,hitLocation};
 const {source,destination}=ray,events=[],columns=new Map(),elevated=usesElevationGeometry(state,attacker,target);
 const targetKind=flight.targetKind??((state.npcs??[]).includes(target)?'npc':'unit');
 for(const entry of physicalBodies(state)){
  if(entry.kind==='unit'&&entry.body.id===attacker.id)continue;
  const key=`${entry.body.x},${entry.body.y}`,column=columns.get(key)??[];column.push(entry);columns.set(key,column);
 }
 for(const cell of geometryCells(source,destination)){
  const ground=groundTileAt(state,cell);if(!ground)continue;
  const origin=cell.x===Math.round(source.x)&&cell.y===Math.round(source.y);
  // Flat-map muzzle cover retains its earlier origin-cell rule. Ground and
  // ceiling slabs are solid at the origin as well as later along the ray.
  for(const volume of obstacleVolumesAt(state,cell)){
   if(origin&&!elevated&&volume.kind!=='slab')continue;
   const hit=rayHeightIntersection(source.height,destination.height,cell,volume.bottom,volume.top);
   if(hit)events.push({fraction:hit.entry,priority:1,key:volume.id,cell,volume});
  }
  const groundHeight=ground.elevation??0;
  const groundHit=rayHeightIntersection(source.height,destination.height,cell,Math.min(source.height,destination.height,groundHeight)-1,groundHeight);
  if(groundHit)events.push({fraction:groundHit.entry,priority:0,key:`ground:${cell.x},${cell.y}`,cell,volume:{kind:'ground',tacticalLevel:0,material:ground.material??'earth',resistance:power,solid:true}});
  if(cell.entry===cell.exit||origin&&!elevated)continue; // Cover can touch a corner; a body cannot.
  for(const {body,kind} of columns.get(`${cell.x},${cell.y}`)??[]){
   const base=surfaceHeight(state,body),top=absoluteBodyHeight(state,body,'head');
   const hit=base===null||top===null?null:rayHeightIntersection(source.height,destination.height,cell,base,top+.15);
   if(hit)events.push({fraction:hit.entry,priority:2,key:`${kind}:${body.id}`,cell,body,kind,base});
  }
 }
 events.sort((a,b)=>a.fraction-b.fraction||a.priority-b.priority||a.key.localeCompare(b.key));
 let remaining=power,coverLoss=0,bodyLoss=0,reachChance=1;const obstacles=[],bodyImpacts=[],seen=new Set();
 const pointAt=(fraction,level)=>({x:source.x+(destination.x-source.x)*fraction,y:source.y+(destination.y-source.y)*fraction,height:source.height+(destination.height-source.height)*fraction,tacticalLevel:level});
 const finish=(impact,termination,blocked)=>{
  const first=bodyImpacts[0],terminal={impact,termination,blocked,remainingImpact:remaining};
  // Existing generic consumers still address the first physical intersection.
  // Named-target forecasts select their own typed entry from bodyImpacts.
  return {blocked:first?false:blocked,damageFactor:first?.damageFactor??remaining/power,obstacles,victimId:first?.victimId??null,...(first?.victimKind==='npc'?{victimKind:'npc'}:{}),hitLocation:first?.hitLocation??hitLocation,destination,impact:first?.impact??impact,termination:first?'body':termination,bodyImpacts,terminal};
 };
 for(const event of events){
  if(seen.has(event.key))continue;seen.add(event.key);
  if(event.body){
   const {body,kind,base}=event,z=pointAt(event.fraction,tacticalLevel(body)).height-base;
   const selected=kind===targetKind&&body.id===target.id;
   const location=selected?hitLocation:z>height(body,'torso')+.2?'head':z<height(body,'legs')+.15?'legs':'torso';
   const resistance=COMBAT_BALANCE.firearmBodyResistance[location],after=Math.max(0,remaining-resistance);
   const chance=Math.max(0,Math.min(COMBAT_BALANCE.firearmBodyPenetrationMaximumChance,remaining-COMBAT_BALANCE.firearmBodyPenetrationThreshold));
   const impact={victimId:body.id,victimKind:kind,hitLocation:location,impact:pointAt(event.fraction,tacticalLevel(body)),fraction:event.fraction,incomingImpact:remaining,damageFactor:remaining/power,coverDamageFactor:Math.max(0,1-coverLoss/power),bodyDamageReduction:bodyLoss/power,bodyResistance:resistance,penetrationChance:after>0?chance:0,reachChance,remainingImpact:after,continued:false};
   const continued=after>0&&chance>0&&flight.bodyPenetration!==false&&(!flight.resolveBody||flight.resolveBody(impact)===true);
   impact.continued=continued;impact.remainingImpact=continued?after:0;bodyImpacts.push(impact);
   remaining=impact.remainingImpact;
   if(!continued)return finish(impact.impact,'body',false);
   bodyLoss+=resistance;reachChance*=chance/100;
   continue;
  }
  const {volume,cell}=event,before=remaining;remaining=volume.solid?0:Math.max(0,remaining-volume.resistance);coverLoss+=before-remaining;
  obstacles.push({x:cell.x,y:cell.y,tacticalLevel:volume.tacticalLevel,kind:volume.kind,material:volume.material,resistance:volume.solid?power:volume.resistance,stopped:remaining===0,fraction:event.fraction});
  if(!remaining)return finish(pointAt(event.fraction,volume.tacticalLevel),volume.kind,true);
 }
 return finish({...destination},ray.termination,false);
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
