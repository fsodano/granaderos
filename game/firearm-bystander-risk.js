import {canSee,teamCanSee,hasFirearm,weaponFor} from './tactical.js';
import {projectileFlight,firearmRay} from './projectile-cover.js';
import {absoluteBodyHeight} from './sight-geometry.js';
import {pairedPistol,secondaryPistolView} from './paired-fire.js';
import {isInteriorVisible} from './tactical-visibility.js';
import {isShotLoad,shotLoadFlight,shotLoadScatter} from './shot-load.js';

// Reject rays outside every known bystander's cell before tracing terrain,
// furniture, floors and bodies. Include corner touches and all heights here;
// the normal projectile rules still decide whether a possible ray can hit.
function crossesBodyCell(from,to,body){
 let entry=0,exit=1;
 for(const axis of ['x','y']){
  const delta=to[axis]-from[axis],low=body[axis]-.5,high=body[axis]+.5;
  if(!delta){if(from[axis]<low||from[axis]>high)return false;continue;}
  const a=(low-from[axis])/delta,b=(high-from[axis])/delta;
  entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  if(entry>exit+1e-10)return false;
 }
 return true;
}

// Inspect legal hit/miss trajectories without drawing RNG or changing a shot.
// Unknown bodies are absent from this preview, including as intervening cover.
export function firearmBystanderRisk(state,attacker,target,hitLocation='torso'){
 if(!attacker||!target||!hasFirearm(attacker))return {direct:[],scatter:[]};
 const rooms=new Set(state.revealedRooms??[]),present=body=>(body.hp??100)>0&&!body.departure&&!body.fled;
 const visible=body=>attacker.side==='player'?teamCanSee(state,attacker.side,body)&&isInteriorVisible(state,body,rooms):canSee(state,attacker,body);
 const units=state.units.filter(body=>present(body)&&(body.side===attacker.side||visible(body)));
 const npcs=(state.npcs??[]).filter(body=>present(body)&&visible(body));
 const candidates=new Map([...units.filter(body=>body.side===attacker.side&&body.id!==attacker.id).map(body=>[`unit:${body.id}`,{id:body.id,name:body.name,kind:'unit'}]),...npcs.map(body=>[`npc:${body.id}`,{id:body.id,name:body.name,kind:'npc'}])]);
 if(!candidates.size)return {direct:[],scatter:[]};
 const candidateBodies=[...units.filter(body=>body.side===attacker.side&&body.id!==attacker.id),...npcs];
 const targetKind=target.targetKind==='npc'||(state.npcs??[]).includes(target)?'npc':'unit';
 const scene={...state,units,npcs,props:(state.props??[]).filter(visible)},missScene={...scene,units:units.filter(body=>targetKind!=='unit'||body.id!==target.id),npcs:npcs.filter(body=>targetKind!=='npc'||body.id!==target.id)},direct=new Map(),scatter=new Map();
 const radius=Math.min(4,Math.max(1,Math.ceil(Math.hypot(target.x-attacker.x,target.y-attacker.y)/8)));
 const destinationHeight=absoluteBodyHeight(state,target,hitLocation),views=pairedPistol(attacker)?[attacker,secondaryPistolView(attacker)]:[attacker];
 const record=(flight,collection)=>{
  const impacts=flight.bodyImpacts??(!flight.blocked&&flight.victimId?[flight]:[]);
  for(const impact of impacts){const key=`${impact.victimKind??'unit'}:${impact.victimId}`,body=candidates.get(key);if(body)collection.set(key,body);}
 };
 for(const view of views){
  const weapon=weaponFor(view);
  const couldHit=destination=>{const ray=firearmRay(state,view,destination,weapon,hitLocation,{destinationHeight});return ray&&candidateBodies.some(body=>crossesBodyCell(view,ray.destination,body));};
  if(isShotLoad(weapon)){
   record(shotLoadFlight(scene,view,target,weapon,hitLocation,{destinationHeight,targetKind}),direct);
   for(const {point} of shotLoadScatter(view,target))record(shotLoadFlight(scene,view,point,weapon,hitLocation,{destinationHeight,targetKind}),scatter);
   continue;
  }
  if(couldHit(target))record(projectileFlight(scene,view,target,weapon,hitLocation,{targetKind}),direct);
  // A failed roll removes the selected soldier and offsets the destination by
  // one legal scatter cell. The zero/zero draw becomes +1/0 in the shot rule.
  for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
   if(!dx&&!dy)continue;
   const destination={x:target.x+dx,y:target.y+dy,stance:target.unconscious||target.knockedDown?'prone':target.stance??'standing',mounted:!target.unconscious&&!target.knockedDown&&Boolean(target.mounted)};
   if(!couldHit(destination))continue;
   record(projectileFlight(missScene,view,{...destination,tacticalLevel:target.tacticalLevel},weapon,hitLocation,{destinationHeight,targetKind}),scatter);
  }
 }
 const order=(a,b)=>String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id));
 return {direct:[...direct.values()].sort(order),scatter:[...scatter.values()].sort(order)};
}

export function firearmBystanderWarning(risk){
 const direct=new Set(risk.direct.map(body=>`${body.kind}:${body.id}`)),scattered=risk.scatter.filter(body=>!direct.has(`${body.kind}:${body.id}`));
 return [risk.direct.length?`Personas en la trayectoria: ${risk.direct.map(body=>body.name).join(', ')}.`:null,scattered.length?`Un tiro desviado puede herir a ${scattered.map(body=>body.name).join(', ')}. Cambiá de posición o elegí otro blanco para reducir el riesgo.`:null].filter(Boolean).join(' ');
}
