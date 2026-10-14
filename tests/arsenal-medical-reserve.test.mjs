import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sectorDeploymentAction} from '../game/sector-deployment.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {travelLegHours} from '../game/squad-travel.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
import {arsenalRearServicePlan,withdrawArsenalRear,reuniteArsenalRear,restArsenalRear} from './arsenal-medical-reserve.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const physical=person=>Object.fromEntries(Object.entries(person).filter(([key])=>!['x','y','ap','energy','fatigue','stance','movementMode','facing','weaponReady','momentum','overwatch','braced','departure','lastTargetId','lastShotPosition','lastKnownEnemy','lastHeardNoise','residentSector','entryReason','entryEdge','entryAnchor','arrivalTransition','strategicArrival'].includes(key)));

// Declared established-territory subsystem arena. Hiring, attack handoff,
// crossing, reported departure and reunion are actual public/native orders.
// This proves no arsenal victory, mountain readiness or fresh ending.
function attackArena(){
 let c=secureArea(initialCampaign(8),'buenos_aires');
 for(const id of [100,116,101,130,102])c=order(c,{type:'recruitCivic',id,term:'day',destination:'buenos_aires'});
 c=order(c,{type:'createSquad',name:'Reserva declarada',ids:[100,116,101,130,102],sector:'buenos_aires'});
 c=order(c,{type:'configureArtillery',types:[]});c=order(c,{type:'attack',sector:'ensenada',mode:'march'});
 assert.ok(c.pendingBattle);assert.equal(c.pendingBattle.sector,'ensenada');return c;
}

test('three actual arriving paid keepers cross the authorized west edge with finite gear and full official deployment replay',()=>{
 const campaign=attackArena(),beforeCampaign=structuredClone(campaign),request=campaign.pendingBattle,initial=enterSector(request),start=enterSector(request,null,{placement:true}),before=structuredClone(start),orders=[];
 const ids=[116,130,101],after=withdrawArsenalRear(initial,ids,{onOrder:action=>orders.push(action)})(start);
 assert.equal(after.status,'active');assert.equal(after.deploymentComplete,true);
 assert.deepEqual(orders.filter(a=>a.type==='exit').map(a=>a.unitIds[0]),ids.map(String));
 assert.equal(after.elapsedSeconds,9,'Three ordinary walking crossings each pay three native exploration seconds.');
 for(const id of ids){const unit=after.units.find(u=>u.id===String(id)),old=initial.units.find(u=>u.id===String(id));
  assert.equal(unit.departure.destination,'buenos_aires');assert.equal(unit.departure.edge,'W');assert.equal(unit.x,0);assert.ok(unit.energy<old.energy);assert.deepEqual(physical(unit),physical(old));
 }
 assert.equal(after.units.find(u=>u.id==='100').departure,undefined);assert.deepEqual(after.artillery,initial.artillery);
 let replay={campaign,battle:enterSector(request,null,{placement:true})};
 for(const [index,action]of orders.entries()){
  const battle=action.type==='exit'?actBattle(replay.battle,action):sectorDeploymentAction(replay.battle,action);assert.equal(battle.lastError,null);
  replay=syncBattleTime(replay.campaign,battle);assert.equal(replay.error,null);
  if(index===Math.floor(orders.length/2))replay=decodeSave(encodeSave(replay.campaign,replay.battle));
 }
 const actual=syncBattleTime(campaign,after);assert.equal(actual.error,null);assert.deepEqual({campaign:replay.campaign,battle:replay.battle},{campaign:actual.campaign,battle:actual.battle});
 assert.deepEqual(decodeSave(encodeSave(actual.campaign,actual.battle)),{campaign:actual.campaign,battle:actual.battle});
 assert.deepEqual(start,before);assert.deepEqual(campaign,beforeCampaign);
});

test('rear deployment cannot invent a missing actor or an unauthorized destination',()=>{
 const c=attackArena(),initial=enterSector(c.pendingBattle),start=enterSector(c.pendingBattle,null,{placement:true}),before=structuredClone(start);
 assert.throws(()=>withdrawArsenalRear(initial,[99999])(start),/actually be admitted/);
 assert.throws(()=>withdrawArsenalRear(initial,[116],{destination:'mendoza'})(start),/existing authorized/);
 assert.deepEqual(start,before);
});

function departedArena(){
 let c=secureArea(initialCampaign(8),'buenos_aires','ensenada');
 for(const id of [116,101,130])c=order(c,{type:'recruitCivic',id,term:'day',destination:'buenos_aires'});
 c=order(c,{type:'createSquad',name:'Médicos declarados',ids:[116,101,130],sector:'buenos_aires'});
 c=order(c,{type:'travel',sector:'ensenada',mode:'march'});c=order(c,{type:'visitSector'});
 let b=enterSector(c.pendingBattle,c.sectorStates.ensenada);const exit=b.exits.find(e=>e.destination==='buenos_aires');assert.ok(exit);
 for(const id of [116,101,130]){b=actBattle(b,{type:'exit',unitIds:[String(id)],exitId:exit.id});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id===String(id)).departure?.destination,'buenos_aires');}
 const pair=syncBattleTime(c,b);assert.equal(pair.error,null);
 c=order(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.ok([116,101,130].every(id=>c.operativeState[id].location==='buenos_aires'));
 // Advance ordinary local time until the upcoming real return needs a paid
 // renewal. No contract timestamp or actual person is assigned by the arena.
 for(let attempt=0;attempt<12&&c.hour<16;attempt++)c=order(c,{type:'wait',hours:1});
 assert.equal(c.hour,16);return saved(c);
}

test('real departed keepers reunite through quoted native travel and exact paid service without replacing their physical kit',()=>{
 const start=departedArena(),before=structuredClone(start),events=[],ids=[116,101,130],quotes=new Map(ids.map(id=>[id,contractRenewalQuote(start,rosterFor(start).find(o=>o.id===id),'day')]));
 const c=reuniteArsenalRear(start,ids,{report:event=>events.push(event)}),receipt=events.find(e=>e.event==='createdCuyoArsenalRearReunited');assert.ok(receipt);
 assert.equal(receipt.columns.length,1);const journey=receipt.columns[0].journey;
 assert.deepEqual(journey.path,['buenos_aires','cell-26-28','retiro','cell-27-29','cell-27-30','ensenada']);
 const hours=journey.path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(journey.path[i],to,journey.mode,start),0);
 assert.equal(receipt.columns[0].hours,hours);assert.equal(receipt.seconds,hours*3600);
 assert.equal(clock(c)-clock(start),hours*3600);assert.ok(ids.every(id=>c.operativeState[id].location==='ensenada'&&c.recruited.includes(id)));
 for(const id of ids){for(const key of ['hp','maxHp','bleeding','medkits','inventory','loaded','ammo','ammoStock','weaponMetadata','weaponInstanceId'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key],`${id}: ${key}`);}
 const renewals=events.filter(e=>e.event==='freshRouteRenewal');assert.ok(renewals.length);
 for(const event of renewals){assert.equal(event.price,quotes.get(event.id).price);assert.equal(contractExpiresSeconds(c.contracts[event.id]),contractExpiresSeconds(start.contracts[event.id])+86400);}
 assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,e)=>sum+e.price,0));
 let replay=saved(start);for(const event of events.filter(e=>e.event==='freshRouteOrder'||e.event==='freshRouteRenewal'))replay=order(replay,event.action);
 assert.deepEqual(replay,c);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);assert.deepEqual(reuniteArsenalRear(start,ids),c);
});

test('the read-only paid rear plan preserves both actual doctors without counting remote service as a ready local replacement',()=>{
 const c=attackArena(),before=structuredClone(c),field=[100,116,101,130,102],original=[];
 const plan=arsenalRearServicePlan(c,field,original,{paidCount:2});assert.deepEqual(plan.physicians,[116,130]);assert.deepEqual(plan.reserveIds,[116,130]);
 assert.deepEqual(c,before);
 assert.throws(()=>arsenalRearServicePlan(c,[100,101],original),/both qualified/);
});

test('paid ordinary rear rest earns real movement readiness without healing or replacing finite equipment',()=>{
 const start=departedArena(),before=structuredClone(start),ids=[116,101,130],events=[];
 const c=restArsenalRear(start,ids,{maxHours:24,report:event=>events.push(event)}),receipt=events.find(e=>e.event==='createdCuyoArsenalRearReady');assert.ok(receipt);
 assert.equal(receipt.seconds,clock(c)-clock(start));assert.ok(receipt.seconds>=0&&receipt.seconds<=24*3600);
 for(const id of ids){const r=c.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=50);assert.equal(r.assignment,'rest');
  for(const key of ['hp','maxHp','bleeding','medkits','inventory','loaded','ammo','ammoStock','weaponMetadata','weaponInstanceId','location'])assert.deepEqual(r[key],start.operativeState[id][key],`${id}: ${key}`);
 }
 let replay=saved(start);for(const event of events.filter(e=>e.event==='freshRouteOrder'||e.event==='freshRouteRenewal'))replay=order(replay,event.action);
 assert.deepEqual(replay,c);assert.deepEqual(restArsenalRear(start,ids,{maxHours:24}),c);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
});

test('the ready paid rear keeps current native terms, local membership and its exact finite carried kit',()=>{
 // Secure territory does not itself create a public inventory scene. This
 // ordinary visit recognizes the actual return town before quoting its kit.
 const start=leave(visit(departedArena())),before=structuredClone(start),ids=[116,101,130],events=[];
 const c=restArsenalRear(start,ids,{maxHours:24,report:event=>events.push(event)});
 for(const id of ids){
  assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,'buenos_aires');
  assert.equal(c.contracts[id].kind,'paid');assert.equal(c.contracts[id].term,'day');assert.ok(c.contracts[id].paid>0);
  assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.equal(c.operativeState[id].serviceEquipmentReturn,undefined);
  assert.ok(c.squads.some(q=>q.location==='buenos_aires'&&!q.journey&&q.members.includes(id)));
  const old=sectorInventoryModel(start,'buenos_aires',rosterFor(start),id),current=sectorInventoryModel(c,'buenos_aires',rosterFor(c),id);
  assert.equal(old.reason,null);assert.equal(current.reason,null);assert.deepEqual(current.carried,old.carried);
  for(const key of ['hp','maxHp','bleeding','loaded','ammo','ammoStock','medkits','inventory','condition','weaponMetadata','weaponInstanceId'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
 }
 let replay=saved(start);for(const event of events.filter(e=>e.event==='freshRouteOrder'||e.event==='freshRouteRenewal'))replay=order(replay,event.action);
 assert.deepEqual(replay,c);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
});

test('ordinary temporary service still ends through native dismissal with exact finite local property return',()=>{
 const start=restArsenalRear(leave(visit(departedArena())),[116,101,130],{maxHours:24}),before=structuredClone(start),collector=116;
 let c=start;
 for(const id of [101,130]){
  const old=structuredClone(c),model=sectorInventoryModel(c,'buenos_aires',rosterFor(c),id);
  assert.equal(model.reason,null);
  const kit=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count).stack),keys=new Set(sectorInventoryModel(c,'buenos_aires',rosterFor(c),collector).entries.map(row=>row.key));
  c=order(c,{type:'dismiss',id});assert.ok(!c.recruited.includes(id));assert.equal(c.contracts[id],undefined);
  assert.equal(clock(c),clock(old));assert.equal(c.resources.treasury,old.resources.treasury);
  for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','location'])assert.deepEqual(c.operativeState[id][key],old.operativeState[id][key]);
  const returned=sectorInventoryModel(c,'buenos_aires',rosterFor(c),collector).entries.filter(row=>!keys.has(row.key)).map(row=>JSON.parse(row.expected));
  const key=stack=>`${stack.item}:${stack.weapon??stack.outfit??stack.ammoType??''}`,sort=stacks=>[...stacks].sort((a,b)=>key(a).localeCompare(key(b)));
  assert.deepEqual(sort(returned),sort(kit),'Every original carried stack gains one real local return source.');
  assert.deepEqual(saved(c),c);
 }
 assert.ok(c.recruited.includes(collector));assert.deepEqual(c.contracts[collector],start.contracts[collector]);
 for(const key of ['hp','maxHp','bleeding','medkits','inventory','loaded','ammo','ammoStock','condition'])assert.deepEqual(c.operativeState[collector][key],start.operativeState[collector][key]);
 assert.deepEqual(start,before);
});
