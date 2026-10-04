import {surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';
import {COMBAT_BALANCE} from './combat-balance.js';
import {absoluteBodyHeight,relativeBodyHeight as height,usesElevationGeometry,groundTileAt,geometryCells,rayHeightIntersection,obstacleVolumesAt} from './sight-geometry.js';
import {projectileTrajectory,projectileTrajectoryPoint,projectileTrajectoryIntervals,projectileTrajectoryLength,projectileTrajectoryAdvance,projectileTrajectorySamples} from './projectile-trajectory.js';

const continuedBall=weapon=>Number.isFinite(weapon.range)&&weapon.range>0&&weapon.loadPattern!=='cone'&&!(weapon.id===1807&&!weapon.loadPattern);
const trajectoryFor=(source,destination,weapon)=>projectileTrajectory(source,destination,continuedBall(weapon)?{range:weapon.range,dropIncrement:COMBAT_BALANCE.firearmFarDropIncrement}:{});

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
 const source={x:attacker.x,y:attacker.y,height:absoluteBodyHeight(state,attacker,'muzzle'),tacticalLevel:tacticalLevel(attacker)};
 const destination={x:target.x,y:target.y,height:flight.destinationHeight??absoluteBodyHeight(state,target,hitLocation),tacticalLevel:tacticalLevel(target)};
 const power=flight.forceBudget??Math.max(1,weapon.damage??1);
 if(!Number.isFinite(source.height)||!Number.isFinite(destination.height))return {blocked:true,damageFactor:0,obstacles:[]};
 // This bounded cover-only API ends at its requested point. Legacy short
 // flights use the same depth calculation, without gaining continued flight.
 const trace=traverseMaterialRay(state,source,destination,power,usesElevationGeometry(state,attacker,target),{stopFraction:flight.stopFraction,trajectory:trajectoryFor(source,destination,weapon)});
 return {blocked:trace.blocked,damageFactor:trace.remaining/power,obstacles:trace.obstacles};
}

// A shot retains its original destination height. Living bodies in
// crossed cells can intercept it, including allies and unconscious soldiers.
// Cell-wide silhouettes and body resistance are explicit game tuning.
export function projectileFlight(state,attacker,target,weapon,hitLocation='torso',flight={}){
  if(continuedBall(weapon))return continuedProjectileFlight(state,attacker,target,weapon,hitLocation,flight);
  return boundedProjectileFlight(state,attacker,target,weapon,hitLocation,flight);
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
 const limit=flight.maxDistance??Math.max(distance,Number.isFinite(weapon.range)?Math.max(0,weapon.range)*COMBAT_BALANCE.firearmFlightRangeMultiplier:distance);
 let scale=distance?limit/distance:1,termination='range';
 for(const [value,delta,size] of [[source.x,dx,state.width],[source.y,dy,state.height]]){
  const edge=delta>0?(size-.5-value)/delta:delta<0?(-.5-value)/delta:Infinity;
  if(edge<scale){scale=Math.max(0,edge);termination='edge';}
 }
 const destination={x:source.x+dx*scale,y:source.y+dy*scale,height:source.height+(aim.height-source.height)*scale,tacticalLevel:aim.tacticalLevel};
 const trajectoryModel=trajectoryFor(source,destination,weapon);
 return {source,aim,destination:trajectoryModel.curvature?projectileTrajectoryPoint(trajectoryModel,1):destination,termination,...(trajectoryModel.curvature?{trajectoryModel}:{})};
}

// A resistance value is force lost per one tactical unit of crossed material.
// Merge one object's clipped intervals before sweeping; a wide prop must not
// pay once per cell, nor lose its later depth through ID deduplication.
function materialEvents(state,source,destination,elevated,stopFraction,trajectory){
 const objects=new Map(),events=[];
 for(const cell of geometryCells(source,destination)){
  if(cell.entry>stopFraction)break;
  const ground=groundTileAt(state,cell);if(!ground)continue;
  const origin=cell.x===Math.floor(source.x+.5)&&cell.y===Math.floor(source.y+.5);
  for(const volume of obstacleVolumesAt(state,cell)){
   // Preserve the established flat muzzle-cell cover rule. Floor slabs and
   // ground still stop a shot in the origin cell.
   if(origin&&!elevated&&volume.kind!=='slab')continue;
   const hits=projectileTrajectoryIntervals(trajectory,cell,volume.bottom,volume.top,stopFraction);
   for(const hit of hits){
    if(volume.solid){events.push({fraction:hit.entry,priority:1,key:volume.id,type:'solid',cell,volume});continue;}
    // A corner or height-boundary touch crosses no material. It cannot spend
    // force. A zero-resistance volume also has no physical force consequence.
    if(hit.exit<=hit.entry||volume.resistance<=0)continue;
    const intervals=objects.get(volume.id)??[];intervals.push({...hit,cell,volume});objects.set(volume.id,intervals);
   }
  }
  const groundHeight=ground.elevation??0;
  const bottom=Math.min(source.height,projectileTrajectoryPoint(trajectory,stopFraction).height,groundHeight)-1;
  for(const hit of projectileTrajectoryIntervals(trajectory,cell,bottom,groundHeight,stopFraction))events.push({fraction:hit.entry,priority:0,key:`ground:${cell.x},${cell.y}`,type:'solid',cell,volume:{id:`ground:${cell.x},${cell.y}`,kind:'ground',tacticalLevel:0,material:ground.material??'earth',solid:true}});
 }
 for(const [key,intervals] of objects){
  intervals.sort((a,b)=>a.entry-b.entry||a.exit-b.exit);
  const merged=[];
  for(const interval of intervals){
   const previous=merged.at(-1);
   if(previous&&interval.entry<=previous.exit+1e-10)previous.exit=Math.max(previous.exit,interval.exit);
   else merged.push({...interval});
  }
  for(const span of merged){
   events.push({fraction:span.entry,priority:2,key,type:'enter',span});
   events.push({fraction:span.exit,priority:4,key,type:'exit',span});
  }
 }
 return events;
}

// Shared deterministic material sweep for continued balls, physical pellets,
// and the bounded cover-only/legacy APIs. Body effects remain point events;
// material loss up to each point is paid before its passage decision.
function traverseMaterialRay(state,source,destination,power,elevated,{stopFraction=1,bodyEvents=[],onBody,trajectory=projectileTrajectory(source,destination)}={}){
 const limit=Math.max(0,Math.min(1,stopFraction??1)),events=[...materialEvents(state,source,destination,elevated,limit,trajectory),...bodyEvents.filter(event=>event.fraction<=limit)];
 events.sort((a,b)=>a.fraction-b.fraction||a.priority-b.priority||a.key.localeCompare(b.key));
 const active=new Map(),obstacles=[];
 let remaining=power,coverLoss=0,previous=0;
 const pointAt=(fraction,level)=>trajectory.curvature?projectileTrajectoryPoint(trajectory,fraction,level):({x:source.x+(destination.x-source.x)*fraction,y:source.y+(destination.y-source.y)*fraction,height:source.height+(destination.height-source.height)*fraction,tacticalLevel:level});
 const finish=(fraction,level,termination,blocked)=>({remaining,coverLoss,obstacles,impact:pointAt(fraction,level),fraction,termination,blocked});
 const advance=fraction=>{
  const density=[...active.values()].reduce((sum,entry)=>sum+entry.span.volume.resistance,0),distance=projectileTrajectoryLength(trajectory,previous,fraction);
  if(density>0&&distance>0){
   const debit=density*distance,roundoff=8*Number.EPSILON*Math.max(power,remaining,debit);
   // A mathematically exhausted boundary must not leave rounding dust that
   // can reach a body or cause a passage roll. Preserve real positive force.
   const exhausted=debit>=remaining||remaining-debit<=roundoff,traveled=exhausted?Math.min(distance,remaining/density):distance;
   for(const {span,receipt} of active.values())receipt.resistance+=span.volume.resistance*traveled;
   const loss=exhausted?remaining:density*distance;remaining-=loss;coverLoss+=loss;
   if(exhausted){
    const at=projectileTrajectoryAdvance(trajectory,previous,fraction,traveled),{span,receipt}=[...active.entries()].sort(([a],[b])=>a.localeCompare(b))[0][1];
    receipt.stopped=true;
    return finish(at,span.volume.tacticalLevel,span.volume.kind,true);
   }
  }
  previous=fraction;return null;
 };
 for(const event of events){
  const stopped=advance(event.fraction);if(stopped)return stopped;
  // Obstacle receipts retain the entry fraction and actual consumed force.
  // The separate terminal impact records the exact interior stop position.
  if(event.type==='enter'){
   const {span}=event,{volume,cell}=span,receipt={x:cell.x,y:cell.y,tacticalLevel:volume.tacticalLevel,kind:volume.kind,sourceId:volume.id,material:volume.material,resistance:0,stopped:false,fraction:event.fraction};
   obstacles.push(receipt);active.set(event.key,{span,receipt});
  }else if(event.type==='exit')active.delete(event.key);
  else if(event.type==='solid'){
   const {volume,cell}=event;
   obstacles.push({x:cell.x,y:cell.y,tacticalLevel:volume.tacticalLevel,kind:volume.kind,sourceId:volume.id,material:volume.material,resistance:remaining,stopped:true,fraction:event.fraction});
   coverLoss+=remaining;remaining=0;return finish(event.fraction,volume.tacticalLevel,volume.kind,true);
  }else if(event.body){
   const result=onBody(event,{remaining,coverLoss,pointAt});remaining=result.remaining;
   if(result.stopped)return finish(event.fraction,tacticalLevel(event.body),'body',false);
  }
 }
 return advance(limit)??finish(limit,destination.tacticalLevel,null,false);
}

// Resolve cover, solid ground/floors and bodies in physical intersection order.
// The same ray serves actual fire and knowledge-filtered forecasts. Forecasts
// assume possible body passage without RNG; actual fire supplies resolveBody.
// Body and cover force loss accumulate independently. The ray never ricochets.
function continuedProjectileFlight(state,attacker,target,weapon,hitLocation,flight){
 const ray=firearmRay(state,attacker,target,weapon,hitLocation,flight),power=flight.forceBudget??Math.max(1,weapon.damage??1);
 if(!ray)return {blocked:true,damageFactor:0,obstacles:[],victimId:null,hitLocation};
 const {source,destination}=ray,trajectory=ray.trajectoryModel??projectileTrajectory(source,destination),events=[],columns=new Map(),elevated=usesElevationGeometry(state,attacker,target);
 const targetKind=flight.targetKind??((state.npcs??[]).includes(target)?'npc':'unit');
 for(const entry of physicalBodies(state)){
  if(entry.kind==='unit'&&entry.body.id===attacker.id)continue;
  const key=`${entry.body.x},${entry.body.y}`,column=columns.get(key)??[];column.push(entry);columns.set(key,column);
 }
 for(const cell of geometryCells(source,destination)){
  if(!groundTileAt(state,cell))continue;
  const origin=cell.x===Math.floor(source.x+.5)&&cell.y===Math.floor(source.y+.5);
  if(cell.entry===cell.exit||origin&&!elevated)continue; // A body cannot be struck through a corner touch.
  for(const {body,kind} of columns.get(`${cell.x},${cell.y}`)??[]){
   const base=surfaceHeight(state,body),top=absoluteBodyHeight(state,body,'head');
   const hits=base===null||top===null?[]:projectileTrajectoryIntervals(trajectory,cell,base,top+.15);
   for(const hit of hits)events.push({fraction:hit.entry,priority:3,key:`${kind}:${body.id}`,cell,body,kind,base});
  }
 }
 let bodyLoss=0,reachChance=1;const bodyImpacts=[],seen=new Set();
 const trace=traverseMaterialRay(state,source,destination,power,elevated,{trajectory,bodyEvents:events,onBody:(event,{remaining,coverLoss,pointAt})=>{
  if(seen.has(event.key))return {remaining};seen.add(event.key);
  const {body,kind,base}=event,z=pointAt(event.fraction,tacticalLevel(body)).height-base;
  const selected=kind===targetKind&&body.id===target.id;
  const dropped=trajectory.curvature>0&&event.fraction>trajectory.dropStart;
  const location=selected&&!flight.physicalHitLocation&&!dropped?hitLocation:z>height(body,'torso')+.2?'head':z<height(body,'legs')+.15?'legs':'torso';
  const resistance=COMBAT_BALANCE.firearmBodyResistance[location],after=Math.max(0,remaining-resistance);
  const chance=Math.max(0,Math.min(COMBAT_BALANCE.firearmBodyPenetrationMaximumChance,remaining-COMBAT_BALANCE.firearmBodyPenetrationThreshold));
  const impact={victimId:body.id,victimKind:kind,hitLocation:location,impact:pointAt(event.fraction,tacticalLevel(body)),fraction:event.fraction,incomingImpact:remaining,damageFactor:remaining/power,coverDamageFactor:Math.max(0,1-coverLoss/power),bodyDamageReduction:bodyLoss/power,bodyResistance:resistance,penetrationChance:after>0?chance:0,reachChance,remainingImpact:after,continued:false};
  const continued=after>0&&chance>0&&flight.bodyPenetration!==false&&(!flight.resolveBody||flight.resolveBody(impact)===true);
  impact.continued=continued;impact.remainingImpact=continued?after:0;bodyImpacts.push(impact);
  if(continued){bodyLoss+=resistance;reachChance*=chance/100;}
  return {remaining:impact.remainingImpact,stopped:!continued};
 }});
 const first=bodyImpacts[0],terminal={impact:trace.impact,termination:trace.termination??ray.termination,blocked:trace.blocked,remainingImpact:trace.remaining,...(trajectory.curvature?{fraction:trace.fraction}:{})};
 // Existing generic consumers still address the first physical intersection.
 // Named-target forecasts select their own typed entry from bodyImpacts.
 return {blocked:first?false:trace.blocked,damageFactor:first?.damageFactor??trace.remaining/power,obstacles:trace.obstacles,victimId:first?.victimId??null,...(first?.victimKind==='npc'?{victimKind:'npc'}:{}),hitLocation:first?.hitLocation??hitLocation,destination,impact:first?.impact??trace.impact,termination:first?'body':terminal.termination,bodyImpacts,terminal,...(trajectory.curvature?{trajectoryModel:trajectory,trajectory:projectileTrajectorySamples(trajectory,trace.fraction)}:{})};
}

function boundedProjectileFlight(state,attacker,target,weapon,hitLocation,flight){
 const muzzle=absoluteBodyHeight(state,attacker,'muzzle'),destination=flight.destinationHeight??absoluteBodyHeight(state,target,hitLocation);
 if(muzzle===null||!Number.isFinite(destination))return {blocked:true,damageFactor:0,obstacles:[],victimId:null,hitLocation};
 const bodies=physicalBodies(state),elevated=usesElevationGeometry(state,attacker,target),targetKind=flight.targetKind??((state.npcs??[]).includes(target)?'npc':'unit');
 for(const cell of geometryCells(attacker,target)){
  if(cell.entry===cell.exit||!elevated&&cell.x===Math.floor(attacker.x+.5)&&cell.y===Math.floor(attacker.y+.5))continue;
  const victims=bodies.filter(({body,kind})=>(kind==='npc'||body.id!==attacker.id)&&body.x===cell.x&&body.y===cell.y).map(({body:unit,kind})=>{
   const base=surfaceHeight(state,unit),top=absoluteBodyHeight(state,unit,'head');
   return {unit,kind,base,hit:base===null||top===null?null:rayHeightIntersection(muzzle,destination,cell,base,top+.15)};
  }).filter(victim=>victim.hit).sort((a,b)=>a.hit.entry-b.hit.entry||String(a.unit.id).localeCompare(String(b.unit.id))||a.kind.localeCompare(b.kind));
  if(!victims.length)continue;
  const {unit:victim,kind,base,hit}=victims[0],relative=muzzle+(destination-muzzle)*hit.entry-base;
  const location=kind===targetKind&&victim.id===target.id?hitLocation:relative>height(victim,'torso')+.2?'head':relative<height(victim,'legs')+.15?'legs':'torso';
  const path=projectilePath(state,attacker,target,weapon,hitLocation,{...flight,destinationHeight:destination,stopFraction:hit.entry});
  return {...path,victimId:path.blocked?null:victim.id,...(!path.blocked&&kind==='npc'?{victimKind:'npc'}:{}),hitLocation:location};
 }
 return {...projectilePath(state,attacker,target,weapon,hitLocation,{...flight,destinationHeight:destination}),victimId:null,hitLocation};
}

export function validateCoverMetadata(value){
  for(const [key,max]of [['obstacleHeight',10],['projectileResistance',1000],['concealment',100]]){
    if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>max))throw Error('La cobertura guardada no es válida.');
  }
}
