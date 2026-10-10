// Transient presentation is separate from campaign/save state. Recording never
// changes orders, randomness, AP, visibility or the returned authoritative state.
import {projectileTrajectoryPoint} from './projectile-trajectory.js';
import {markFirearmNearMissPresented} from './firearm-near-miss-feedback.js';
import {surfaceAt,tacticalLevel} from './tactical-space.js';
import {obstacleVolumesAt} from './sight-geometry.js';
import {wallEdgeId,wallEdgeCells} from './wall-geometry.js';
import {isInteriorVisible} from './tactical-visibility.js';
let recorder=null,recordingShotHand=null;
export function withBattleShotHand(hand,execute){const previous=recordingShotHand;recordingShotHand=hand==='offhand'?'offhand':'primary';try{return execute();}finally{recordingShotHand=previous;}}
export function recordBattleFrame(state,event){
 if(!recorder)return;
 if(event.shotVisual){const shotHand=recordingShotHand??(event.shotVisual.shotHand==='offhand'?'offhand':'primary');recorder(state,{...event,shotHand,shotVisual:{...event.shotVisual,shotHand}});}
 else recorder(state,event);
}
// Reuse unchanged branches between frames. Tiles and buildings normally share
// one copy; a breach still receives its own snapshot at the correct instant.
function snapshot(value,previous){
 if(value===null||typeof value!=='object')return value;
 const keys=Object.keys(value),sameKind=previous&&typeof previous==='object'&&Array.isArray(value)===Array.isArray(previous);
 let same=Boolean(sameKind&&keys.length===Object.keys(previous).length);
 const next=Array.isArray(value)?[]:{};
 for(const key of keys){next[key]=snapshot(value[key],sameKind?previous[key]:undefined);if(!sameKind||next[key]!==previous[key])same=false;}
 return same?previous:next;
}
const bodyEntries=state=>[...state.units.map(body=>({body,kind:'unit'})),...(state.npcs??[]).map(body=>({body,kind:'npc'}))];
const bodyKey=(kind,id)=>`${kind}:${id}`;
function visibleSignature(state,visible){return JSON.stringify(bodyEntries(state).filter(({body,kind})=>visible.has(bodyKey(kind,body.id))).map(({body:u,kind})=>[kind,u.id,u.x,u.y,u.tacticalLevel,u.hp,u.energy,u.loaded,u.stance,u.unconscious,u.departure,u.fled]));}
function observedStoneContact(state,point,contact,canObserve,canObserveExterior){
 if(!contact||!point||!contact.point||tacticalLevel(point)!==tacticalLevel(contact.point)||!['x','y','height'].every(key=>Number.isFinite(point[key])&&Number.isFinite(contact.point[key])&&Math.abs(point[key]-contact.point[key])<1e-8))return false;
 const match=typeof contact.sourceId==='string'&&/^surface:(\d+):(\d+),(\d+)$/.exec(contact.sourceId);
 const edge=typeof contact.sourceId==='string'&&contact.sourceId.startsWith('edge:')?
  (state.wallEdges??[]).find(edge=>`edge:${wallEdgeId(edge)}`===contact.sourceId):null;
 if(!match&&!edge)return false;
 const cell=edge?wallEdgeCells(edge)[0]:{tacticalLevel:Number(match[1]),x:Number(match[2]),y:Number(match[3])},surface=edge??surfaceAt(state,cell);
 const volume=surface&&obstacleVolumesAt(state,cell).find(volume=>volume.id===contact.sourceId&&['cover','edge'].includes(volume.kind)&&volume.stoneFace);
 if(!volume||tacticalLevel(point)!==cell.tacticalLevel||point.height<=volume.bottom+1e-8||point.height>=volume.top-1e-8)return false;
 const normal=contact.normal,bounds=volume.bounds;
 if(!normal||normal.height!==0)return false;
 const onFace=normal.y===0&&Math.abs(normal.x)===1?
  Math.abs(point.x-(normal.x<0?bounds.minX:bounds.maxX))<1e-8&&point.y>bounds.minY+1e-8&&point.y<bounds.maxY-1e-8:
  normal.x===0&&Math.abs(normal.y)===1&&Math.abs(point.y-(normal.y<0?bounds.minY:bounds.maxY))<1e-8&&point.x>bounds.minX+1e-8&&point.x<bounds.maxX-1e-8;
 if(!onFace)return false;
 if(!canObserveExterior(state,surface))return false;
 const outside={x:Math.floor(point.x+normal.x*.25+.5),y:Math.floor(point.y+normal.y*.25+.5)};
 // Private neighbouring material still affects physics, but cannot veto a
 // visible exterior contact in the public presentation.
 if(obstacleVolumesAt(state,outside).some(other=>{
  if(other.id===volume.id||!other.stoneFace||point.height<=other.bottom+1e-8||point.height>=other.top-1e-8)return false;
  if(other.kind==='edge'){
   const bounds=other.bounds,x=point.x+normal.x*.0001,y=point.y+normal.y*.0001;
   if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY)return false;
   const neighbour=(state.wallEdges??[]).find(edge=>`edge:${wallEdgeId(edge)}`===other.id);
   return neighbour&&canObserveExterior(state,neighbour);
  }
  if(other.kind==='cover'){
   const neighbour=surfaceAt(state,{...outside,tacticalLevel:other.tacticalLevel});
   return neighbour&&canObserveExterior(state,neighbour);
  }
  if(other.kind==='prop'){
   const prop=(state.props??[]).find(prop=>other.id===`prop:${prop.id}`);
   return prop&&isInteriorVisible(state,prop,new Set(state.revealedRooms??[]))&&canObserve(state,prop);
  }
  return false;
 }))return false;
 return true;
}
function observedShot(state,raw,known,canObserve,canObserveExterior){
 if(!raw)return null;
 // An unseen interception cannot disclose a concealed body or its coordinates.
 // In that case only the observed part of the original ray is shown.
 const hiddenVictim=raw.victimId&&(!raw.victimObserved||!known.has(bodyKey(raw.victimKind??'unit',raw.victimId))),end=hiddenVictim?raw.destination:raw.impact;
 if(![raw.source,end].every(point=>point&&[point.x,point.y,point.height].every(Number.isFinite)))return null;
 if(raw.discharge===false&&!canObserve(state,{...raw.source,x:Math.round(raw.source.x),y:Math.round(raw.source.y)})&&!observedStoneContact(state,raw.source,raw.sourceSurfaceContact,canObserve,canObserveExterior))return null;
 const distance=Math.hypot(end.x-raw.source.x,end.y-raw.source.y),points=[];
 if(raw.trajectoryModel!==undefined){
  const model=raw.trajectoryModel,start=projectileTrajectoryPoint(model,0),finish=projectileTrajectoryPoint(model,1);
  if(!start||!finish||!Number.isFinite(model.horizontalDistance)||model.horizontalDistance<=0)return null;
  const dx=finish.x-start.x,dy=finish.y-start.y,length=dx*dx+dy*dy;
  const progress=point=>((point.x-start.x)*dx+(point.y-start.y)*dy)/length;
  const from=progress(raw.source),to=progress(end);
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to>1||to<from)return null;
  // Sample the same fixed XY grid before any visibility boundary. A private
  // stop or fallback endpoint cannot shift the visible sampling positions.
  for(let step=Math.floor(from*model.horizontalDistance*4)+1;step/4<to*model.horizontalDistance;step++){
   const point=projectileTrajectoryPoint(model,step/(4*model.horizontalDistance),raw.source.tacticalLevel);if(!point)return null;points.push(point);
  }
  const point=projectileTrajectoryPoint(model,to,end.tacticalLevel);if(!point)return null;points.push(point);
 }else{
  const steps=Math.max(1,Math.ceil(distance*4));
  for(let index=1;index<=steps;index++){
   const fraction=index/steps;points.push({x:raw.source.x+(end.x-raw.source.x)*fraction,y:raw.source.y+(end.y-raw.source.y)*fraction,height:raw.source.height+(end.height-raw.source.height)*fraction,tacticalLevel:fraction===1?end.tacticalLevel:raw.source.tacticalLevel});
  }
 }
 let last=raw.source,complete=true;
 for(const point of points){
  // Only an exact known side-face endpoint can use its surface's visibility.
  // Every intermediate sample remains an ordinary point; no opaque cell is
  // made transparent, and the private contact proof is omitted below.
  const contact=point===points.at(-1)&&end===raw.impact?raw.impactSurfaceContact:null;
  if(!canObserve(state,{...point,x:Math.round(point.x),y:Math.round(point.y)})&&!observedStoneContact(state,point,contact,canObserve,canObserveExterior)){complete=false;break;}
  last=point;
 }
 if(last===raw.source)return null;
 const outcome=!complete?null:hiddenVictim?(raw.pointShot||raw.aimHit?null:'miss'):raw.pointShot&&raw.outcome==='miss'?null:raw.outcome;
 return {source:snapshot(raw.source),impact:last,visible:true,outcome,spread:Boolean(raw.spread),shotHand:raw.shotHand==='offhand'?'offhand':'primary',...(raw.discharge===false?{discharge:false}:{}),...(outcome==='cover'&&raw.material?{material:raw.material}:{})};
}
function observedArtillery(state,raw,known,canObserve){
 if(!raw||![raw.source,raw.destination].every(point=>point&&[point.x,point.y,point.height].every(Number.isFinite)))return null;
 const clean=point=>({x:point.x,y:point.y,height:point.height,tacticalLevel:point.tacticalLevel??0});
 const observed=point=>canObserve(state,{...point,x:Math.round(point.x),y:Math.round(point.y)});
 if(!observed(raw.source))return null;
 const source=clean(raw.source),canister=Boolean(raw.canister),points=[source],end=raw.displayEnd??raw.destination;
 if(![end.x,end.y,end.height].every(Number.isFinite))return null;
 // Artillery currently resolves grid cells, not a metric trajectory. This is
 // an observed-only grid trace from the issued aim. A private body/force stop
 // never supplies its endpoint, height, material or presentation duration.
 const distance=Math.hypot(end.x-source.x,end.y-source.y),steps=Math.min(255,Math.max(1,Math.ceil(distance*4)));
 if(!canister)for(let n=1;n<=steps;n++){
  const fraction=n/steps,point={x:source.x+(end.x-source.x)*fraction,y:source.y+(end.y-source.y)*fraction,height:source.height+(end.height-source.height)*fraction,tacticalLevel:source.tacticalLevel};
  if(!observed(point))break;points.push(point);
 }
 const impacts=(raw.impacts??[]).filter(point=>point&&[point.x,point.y,point.height].every(Number.isFinite)&&observed(point)&&(!point.victimId||known.has(bodyKey(point.victimKind??'unit',point.victimId)))).map(point=>({...clean(point),outcome:point.outcome,...(point.material?{material:point.material}:{})}));
 return {visible:true,source,canister,discharge:raw.discharge!==false,displayHeight:'ground-relative',durationMs:Math.min(650,Math.max(320,Math.round(distance*35))),impacts,...(typeof raw.cannonId==='string'?{cannonId:raw.cannonId}:{}),...(!canister&&points.length>1?{points}: {})};
}
export function captureBattlePresentation(before,execute,canObserve,canObserveExterior=canObserve){
 const frames=[],parent=recorder,presentedShots=new Set(),presentedArtillery=new Set(),shotIds=new Map(),actionStarts=new Map(),actionCrews=new Map();let prior=before,lastSignature=null,shotSequence=0;
 const visibleIn=s=>new Set(s.units.filter(u=>u.side==='player'||canObserve(s,u)).map(u=>u.id));
 const knownIn=s=>new Set(bodyEntries(s).filter(({body:u})=>u.side==='player'||canObserve(s,u)).map(({body,kind})=>bodyKey(kind,body.id)));
 lastSignature=visibleSignature(before,knownIn(before));
 recorder=(state,event)=>{
  const visible=visibleIn(state),known=knownIn(state),signature=visibleSignature(state,known),seen=visible.has(event.unitId);
  if(event.type==='prepare'){actionStarts.set(event.unitId,frames.length);actionCrews.delete(event.unitId);}
  if(event.type==='crew'){
   if(!['artillery','artilleryReload','artilleryMove','artilleryPivot'].includes(event.action))return;
   const leader=state.units.find(unit=>unit.id===event.unitId),crewIds=[...new Set((Array.isArray(event.crewIds)?event.crewIds:[]).filter(id=>typeof id==='string'&&state.units.some(unit=>unit.id===id&&unit.side===leader?.side)))];
   actionCrews.set(event.unitId,{action:event.action,crewIds});
   for(let n=actionStarts.get(event.unitId)??frames.length;n<frames.length;n++)if(frames[n].action===event.action){const observed=knownIn(frames[n].state),admitted=crewIds.filter(id=>observed.has(bodyKey('unit',id)));if(admitted.length)frames[n].crewIds=admitted;}
   return;
  }
  const nearMissIds=Array.isArray(event.nearMissIds)?[...new Set(event.nearMissIds)].filter(id=>typeof id==='string'&&state.units.some(unit=>unit.id===id&&unit.side==='player'&&unit.hp>0&&!unit.unconscious)):[];
  if(!seen&&signature===lastSignature&&!nearMissIds.length)return;
  if((event.type==='prepare'||event.type==='contact')&&!seen)return;
  const shotVisual=seen?observedShot(state,event.shotVisual,known,canObserve,canObserveExterior):null;
  if(shotVisual){if(event.type==='projectile'&&shotVisual.discharge!==false||!shotIds.has(event.unitId))shotIds.set(event.unitId,`${event.unitId}:${++shotSequence}`);shotVisual.shotId=shotIds.get(event.unitId);}
  const artilleryVisual=seen?observedArtillery(state,event.artilleryVisual,known,canObserve):null;
  if(event.type==='projectile'&&shotVisual)presentedShots.add(event.unitId);
  if(event.type==='projectile'&&artilleryVisual)presentedArtillery.add(event.unitId);
  const impacts=bodyEntries(state).filter(({body,kind})=>known.has(bodyKey(kind,body.id))).flatMap(({body:u,kind})=>{const before=bodyEntries(prior).find(old=>old.kind===kind&&old.body.id===u.id)?.body,loss=before?before.hp-u.hp:0;return loss>0?[{unitId:u.id,...(kind==='npc'?{victimKind:'npc'}:{}),x:u.x,y:u.y,tacticalLevel:u.tacticalLevel,damage:loss,fatal:u.hp===0}]:[];});
  const target=event.targetId?bodyEntries(state).find(({body,kind})=>kind===(event.targetKind==='npc'?'npc':'unit')&&String(body.id)===String(event.targetId)&&known.has(bodyKey(kind,body.id)))?.body:null;
  const current=snapshot(state,prior);prior=current;lastSignature=signature;
  const shotComplete=event.type==='result'&&presentedShots.delete(event.unitId);
  if(shotComplete)shotIds.delete(event.unitId);
  const artilleryComplete=event.type==='result'&&presentedArtillery.delete(event.unitId);
  const crew=actionCrews.get(event.unitId),crewIds=crew&&crew.action===event.action?crew.crewIds.filter(id=>known.has(bodyKey('unit',id))):[];
  frames.push({state:current,visibleIds:[...visible],unitId:seen?event.unitId:null,type:event.type,action:event.action,impacts,...(nearMissIds.length?{nearMissIds}:{}),...(crewIds.length?{crewIds:[...crewIds]}:{}),...(seen&&['bayonet','normal'].includes(event.meleeStyle)?{meleeStyle:event.meleeStyle}:{}),...(shotVisual?{shotVisual,shotHand:shotVisual.shotHand,shotId:shotVisual.shotId}:{}),...(artilleryVisual?{artilleryVisual}:{}),...(shotComplete?{shotComplete:true}:{}),...(artilleryComplete?{artilleryComplete:true}:{}),...(event.contactComplete&&seen?{contactComplete:true}:{}),...(event.performed===false?{performed:false}:{}),...(seen&&event.action==='heal'&&(event.targetId===undefined||event.targetKind!=='npc'&&String(event.targetId)===String(event.unitId))?{careSelf:true}:{}),...(target?{targetPoint:{id:target.id,x:target.x,y:target.y,tacticalLevel:target.tacticalLevel,...(['melee','charge','heal'].includes(event.action)?{kind:event.targetKind==='npc'?'npc':'unit'}:{})}}:{}),...(event.grenadeVisual&&seen?{grenadeVisual:snapshot(event.grenadeVisual)}:{}),...(event.knifeVisual&&seen?{knifeVisual:snapshot(event.knifeVisual)}:{})});
  if(event.type==='result'){actionCrews.delete(event.unitId);actionStarts.delete(event.unitId);}
 };
 try{const state=execute();if(frames.some(frame=>frame.nearMissIds))markFirearmNearMissPresented(state);return {state,frames};}finally{recorder=parent;}
}
