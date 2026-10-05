// Transient presentation is separate from campaign/save state. Recording never
// changes orders, randomness, AP, visibility or the returned authoritative state.
import {projectileTrajectoryPoint} from './projectile-trajectory.js';
import {markFirearmNearMissPresented} from './firearm-near-miss-feedback.js';
let recorder=null;
export function recordBattleFrame(state,event){recorder?.(state,event);}
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
function observedShot(state,raw,known,canObserve){
 if(!raw)return null;
 // An unseen interception cannot disclose a concealed body or its coordinates.
 // In that case only the observed part of the original ray is shown.
 const hiddenVictim=raw.victimId&&(!raw.victimObserved||!known.has(bodyKey(raw.victimKind??'unit',raw.victimId))),end=hiddenVictim?raw.destination:raw.impact;
 if(![raw.source,end].every(point=>point&&[point.x,point.y,point.height].every(Number.isFinite)))return null;
 if(raw.discharge===false&&!canObserve(state,{...raw.source,x:Math.round(raw.source.x),y:Math.round(raw.source.y)}))return null;
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
  if(!canObserve(state,{...point,x:Math.round(point.x),y:Math.round(point.y)})){complete=false;break;}
  last=point;
 }
 if(last===raw.source)return null;
 const outcome=!complete?null:hiddenVictim?(raw.pointShot||raw.aimHit?null:'miss'):raw.pointShot&&raw.outcome==='miss'?null:raw.outcome;
 return {source:snapshot(raw.source),impact:last,visible:true,outcome,spread:Boolean(raw.spread),...(raw.discharge===false?{discharge:false}:{}),...(outcome==='cover'&&raw.material?{material:raw.material}:{})};
}
export function captureBattlePresentation(before,execute,canObserve){
 const frames=[],parent=recorder,presentedShots=new Set();let prior=before,lastSignature=null;
 const visibleIn=s=>new Set(s.units.filter(u=>u.side==='player'||canObserve(s,u)).map(u=>u.id));
 const knownIn=s=>new Set(bodyEntries(s).filter(({body:u})=>u.side==='player'||canObserve(s,u)).map(({body,kind})=>bodyKey(kind,body.id)));
 lastSignature=visibleSignature(before,knownIn(before));
 recorder=(state,event)=>{
  const visible=visibleIn(state),known=knownIn(state),signature=visibleSignature(state,known),seen=visible.has(event.unitId);
  const nearMissIds=Array.isArray(event.nearMissIds)?[...new Set(event.nearMissIds)].filter(id=>typeof id==='string'&&state.units.some(unit=>unit.id===id&&unit.side==='player'&&unit.hp>0&&!unit.unconscious)):[];
  if(!seen&&signature===lastSignature&&!nearMissIds.length)return;
  if((event.type==='prepare'||event.type==='contact')&&!seen)return;
  const shotVisual=seen?observedShot(state,event.shotVisual,known,canObserve):null;
  if(event.type==='projectile'&&shotVisual)presentedShots.add(event.unitId);
  const impacts=bodyEntries(state).filter(({body,kind})=>known.has(bodyKey(kind,body.id))).flatMap(({body:u,kind})=>{const before=bodyEntries(prior).find(old=>old.kind===kind&&old.body.id===u.id)?.body,loss=before?before.hp-u.hp:0;return loss>0?[{unitId:u.id,...(kind==='npc'?{victimKind:'npc'}:{}),x:u.x,y:u.y,tacticalLevel:u.tacticalLevel,damage:loss,fatal:u.hp===0}]:[];});
  const target=event.targetId?bodyEntries(state).find(({body,kind})=>kind===(event.targetKind==='npc'?'npc':'unit')&&String(body.id)===String(event.targetId)&&known.has(bodyKey(kind,body.id)))?.body:null;
  const current=snapshot(state,prior);prior=current;lastSignature=signature;
  const shotComplete=event.type==='result'&&presentedShots.delete(event.unitId);
  frames.push({state:current,visibleIds:[...visible],unitId:seen?event.unitId:null,type:event.type,action:event.action,impacts,...(nearMissIds.length?{nearMissIds}:{}),...(shotVisual?{shotVisual}:{}),...(shotComplete?{shotComplete:true}:{}),...(event.contactComplete&&seen?{contactComplete:true}:{}),...(event.performed===false?{performed:false}:{}),...(target?{targetPoint:{id:target.id,x:target.x,y:target.y,tacticalLevel:target.tacticalLevel}}:{}),...(event.grenadeVisual&&seen?{grenadeVisual:snapshot(event.grenadeVisual)}:{}),...(event.knifeVisual&&seen?{knifeVisual:snapshot(event.knifeVisual)}:{})});
 };
 try{const state=execute();if(frames.some(frame=>frame.nearMissIds))markFirearmNearMissPresented(state);return {state,frames};}finally{recorder=parent;}
}
