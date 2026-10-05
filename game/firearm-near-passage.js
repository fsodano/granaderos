import {absoluteBodyHeight} from './sight-geometry.js';
import {surfaceHeight} from './tactical-space.js';
import {projectileTrajectoryPoint} from './projectile-trajectory.js';

// Existing Granaderos near-passage geometry, independent of learning or RNG.
export const NEAR_MISS_DISTANCE=.9;
export const NEAR_MISS_HEIGHT_MARGIN=.25;
const finitePoint=point=>point&&[point.x,point.y,point.height].every(Number.isFinite);

// Use the exact fired curve at the recipient's XY projection. Sampled
// presentation points and the chord to a lower ground stop cannot create
// a perceived passage or practice. Fractions belong to the unchanged XY ray.
function passageHeight(flight,from,stop,fraction){
 const model=flight.trajectoryModel;
 if(model===undefined)return flight.trajectory===undefined?from.height+(stop.height-from.height)*fraction:null;
 const terminalFraction=flight.terminal?.fraction;
 if(!finitePoint(model?.source)||!finitePoint(model.destination)||![model.horizontalDistance,model.rise,model.dropStart,model.curvature].every(Number.isFinite)||!Number.isFinite(terminalFraction)||terminalFraction<=0||terminalFraction>1)return null;
 const first=projectileTrajectoryPoint(model,0),last=projectileTrajectoryPoint(model,terminalFraction);
 if(!finitePoint(first)||!finitePoint(last))return null;
 if(Math.hypot(first.x-from.x,first.y-from.y,first.height-from.height)>1e-8||Math.hypot(last.x-stop.x,last.y-stop.y,last.height-stop.height)>1e-8)return null;
 return projectileTrajectoryPoint(model,terminalFraction*fraction)?.height??null;
}

function firedPassages(flight,attacker,state){
 if(flight.segments!==undefined||flight.ricochets!==undefined){
  if(!Array.isArray(flight.segments)||!flight.segments.length)return null;
  const passages=[];let previous=null,distance=0;
  for(const segment of flight.segments){
   const from=segment?.source,stop=segment?.destination,model=segment?.trajectoryModel;
   if(!finitePoint(from)||!finitePoint(stop)||!Number.isFinite(segment.fromDistance)||!Number.isFinite(segment.toDistance)||Math.abs(segment.fromDistance-distance)>1e-8||segment.toDistance<=segment.fromDistance||previous&&Math.hypot(from.x-previous.x,from.y-previous.y,from.height-previous.height)>1e-8)return null;
   const receipt={trajectoryModel:model,terminal:{fraction:segment.terminalFraction}};
   if(passageHeight(receipt,from,stop,.5)===null||Math.abs(Math.hypot(stop.x-from.x,stop.y-from.y)-(segment.toDistance-segment.fromDistance))>1e-8)return null;
   passages.push({from,stop,height:fraction=>passageHeight(receipt,from,stop,fraction)});previous=stop;distance=segment.toDistance;
  }
  const terminal=flight.terminal?.impact;
  if(!finitePoint(terminal)||Math.hypot(previous.x-terminal.x,previous.y-terminal.y,previous.height-terminal.height)>1e-8)return null;
  return passages;
 }
 const from=flight.trajectoryModel?.source??{x:attacker.x,y:attacker.y,height:absoluteBodyHeight(state,attacker,'muzzle')},stop=flight.terminal?.impact??flight.impact;
 return finitePoint(from)&&finitePoint(stop)?[{from,stop,height:fraction=>passageHeight(flight,from,stop,fraction)}]:null;
}

export function firearmPassesNear(state,attacker,target,flight){
 if(!flight||!attacker||!target)return false;
 const passages=firedPassages(flight,attacker,state);if(!passages)return false;
 const base=surfaceHeight(state,target),top=absoluteBodyHeight(state,target,'head');
 if(base===null||top===null)return false;
 return passages.some(({from,stop,height})=>{
  const dx=stop.x-from.x,dy=stop.y-from.y,length=dx*dx+dy*dy;if(!length)return false;
  const fraction=((target.x-from.x)*dx+(target.y-from.y)*dy)/length;
  // Only a real passage before a leg's physical stop qualifies. In particular,
  // the original source-to-terminal chord is not a reflected flight path.
  if(fraction<=0||fraction>=1)return false;
  const x=from.x+dx*fraction,y=from.y+dy*fraction,z=height(fraction);
  return Number.isFinite(z)&&Math.hypot(target.x-x,target.y-y)<=NEAR_MISS_DISTANCE&&z>=base-NEAR_MISS_HEIGHT_MARGIN&&z<=top+.15+NEAR_MISS_HEIGHT_MARGIN;
 });
}
