import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {rosterFor} from '../packages/game/campaign.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {sectorInventoryModel} from '../packages/game/sector-inventory.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {enterSector} from '../packages/game/world.js';
import {actBattle} from '../packages/game/tactical.js';
import {syncBattleTime} from '../packages/game/time.js';
import {contractExpiresSeconds} from '../packages/game/contracts.js';
import {artilleryProfile} from '../packages/game/artillery-definitions.js';
import {spacePoint} from '../packages/game/tactical-space.js';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';

// Put an existing charged gun and its actual crew in a public central lane.
// The remaining riflemen keep real roof cover. No later enemy route is read.
function stageHospitalBattery(start,ids,orderCampaign,report){
 let c=start;const sector=operativeLocation(c,ids[0]),home=c.squads.find(q=>q.location===sector&&!q.journey&&ids.every(id=>q.members.includes(id)));
 const order=a=>{c=orderCampaign(c,a);assert.equal(c.lastError,null);};assert.ok(home);
 order({type:'selectSquad',id:home.id});order({type:'visitSector'});
 let b=enterSector(c.pendingBattle,c.sectorStates[sector]);const initial=structuredClone(b),gun=b.artillery.find(g=>g.side==='player'&&(g.loaded||g.ammo>0));
 const actions=[];let crew=[];
 if(gun){
  crew=ids.map(id=>b.units.find(u=>u.id===String(id))).sort((a,d)=>a.marksmanship-d.marksmanship||a.id.localeCompare(d.id)).slice(0,artilleryProfile(b,gun).crew).map(u=>u.id);
  assert.equal(crew.length,artilleryProfile(b,gun).crew);const goal={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
  for(let step=0;step<600&&Math.hypot(b.artillery.find(g=>g.id===gun.id).x-goal.x,b.artillery.find(g=>g.id===gun.id).y-goal.y)>0;step++){
   let moved=false;
   for(const id of ids){const unit=b.units.find(u=>u.id===String(id)),a=mountainBatteryOrder(b,unit,{leaderId:crew[0],helperId:crew[1]??'none',crewIds:crew,artilleryId:gun.id,screenDistance:4,clearCrewLane:true,routeAroundObstacles:true,flankScreen:true,keepCrewTogether:true,sharedArtillerySight:true});
    if(a){assert.equal(b.mode,'exploration');b=actBattle(b,a);assert.equal(b.lastError,null,JSON.stringify(a)+': '+b.lastError);actions.push(a);moved=true;}
   }
   assert.ok(moved,'The hospital battery needs an ordinary reachable preparation step.');
  }
  const positioned=b.artillery.find(g=>g.id===gun.id);assert.deepEqual({x:positioned.x,y:positioned.y},goal);assert.equal(positioned.loaded,gun.loaded);assert.equal(positioned.ammo,gun.ammo);
 }
 let replay=initial;for(const a of actions){replay=actBattle(replay,a);assert.equal(replay.lastError,null);}assert.deepEqual(replay,b);
 const paired=syncBattleTime(c,b);assert.equal(paired.error,null);c=paired.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:paired.battle,survivors:paired.battle.units.filter(u=>u.side==='player')});
 c=stageRouteRoofDefenders(c,ids.filter(id=>!crew.includes(String(id))),{report});
 for(const id of ids)assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 const receipt={sector,crewIds:crew.map(Number),gunBefore:gun??null,gunAfter:gun?c.sectorStates[sector].artillery.find(g=>g.id===gun.id):null,actions,elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-start.hour*3600-(start.secondOfHour??0)};
 report({event:'northernHospitalBatteryReady',receipt});return {campaign:c,receipt};
}

// Use only one existing supplied free physician per actual rear. Other care,
// patient and working assignments are obligations, not a reserve to suspend.
// A shared squad must be free too: the existing roof helper briefly activates
// its actual selected squad during native entry, movement and leave.
export function northernHospitalRearPhysicians(c,guards,sector){
 const now=c.hour*3600+(c.secondOfHour??0),free=id=>{const r=c.operativeState[id];return r&&r.alive&&!r.captured&&!operativeInTransit(c,id)&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&r.energy>10&&['active','rest'].includes(r.assignment??'active');};
 // Match the actual supplied role first. A lower-skilled spare is not a new
 // physician role when that role is already prepared or has current duties.
 const physician=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id],expiry=contractExpiresSeconds(c.contracts[op.id]);
  return c.recruited.includes(op.id)&&r.alive&&!r.captured&&!operativeInTransit(c,op.id)&&operativeLocation(c,op.id)===sector&&r.hp>=15&&r.energy>0&&!r.routed&&!r.unconscious&&!r.asleep&&!r.departure&&!r.fled&&!r.surrendered&&op.medical>=60&&r.medkits>0&&c.contracts[op.id]&&(expiry===null||expiry>now);
 }).sort((a,b)=>b.medical-a.medical||c.operativeState[b.id].medkits-c.operativeState[a.id].medkits||String(a.id).localeCompare(String(b.id)))[0];
 if(!physician||guards.includes(physician.id)||!free(physician.id))return [];
 const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.includes(physician.id));
 return home&&home.members.every(free)?[physician.id]:[];
}

// Protect the real rear while the patients use another controlled hospital.
// Fortification, finite linen, reloading, roof movement and rest are ordinary
// orders. The earlier patients and all actual paid guards remain in service.
export function prepareNorthernHospitalRear(start,ids,{applyOrder,report=()=>{},targetCount=6,reserveIds=[],coordinatePhysicians=false}={}){
 assert.equal(typeof applyOrder,'function');assert.equal(typeof coordinatePhysicians,'boolean');let c=decodeSave(encodeSave(start)).campaign;const before=structuredClone(start),active=c.activeSquadId,groups=new Map(),receipts=[];
 assert.ok(Number.isInteger(targetCount)&&targetCount>=ids.length&&targetCount<=6);
 for(const id of ids){const r=c.operativeState[id],at=operativeLocation(c,id);assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured&&!operativeInTransit(c,id)&&r.hp>=15&&!r.bleeding);if(!groups.has(at))groups.set(at,[]);groups.get(at).push(id);}
 const order=action=>{c=applyOrder(c,action);assert.equal(c.lastError,null);};
 for(const [sector,guards]of groups){
  assert.equal(c.sectors[sector].owner,'patriot');assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
  const cash=c.resources.treasury,fortBefore=c.sectors[sector].fort;
  for(let level=fortBefore;level<3;level++)order({type:'fortify',sector});assert.equal(cash-c.resources.treasury,(3-fortBefore)*150);
  const reserves=reserveIds.filter(id=>!guards.includes(id)).slice(0,Math.max(0,targetCount-guards.length)),transfers=[];
  for(const at of new Set(reserves.map(id=>operativeLocation(c,id)))){
   const party=reserves.filter(id=>operativeLocation(c,id)===at);assert.ok(party.every(id=>{const r=c.operativeState[id];return c.recruited.includes(id)&&r.alive&&!r.captured&&!operativeInTransit(c,id)&&r.hp===r.maxHp&&!r.bleeding;}));
   order({type:'createSquad',ids:party,sector:at,name:'Reserva del hospital'});const squadId=c.activeSquadId;
   for(const operativeId of party)order({type:'assignCare',operativeId,assignment:'rest'});
   for(let hour=0;hour<48&&party.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue>0||r.asleep;});hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
   for(const operativeId of party){const r=c.operativeState[operativeId];assert.ok(r.energy===100&&!r.fatigue&&!r.asleep);order({type:'assignCare',operativeId,assignment:'active'});}
   if(at!==sector){const posted=previewStrategicRoute(c,squadId,sector,'posta'),quote=posted.valid?posted:previewStrategicRoute(c,squadId,sector,'march');assert.equal(quote.valid,true,quote.reason);order(quote.action);
    for(let hour=0;hour<48&&c.squads.find(q=>q.id===squadId).journey;hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
    assert.equal(c.squads.find(q=>q.id===squadId).location,sector);transfers.push({ids:party,squadId,origin:at,destination:sector,quote});
   }
   for(const id of party){const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.length<6&&q.members.some(id=>guards.includes(id)));assert.ok(home);order({type:'assignToSquad',operativeId:id,squadId:home.id});guards.push(id);}
  }
  assert.equal(guards.length,targetCount,'Use the actual serving reserve before the hospital departure.');
  const doctor=rosterFor(c).filter(op=>guards.includes(op.id)&&op.medical>0).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0],donations=[];
  if(doctor)while(c.operativeState[doctor.id].medkits<2){
   const donor=c.recruited.filter(id=>id!==doctor.id&&c.operativeState[id].alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector&&c.operativeState[id].medkits>0&&!sectorInventoryModel(c,sector,rosterFor(c),id).reason).sort((a,b)=>c.operativeState[b].medkits-c.operativeState[a].medkits||a-b)[0];
   assert.ok(donor!==undefined,'The actual rear physician needs finite local linen before the patients leave.');
   const stock=c.operativeState[doctor.id].medkits+c.operativeState[donor].medkits,known=new Set(sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.map(row=>row.key)),count=Math.min(2-c.operativeState[doctor.id].medkits,c.operativeState[donor].medkits);
   order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count});
   const row=sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'The rear physician must have a public path to the actual donation.');
   order({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.operativeState[doctor.id].medkits+c.operativeState[donor].medkits,stock);donations.push({donor,recipient:doctor.id,count,sourceKey:row.key});
  }
  for(const id of guards){if(c.operativeState[id].asleep)order({type:'setSleep',operativeId:id,asleep:false});order({type:'assignCare',operativeId:id,assignment:'active'});}
  // Ammunition orders use the active sector. Care can leave another town
  // selected, even when this rear already has all of its actual guards.
  if(c.location!==sector){
   const home=c.squads.find(q=>q.location===sector&&!q.journey&&q.members.some(id=>guards.includes(id)));
   assert.ok(home,'The rear supplies need an actual local guard squad.');
   order({type:'selectSquad',id:home.id});
  }
  assert.equal(c.location,sector,'Supply the guards from their actual controlled sector.');
  const supplied=supplyRouteAmmunition(c,guards,{target:16,report});c=supplied.campaign;
  c=stageRouteRoofDefenders(c,guards,{report});
  const staged=stageHospitalBattery(c,guards,applyOrder,report);c=staged.campaign;
  // Existing reserve transfers and finite guard donations run first. Select
  // only the still-supplied free physician outside the final guard cohort.
  const physicians=coordinatePhysicians?northernHospitalRearPhysicians(c,guards,sector):[];
  const physicianBefore=physicians.map(id=>({id,body:structuredClone(c.operativeState[id]),contract:structuredClone(c.contracts[id])}));
  // Keep the six actual guards and paid crew unchanged. The already serving
  // supplied physician takes a vacant native roof post beside those guards,
  // then rests during the real distant clinic clock instead of staying active.
  const physicianStaging=[];
  if(physicians.length){
   const reservedPositions=guards.filter(id=>c.operativeState[id].residentPosition?.tacticalLevel>0).map(id=>({id,...spacePoint(c.operativeState[id].residentPosition)}));
   c=stageRouteRoofDefenders(c,physicians,{reservedPositions,report:event=>{report(event);if(event.event==='routeRoofDefenders')physicianStaging.push(event);}});
  }

  for(const id of [...guards,...physicians])order({type:'assignCare',operativeId:id,assignment:'rest'});
  for(const previous of physicianBefore){const r=c.operativeState[previous.id];assert.equal(r.hp,previous.body.hp);assert.equal(r.medkits,previous.body.medkits);assert.equal(operativeLocation(c,previous.id),sector);assert.equal(r.assignment,'rest');assert.ok(r.residentPosition?.tacticalLevel>0);assert.ok(c.recruited.includes(previous.id));}
  if(physicians.length)report({event:'northernHospitalPhysicianRearReady',sector,ids:physicians,before:physicianBefore,staging:physicianStaging,campaign:structuredClone(c)});
  receipts.push({sector,guards:[...guards],...(coordinatePhysicians?{physicians,physicianBefore,physicianStaging}:{}),transfers,ammunition:supplied.transactions,battery:staged.receipt,doctorId:doctor?.id??null,fortBefore,fortAfter:c.sectors[sector].fort,fortCost:(3-fortBefore)*150,donations,positions:guards.map(id=>({id,...c.operativeState[id].residentPosition}))});
 }
 if(c.activeSquadId!==active)order({type:'selectSquad',id:active});
 for(const[id,r]of Object.entries(start.operativeState)){assert.equal(c.operativeState[id].alive,r.alive);assert.equal(c.operativeState[id].captured,r.captured);if(!r.alive)assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'northernHospitalRearReady',receipts,campaign:structuredClone(c)});return {campaign:c,receipts,ids:[...groups.values()].flat()};
}
