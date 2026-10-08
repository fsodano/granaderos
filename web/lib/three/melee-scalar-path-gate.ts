import {Vector3} from 'three';
import type {NativeMeleeContactFit} from './melee-contact-fit';
const angle=(value:number)=>Math.atan2(Math.sin(value),Math.cos(value));
const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
/** Exact current complete-boot values serve every original chronological
 * sole/support/velocity check. No warm lower pose or accepted recipe enters
 * this gate. Detached/morph footwear keeps the original native path. */
export function scalarRiflePathGate(fit:NativeMeleeContactFit,knownPairs:number[][]=[]){
 const source=fit as any,pf=source.previewFit,original=source.pathAllowed,boot=pf.completeBoot;
 if(!boot||boot.vertices.some((vertex:number,index:number)=>vertex!==index)||boot.mesh.bindMode!=='attached'||boot.mesh.geometry.morphAttributes.position?.length)return ()=>{};
 const soles=[...pf.soles.values()] as any[],floorsFor=(support:any)=>support.floors.filter((floor:any)=>Math.abs(floor.height-source.sampleRoot.position.y)<.001);
 function floorAllowed(points:Float64Array,before:Float64Array|undefined,support:any){const floors=floorsFor(support);for(const sole of soles){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const vertex of sole.outline){const at=vertex*3,x=points[at],z=points[at+2];minX=Math.min(minX,x,before?.[at]??x);maxX=Math.max(maxX,x,before?.[at]??x);minZ=Math.min(minZ,z,before?.[at+2]??z);maxZ=Math.max(maxZ,z,before?.[at+2]??z);}minX-=.003;maxX+=.003;minZ-=.003;maxZ+=.003;const cuts=[minX,maxX,...floors.flatMap((floor:any)=>[floor.minX,floor.maxX]).filter((x:number)=>x>minX&&x<maxX)].sort((a:number,b:number)=>a-b);for(let index=1;index<cuts.length;index++){if(cuts[index]-cuts[index-1]<1e-10)continue;const x=(cuts[index]+cuts[index-1])/2,spans=floors.filter((floor:any)=>x>=floor.minX&&x<=floor.maxX).map((floor:any)=>[Math.max(minZ,floor.minZ),Math.min(maxZ,floor.maxZ)]).filter(([a,b]:number[])=>b>=a).sort((a:number[],b:number[])=>a[0]-b[0]);let covered=minZ;for(const [a,b]of spans){if(a>covered+1e-8)break;covered=Math.max(covered,b);}if(covered<maxZ-1e-8)return false;}}return soles.length===2;}
 source.pathAllowed=function(plan:any,clip:any,support:any,action:any){
  if(!plan.twoHands)return original.call(this,plan,clip,support,action);
  if(!source.walkingStep||!source.walkingFootSpeed||plan.step.length()>source.walkingStep||plan.rearStep.length()>source.walkingStep||1.5*(plan.step.length()+plan.rearStep.length())/(plan.contact*.9-plan.duration*.1)>source.walkingFootSpeed||!source.walkingSoleSpeed||!source.walkingBootSpeed)return false;
  let previous:{time:number;points:Float64Array;centres:Vector3[]}|undefined,buffer:Float64Array|undefined;
  const native=(time:number)=>{if(plan.turn)source.sampleRoot.rotation.set(0,plan.turn.fromYaw+angle(plan.turn.toYaw-plan.turn.fromYaw)*smooth(time/plan.turn.until),0);pf.restore();action.time=time;action.timeScale=0;source.sampleMixer.update(0);source.sampleRoot.updateMatrixWorld(true);pf.pose(plan,time);};
  const sample=(time:number)=>{native(time);const points=source.completeBootPoints(buffer),floor=source.sampleRoot.position.y,centres:Vector3[]=[];let lowest=Infinity,supported=false;
   for(const sole of soles){let minimum=Infinity,low=Infinity,high=-Infinity;for(const vertex of sole.vertices)minimum=Math.min(minimum,points[vertex*3+1]-floor);lowest=Math.min(lowest,minimum);const centre=new Vector3();for(const vertex of sole.outline){const at=vertex*3,y=points[at+1]-floor;low=Math.min(low,y);high=Math.max(high,y);centre.x+=points[at];centre.y+=points[at+1];centre.z+=points[at+2];}centre.divideScalar(sole.outline.length);centres.push(centre);if(low>=-.001&&high<=.008)supported=true;}
   if(!(lowest>=-.001&&lowest<=.008&&supported))return false;
   const prior=previous;if(prior&&time>prior.time){const dt=time-prior.time;for(let side=0;side<centres.length;side++){const delta=centres[side].clone().sub(prior.centres[side]);if(delta.length()/dt>source.walkingFootSpeed+1e-6)return false;}for(const sole of soles)for(const vertex of sole.outline){const at=vertex*3,x=points[at]-prior.points[at],y=points[at+1]-prior.points[at+1],z=points[at+2]-prior.points[at+2];if(Math.sqrt(x*x+y*y+z*z)/dt>source.walkingSoleSpeed+1e-6)return false;}if(!source.bootSpeedAllowed(points,prior.points,dt)){source.rifleSpeedPair=[prior.time,time];return false;}}
   if(!floorAllowed(points,prior?.points,support)||!(pf.footReachError<.001)||!(pf.handReachError<1e-7))return false;
   buffer=prior?.points;previous={time,points,centres};return true;
  };
  source.pathPrevious=undefined;source.pathFeet=undefined;
  if(!sample(plan.contact)||!source.bodyAllowed(support))return false;
  const pair=source.rifleSpeedPair,pairs=[...(pair?[pair]:[]),...knownPairs.filter(value=>!pair||value[0]!==pair[0]||value[1]!==pair[1])];for(const times of pairs){if(times.length!==2||!times.every(Number.isFinite)||times[0]<0||times[1]>clip.duration||Math.abs(times[1]-times[0]-1/240)>1e-12)throw Error('MELEE_NATIVE_PAIR_INVALID');native(times[0]);const first=source.completeBootPoints();native(times[1]);const second=source.completeBootPoints();if(!source.bootSpeedAllowed(second,first,times[1]-times[0])){source.rifleSpeedPair=[times[0],times[1]];return false;}}
  previous=undefined;buffer=undefined;source.pathPrevious=undefined;source.pathFeet=undefined;
  for(let index=0;index<=Math.ceil(clip.duration*240);index++)if(!sample(Math.min(clip.duration,index/240))||index%4===0&&!source.bodyAllowed(support))return false;
  return true;
 };
 return ()=>{source.pathAllowed=original;};
}
