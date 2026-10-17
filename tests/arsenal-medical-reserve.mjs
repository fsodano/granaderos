import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {actBattle,exitPreview} from '../game/tactical.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {queueSquadTravel,travelLegHours} from '../game/squad-travel.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const full=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.unconscious&&!r.routed;};

// Quotation is a plan, not a hire or a claim that later medical staffing is
// complete. The two serving physicians and any additional paid rear keeper
// remain actual members of the same admitted twelve-person force.
export function arsenalRearServicePlan(c,field,originalMembers,{paidCount=6,fieldPhysicians=0}={}){
 assert.ok(Number.isSafeInteger(paidCount)&&paidCount>=1&&paidCount<=6);
 assert.ok(Number.isSafeInteger(fieldPhysicians)&&fieldPhysicians>=0&&fieldPhysicians<=1,'The field physician option must be zero or one.');
 const roster=rosterFor(c),ids=new Set(field),outside=roster.filter(op=>op.id>=100&&op.id<1000&&!ids.has(op.id)&&full(c,op.id)&&c.operativeState[op.id].morale>=50&&
  (c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'||!c.recruited.includes(op.id)&&contractQuote(c,op,'day').available)).map(op=>op.id);
 const physicians=roster.filter(op=>ids.has(op.id)&&op.medical>=60&&full(c,op.id)&&c.recruited.includes(op.id))
  .sort((a,b)=>b.medical-a.medical||a.id-b.id).map(op=>op.id);
 assert.equal(physicians.length,2,'The actual arsenal reserve must preserve both qualified serving physicians.');
 const needed=Math.max(0,paidCount-outside.length),paidPhysicians=physicians.filter(id=>id>=100&&id<1000);
 const paid=roster.filter(op=>ids.has(op.id)&&op.id>=100&&op.id<1000&&!originalMembers.includes(op.id)&&!physicians.includes(op.id)&&full(c,op.id)&&c.recruited.includes(op.id))
  .sort((a,b)=>a.marksmanship-b.marksmanship||a.id-b.id).map(op=>op.id);
 const reserveIds=[...physicians,...paid.slice(0,Math.max(0,needed-paidPhysicians.length))],paidReserveIds=reserveIds.filter(id=>id>=100&&id<1000);
 assert.ok(paidReserveIds.length>=needed,'The actual admitted force must contain sufficient paid rear keepers.');
 assert.ok(field.length-reserveIds.length>=3,'Three actual field soldiers remain for the finite gun crew.');
 // Protect service independently of the actual boundary crossings. The
 // explicit stock plan keeps one admitted, active and supplied physician
 // with the assault; no person, dressing or future health is created here.
 const fieldPhysicianIds=fieldPhysicians?physicians.filter(id=>{
  const r=c.operativeState[id];return r.assignment==='active'&&r.hp>=15&&!r.asleep&&r.energy>0&&r.medkits>0&&c.pendingBattle?.squad?.some(op=>Number(op.id)===id);
 }).slice(0,fieldPhysicians):[];
 assert.equal(fieldPhysicianIds.length,fieldPhysicians,'The field needs an actual admitted active physician with finite dressings.');
 const withdrawalIds=reserveIds.filter(id=>!fieldPhysicianIds.includes(id));
 return {reserveIds,paidReserveIds,physicians,outside,paidCount,remainingField:field.filter(id=>!withdrawalIds.includes(id)),withdrawalIds,fieldPhysicianIds};
}

// Preserve issued positions through the public deployment reducer, then pay
// each real boundary crossing. A native interruption must stay a refusal;
// neither the departure nor its elapsed time is assigned by this helper.
export function withdrawArsenalRear(initial,ids,{destination='buenos_aires',onOrder=()=>{},executeOrder}={}){
 const expected=ids.map(String);assert.ok(expected.length>0&&expected.length<=6&&new Set(expected).size===expected.length);
 return start=>{
  let battle=start;const model=sectorDeploymentModel(start);assert.ok(model);
  const admitted=model.units.map(row=>row.id),exit=start.exits.find(exit=>exit.destination===destination);assert.ok(exit,'The rear needs an existing authorized exit.');
  assert.ok(expected.every(id=>admitted.includes(id)),'Every rear keeper must actually be admitted.');
  assert.ok(expected.every(id=>model.units.find(row=>row.id===id).edge===exit.edge),'The rear must leave through its own actual arrival edge.');
  const order=(action,deployment=false)=>{
   const next=executeOrder?executeOrder(battle,action):deployment?sectorDeploymentAction(battle,action):actBattle(battle,action);
   assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);battle=next;onOrder(structuredClone(action));
  };
  for(const row of model.units){const issued=initial.units.find(unit=>unit.id===row.id);assert.ok(issued);
   order({type:'placeDeployment',unitIds:[row.id],x:issued.x,y:issued.y},true);
  }
  order({type:'confirmDeployment'},true);
  for(const id of expected){
   const action={type:'exit',unitIds:[id],exitId:exit.id},preview=exitPreview(battle,action);
   assert.equal(preview.available,true,preview.reason);order(action);
   assert.equal(battle.units.find(unit=>unit.id===id).departure?.destination,destination,'Only an actual completed crossing places the keeper in the rear.');
  }
  assert.deepEqual(battle.units.filter(unit=>expected.includes(unit.id)).map(unit=>unit.id).sort(),expected.slice().sort());
  return battle;
 };
}

// Settlement leaves a departed keeper at the real destination. Return only
// through an actual safe public route before the caller forms local care
// parties. All serving people keep quoted terms throughout this real clock.
export function reuniteArsenalRear(start,ids,{destination='ensenada',maxHours=24,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(maxHours)&&maxHours>=1&&maxHours<=24);
 assert.ok(ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length);
 let c=decodeSave(encodeSave(start)).campaign;const began=clock(c),original=c.activeSquadId,events=[];
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>events.push(event)}),order=retained.order;
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.ok(ids.every(id=>c.recruited.includes(id)&&full(c,id)),'Each departed rear keeper must still be a full-health actual serving person.');
 const columns=[];
 for(const from of new Set(ids.map(id=>c.operativeState[id].location))){
  if(from===destination)continue;
  const members=ids.filter(id=>c.operativeState[id].location===from);
  order({type:'createSquad',name:'Reserva médica del arsenal',ids:members,sector:from});const squadId=c.activeSquadId;
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  const mode=c.routes.posta?'posta':'march',preview=structuredClone(c),q=preview.squads.find(q=>q.id===squadId),journey=queueSquadTravel(preview,q,{sector:destination,mode});
  const hours=journey.path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(journey.path[i],to,mode,c),0);assert.ok(hours<=maxHours,'The actual reunion route must fit its bounded public quotation.');
  retained.retain(hours*3600+1);order({type:'travel',sector:destination,mode,queue:true});
  columns.push({squadId,members,journey:structuredClone(journey),hours});
 }
 for(let attempt=0;attempt<48&&columns.some(column=>c.squads.find(q=>q.id===column.squadId).journey);attempt++){
  assert.ok(clock(c)-began<maxHours*3600,'The reunion cannot exceed its actual elapsed-time bound.');order({type:'wait',hours:1});
 }
 assert.ok(columns.every(column=>!c.squads.find(q=>q.id===column.squadId).journey&&c.squads.find(q=>q.id===column.squadId).location===destination),'Every rear column must actually arrive before care.');
 assert.ok(ids.every(id=>c.operativeState[id].location===destination&&c.recruited.includes(id)&&full(c,id)));
 assert.ok(clock(c)-began<=maxHours*3600);order({type:'selectSquad',id:original});
 const official=decodeSave(encodeSave(c)).campaign;assert.deepEqual(official,c);
 for(const event of events)report(event);
 report({event:'createdCuyoArsenalRearReunited',ids:[...ids],columns,seconds:clock(c)-began,hour:c.hour,second:c.secondOfHour??0,campaign:c});
 return c;
}

// The planned paid pool is not ready merely because it stayed alive. Earn
// its actual local morale, energy and fatigue through bounded native rest.
// Current cash, service refusal and any new raid remain authoritative.
export function restArsenalRear(start,ids,{maxHours=600,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(maxHours)&&maxHours>=1&&maxHours<=600);
 let c=decodeSave(encodeSave(start)).campaign;const began=clock(c),events=[];
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>events.push(event)}),order=retained.order;
 try{
 assert.ok(ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length);
 assert.ok(ids.every(id=>c.recruited.includes(id)&&full(c,id)&&c.operativeState[id].location===c.location));
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 const ready=id=>{const r=c.operativeState[id];return full(c,id)&&r.morale>=50&&r.energy===100&&!r.fatigue&&!r.asleep;};
 for(let attempt=0;attempt<maxHours*4&&!ids.every(ready);attempt++){
  assert.ok(clock(c)-began<maxHours*3600,'Actual rear readiness must finish within the unchanged native rest bound.');order({type:'wait',hours:1});
 }
 assert.ok(ids.every(ready),'The actual rear keepers must earn full-health, morale and movement readiness.');
 assert.ok(clock(c)-began<=maxHours*3600);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 for(const event of events)report(event);
 report({event:'createdCuyoArsenalRearReady',ids:[...ids],seconds:clock(c)-began,people:ids.map(id=>({id,...c.operativeState[id]})),campaign:c});
 return c;
 }catch(error){
  // Buffered reports are not an adopted helper return. Retain the actual
  // last accepted Native state on failure without issuing another action,
  // quote, synchronization or saved-prefix substitution.
  recordRouteStrategicEvidence({helper:'restArsenalRear',stage:'preparation-failure',campaign:c,error,context:{
   ids:Array.isArray(ids)?[...ids]:null,maxHours,startClock:[start.hour,start.secondOfHour??0],startTreasury:start.resources.treasury,actualElapsedSeconds:clock(c)-began,
   attemptedEvents:events.map(({campaign,...event})=>event),
   scope:'Last actual returned Native campaign and emitted public renewal/wait actions of a failed unadopted rear-rest helper; diagnosis only, never a new earned input or successful readiness claim.',
  }});
  throw error;
 }
}
