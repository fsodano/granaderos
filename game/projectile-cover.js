import {surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';
import {COMBAT_BALANCE} from './combat-balance.js';
import {absoluteBodyHeight,relativeBodyHeight as height,usesElevationGeometry,groundTileAt,geometryCells,rayHeightIntersection,obstacleVolumesAt} from './sight-geometry.js';
import {projectileTrajectory,projectileTrajectoryPoint,projectileTrajectorySlope,projectileTrajectoryIntervals,projectileTrajectoryLength,projectileTrajectoryAdvance,projectileTrajectorySamples} from './projectile-trajectory.js';

const continuedBall=weapon=>Number.isFinite(weapon.range)&&weapon.range>0&&weapon.loadPattern!=='cone'&&!(weapon.id===1807&&!weapon.loadPattern);
const trajectoryFor=(source,destination,weapon,travelledDistance=0)=>projectileTrajectory(source,destination,continuedBall(weapon)?{range:weapon.range,dropIncrement:COMBAT_BALANCE.firearmFarDropIncrement,travelledDistance}:{});
const flightRangeLimit=(source,aim,weapon,flight)=>flight.maxDistance??Math.max(Math.hypot(aim.x-source.x,aim.y-source.y),Number.isFinite(weapon.range)?Math.max(0,weapon.range)*COMBAT_BALANCE.firearmFlightRangeMultiplier:0);

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
 if(continuedBall(weapon)){
  const distance=Math.hypot(destination.x-source.x,destination.y-source.y)*Math.max(0,Math.min(1,flight.stopFraction??1));
  const trace=continuedProjectileFlight(state,attacker,target,weapon,hitLocation,{...flight,maxDistance:distance,ignoreBodies:true});
  return {blocked:trace.blocked||Boolean(trace.ricochets?.length),damageFactor:trace.ricochets?.length?0:trace.damageFactor,obstacles:trace.obstacles,...(trace.ricochets?{ricochets:trace.ricochets,segments:trace.segments}:{})};
 }
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
 const limit=flightRangeLimit(source,aim,weapon,flight);
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
function materialEvents(state,source,destination,elevated,stopFraction,trajectory,originSource=source){
 const objects=new Map(),events=[];
 for(const cell of geometryCells(source,destination)){
  if(cell.entry>stopFraction)break;
  const ground=groundTileAt(state,cell);if(!ground)continue;
  const origin=originSource&&cell.x===Math.floor(originSource.x+.5)&&cell.y===Math.floor(originSource.y+.5);
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

// Only a unique, actually exposed vertical entry face can reflect a ball.
// Adjacent stone columns do not manufacture internal reflecting surfaces.
function stoneEntryFace(state,trajectory,span){
 const {volume,entry,exit}=span,bounds=volume.bounds;
 if(!volume.stoneFace||!bounds||exit<=entry+1e-10||entry<=1e-10)return null;
 const point=projectileTrajectoryPoint(trajectory,entry),dx=trajectory.destination.x-trajectory.source.x,dy=trajectory.destination.y-trajectory.source.y,faces=[];
 if(point.height<=volume.bottom+1e-10||point.height>=volume.top-1e-10)return null;
 for(const [axis,delta] of [['x',dx],['y',dy]]){
  if(!delta)continue;
  const boundary=bounds[`${delta>0?'min':'max'}${axis.toUpperCase()}`];
  if(Math.abs(point[axis]-boundary)<1e-8)faces.push({x:axis==='x'?-Math.sign(delta):0,y:axis==='y'?-Math.sign(delta):0,height:0});
 }
 if(faces.length!==1)return null;
 const normal=faces[0],outside={x:Math.floor(point.x+normal.x*.25+.5),y:Math.floor(point.y+normal.y*.25+.5)};
 if(obstacleVolumesAt(state,outside).some(other=>other.stoneFace&&point.height>other.bottom+1e-10&&point.height<other.top-1e-10))return null;
 const distance=trajectory.horizontalDistance,slope=projectileTrajectorySlope(trajectory,entry),dot=Math.abs((normal.x*dx+normal.y*dy)/distance)/Math.hypot(1,slope);
 return dot>0&&dot<=COMBAT_BALANCE.firearmRicochetMaximumNormalDot?{normal,impact:point}:null;
}

// Shared deterministic material sweep for continued balls, physical pellets,
// and the bounded cover-only/legacy APIs. Body effects remain point events;
// material loss up to each point is paid before its passage decision.
function traverseMaterialRay(state,source,destination,power,elevated,{stopFraction=1,bodyEvents=[],onBody,onReflect,originSource=source,trajectory=projectileTrajectory(source,destination)}={}){
 const limit=Math.max(0,Math.min(1,stopFraction??1)),events=[...materialEvents(state,source,destination,elevated,limit,trajectory,originSource),...bodyEvents.filter(event=>event.fraction<=limit)];
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
   if(onReflect&&volume.stoneFace){
    const faces=events.filter(other=>other.type==='enter'&&Math.abs(other.fraction-event.fraction)<1e-10).map(other=>({event:other,face:stoneEntryFace(state,trajectory,other.span)})).filter(entry=>entry.face);
    if(faces.length===1&&faces[0].event===event){
     const reflected=onReflect(faces[0].face,remaining);
     if(reflected){const incomingImpact=remaining;remaining=reflected.remainingImpact;receipt.reflected=true;obstacles.push(receipt);return {...finish(event.fraction,volume.tacticalLevel,'reflection',false),reflection:{...faces[0].face,sourceId:volume.id,material:volume.material,incomingImpact,remainingImpact:remaining}};}
    }
   }
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
// Body, material and reflection force loss accumulate independently. Reflection
// has one finite launch budget and never repeats the original muzzle exemption.
function continuedProjectileFlight(state,attacker,target,weapon,hitLocation,flight){
 const ray=firearmRay(state,attacker,target,weapon,hitLocation,flight),power=flight.forceBudget??Math.max(1,weapon.damage??1);
 if(!ray)return {blocked:true,damageFactor:0,obstacles:[],victimId:null,hitLocation};
 const originalSource=ray.source,columns=new Map(),elevated=usesElevationGeometry(state,attacker,target),budget=flightRangeLimit(ray.source,ray.aim,weapon,flight);
 const targetKind=flight.targetKind??((state.npcs??[]).includes(target)?'npc':'unit');
 for(const entry of flight.ignoreBodies?[]:physicalBodies(state)){
  if(entry.kind==='unit'&&entry.body.id===attacker.id)continue;
  const key=`${entry.body.x},${entry.body.y}`,column=columns.get(key)??[];column.push(entry);columns.set(key,column);
 }
 let leg=ray,remaining=power,bodyLoss=0,coverLoss=0,reflectionLoss=0,reachChance=1,travelled=0,trace;
 const bodyImpacts=[],obstacles=[],segments=[],ricochets=[],seen=new Set();
 for(let index=0;index<=COMBAT_BALANCE.firearmRicochetLimit;index++){
  const {source,destination}=leg,trajectory=leg.trajectoryModel??projectileTrajectory(source,destination),events=[];
  for(const cell of geometryCells(source,destination)){
   if(!groundTileAt(state,cell))continue;
   const origin=index===0&&cell.x===Math.floor(originalSource.x+.5)&&cell.y===Math.floor(originalSource.y+.5);
   if(cell.entry===cell.exit||origin&&!elevated)continue;
   for(const {body,kind} of columns.get(`${cell.x},${cell.y}`)??[]){
    const base=surfaceHeight(state,body),top=absoluteBodyHeight(state,body,'head');
    const hits=base===null||top===null?[]:projectileTrajectoryIntervals(trajectory,cell,base,top+.15);
    for(const hit of hits)events.push({fraction:hit.entry,priority:3,key:`${kind}:${body.id}`,cell,body,kind,base});
   }
  }
  trace=traverseMaterialRay(state,source,destination,remaining,elevated,{trajectory,originSource:index===0?originalSource:null,bodyEvents:events,
   onReflect:index<COMBAT_BALANCE.firearmRicochetLimit?(face,incoming)=>({remainingImpact:incoming*COMBAT_BALANCE.firearmRicochetForceRetention}):null,
   onBody:(event,{remaining:incoming,coverLoss:legCoverLoss,pointAt})=>{
    if(seen.has(event.key))return {remaining:incoming};seen.add(event.key);
    const {body,kind,base}=event,z=pointAt(event.fraction,tacticalLevel(body)).height-base;
    const selected=kind===targetKind&&body.id===target.id;
    const dropped=trajectory.curvature>0&&event.fraction>trajectory.dropStart;
    const location=selected&&!flight.physicalHitLocation&&!dropped&&!ricochets.length?hitLocation:z>height(body,'torso')+.2?'head':z<height(body,'legs')+.15?'legs':'torso';
    const resistance=COMBAT_BALANCE.firearmBodyResistance[location],after=Math.max(0,incoming-resistance);
    const chance=Math.max(0,Math.min(COMBAT_BALANCE.firearmBodyPenetrationMaximumChance,incoming-COMBAT_BALANCE.firearmBodyPenetrationThreshold));
    const distance=travelled+trajectory.horizontalDistance*event.fraction;
    const impact={victimId:body.id,victimKind:kind,hitLocation:location,impact:pointAt(event.fraction,tacticalLevel(body)),fraction:event.fraction,distance,segmentIndex:index,incomingImpact:incoming,damageFactor:incoming/power,coverDamageFactor:Math.max(0,1-(coverLoss+legCoverLoss)/power),bodyDamageReduction:bodyLoss/power,...(reflectionLoss?{ricochetDamageReduction:reflectionLoss/power}:{}),bodyResistance:resistance,penetrationChance:after>0?chance:0,reachChance,remainingImpact:after,continued:false};
    const continued=after>0&&chance>0&&flight.bodyPenetration!==false&&(!flight.resolveBody||flight.resolveBody(impact)===true);
    impact.continued=continued;impact.remainingImpact=continued?after:0;bodyImpacts.push(impact);
    if(continued){bodyLoss+=resistance;reachChance*=chance/100;}
    return {remaining:impact.remainingImpact,stopped:!continued};
   }});
  for(const obstacle of trace.obstacles)obstacles.push({...obstacle,distance:travelled+trajectory.horizontalDistance*obstacle.fraction,segmentIndex:index});
  const endDistance=travelled+trajectory.horizontalDistance*trace.fraction;
  segments.push({index,source,destination:trace.impact,trajectoryModel:trajectory,terminalFraction:trace.fraction,fromDistance:travelled,toDistance:endDistance});
  remaining=trace.remaining;coverLoss+=trace.coverLoss;
  if(!trace.reflection)break;
  ricochets.push({...trace.reflection,distance:endDistance});reflectionLoss+=trace.reflection.incomingImpact-trace.reflection.remainingImpact;
  const normal=trace.reflection.normal,dx=(trajectory.destination.x-source.x)/trajectory.horizontalDistance,dy=(trajectory.destination.y-source.y)/trajectory.horizontalDistance,dot=dx*normal.x+dy*normal.y;
  const bearing={x:dx-2*dot*normal.x,y:dy-2*dot*normal.y},origin=trace.impact;
  travelled=endDistance;let distance=Math.max(0,budget-travelled),termination='range';
  for(const [value,delta,size]of [[origin.x,bearing.x,state.width],[origin.y,bearing.y,state.height]]){
   const edge=delta>0?(size-.5-value)/delta:delta<0?(-.5-value)/delta:Infinity;
   if(edge<distance){distance=Math.max(0,edge);termination='edge';}
  }
  const end={x:origin.x+bearing.x*distance,y:origin.y+bearing.y*distance,height:origin.height+projectileTrajectorySlope(trajectory,trace.fraction)*distance,tacticalLevel:origin.tacticalLevel};
  const model=trajectoryFor(origin,end,weapon,travelled);
  leg={source:origin,destination:projectileTrajectoryPoint(model,1),trajectoryModel:model,termination};
 }
 const last=segments.at(-1),reflected=ricochets.length>0,first=bodyImpacts[0];
 for(const entry of [...bodyImpacts,...obstacles]){if(reflected)entry.fraction=entry.distance/budget;else{delete entry.distance;delete entry.segmentIndex;}}
 const terminal={impact:trace.impact,termination:trace.termination??leg.termination,blocked:trace.blocked,remainingImpact:trace.remaining,...(reflected?{fraction:last.toDistance/budget,distance:last.toDistance,segmentIndex:last.index}:leg.trajectoryModel?.curvature?{fraction:trace.fraction}:{})};
 // Existing generic consumers still address the first physical intersection.
 // Named-target forecasts select their own typed entry from bodyImpacts.
 return {blocked:first?false:trace.blocked,damageFactor:first?.damageFactor??trace.remaining/power,obstacles,victimId:first?.victimId??null,...(first?.victimKind==='npc'?{victimKind:'npc'}:{}),hitLocation:first?.hitLocation??hitLocation,destination:leg.destination,impact:first?.impact??trace.impact,termination:first?'body':terminal.termination,bodyImpacts,terminal,...(reflected?{segments,ricochets}:leg.trajectoryModel?.curvature?{trajectoryModel:leg.trajectoryModel,trajectory:projectileTrajectorySamples(leg.trajectoryModel,trace.fraction)}:{})};
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
