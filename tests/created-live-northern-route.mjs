import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {ensureRouteTownIncome} from './route-town-income.mjs';
import {createdHighPassBattery} from './created-high-pass-battery.mjs';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {recoverNorthernLocalKit} from './created-northern-care.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {contractQuote} from '../game/contracts.js';
import {squadTravelStatus} from '../game/squad-travel.js';
import {doctorRate} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {actBattle,getReachable,BLADES} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {syncBattleTime} from '../game/time.js';
import {recoverActualNorthernLocal} from './created-northern-care.mjs';
import {recoverCreatedJujuy,prepareCreatedSaltaReturn,prepareCreatedSaltaDefense,prepareCreatedJujuyReturn,prepareCreatedJujuyDefense,prepareCreatedHumahuacaReturn,stabilizeCreatedHighPass} from './created-northern-return.mjs';
import {enterSector} from '../game/world.js';
import {fightNorthernSector} from './northern-route.mjs';
import {withdrawCommandToRear} from './command-reserve-driver.mjs';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';
import {coastalSearchController} from './coastal-search-driver.mjs';
import {createdSupportedJujuyBattery} from './created-jujuy-defense-battery.mjs';

// The created route selects actual living replacements and preserves the
// original six-person expedition; the other route's default IDs stay intact.
export function prepareActualCreatedNorthernRelief(start,{report=()=>{},reliefIds=[135]}={}){
 let c=recoverFreshPort(start,{hospital:'cordoba',fieldIds:start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured)});
 const retained=[...c.recruited.filter(id=>c.operativeState[id].alive)],field=retained.filter(id=>id!==57);
 c=ensureRouteTownIncome(c,{report});
 const order=a=>{
  if(a.type==='wait')for(const id of retained){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;}}
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 report({stage:'care',hour:c.hour,treasury:c.resources.treasury,field,campaign:c});
 for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'rest'});
 // Batch ordinary wait orders up to the next income or retention boundary.
 // Each internal hour still runs the game clock and can stop for encounters.
 for(let elapsed=0,orders=0;elapsed<24000&&orders<3000&&c.resources.treasury<60000;orders++){
  assert.equal(c.pendingEncounter,null);
  const untilExpiry=Math.min(...retained.map(id=>c.contracts[id]?.expiresAt==null?Infinity:c.contracts[id].expiresAt-c.hour-1));
  const hours=Math.max(1,Math.min(24-c.hour%24,untilExpiry));
  const before=c.hour;order({type:'wait',hours});
  if(c.hour===before)assert.ok(c.assignmentAttention.notice||c.contractAttention.notice||c.logisticsNotice,'a paused wait must expose a real notice for acknowledgement');
  elapsed+=c.hour-before;
 }
 assert.ok(c.resources.treasury>=60000);report({stage:'funded',hour:c.hour,treasury:c.resources.treasury,campaign:c});
 for(const id of reliefIds){assert.ok(!c.recruited.includes(id));assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);order({type:'recruitCivic',id,term:'day',destination:'cordoba'});retained.push(id);field.push(id);}
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 assert.equal(field.length,6,'the current northern expedition retains exactly six real field soldiers');
 c=recoverNorthernLocalKit(c,{doctorId:135,report});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<600&&field.some(id=>c.operativeState[id].morale<65);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(field.every(id=>c.operativeState[id].morale>=65));
 report({stage:'rested',hour:c.hour,treasury:c.resources.treasury,field,campaign:c});
 return completeActualNorthernRested(c,{report});
}

export function completeActualNorthernRested(start,{report=()=>{}}={}){
 let c=start;const retained=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),field=retained.filter(id=>id!==57&&c.operativeState[id].location==='cordoba');
 assert.equal(field.length,6);assert.deepEqual([...field].sort((a,b)=>a-b),[5,6,7,11,135,147]);
 const order=a=>{
  if(a.type==='wait')for(const id of retained){while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours){const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}}
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+' '+next.lastError);c=next;
 };
 order({type:'createSquad',name:'Última columna del Norte',ids:field,sector:'cordoba'});
 for(const operativeId of field){
  const op=rosterFor(c).find(o=>o.id===operativeId);
  if(c.operativeState[operativeId].weaponDropped||![1800,1801,1802].includes(op.weapon))c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,report});
 }
 c=supplyRouteAmmunition(c,field,{target:16}).campaign;
 const medicalReserves=Object.fromEntries(field.map(id=>[id,10]));
 for(const operativeId of field)if(c.operativeState[operativeId].medkits<10)c=supplyRouteDressings(c,operativeId,10,{reserves:medicalReserves,report});
 assert.ok(field.every(id=>c.operativeState[id].medkits>=10));
 order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const battery=prepareRouteBattery(c,['bronze4','bronze4'],{destination:'cordoba',report});c=battery.campaign;
 for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100));h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:battery.selections});
 c=prepareFinalAssault(c,{staging:'cordoba',target:'tucuman',fieldIds:field});
 assert.equal(c.operativeState[57].location,'cordoba');
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}


// Leave the real commander and original local reserve behind this defense.
export function prepareActualSaltaReserve(start,{report=()=>{}}={}){
 let c=start;const events=[];
const front=c.activeSquadId,old57=structuredClone(c.operativeState[57]),oldLoadout=structuredClone(c.loadouts[57]);
const retained=[135,147],order=a=>{
 if(a.type==='wait')for(const id of retained){while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});}
 const before=c.resources.treasury,quote=a.type==='renewContract'?contractQuote(c,rosterFor(c).find(o=>o.id===a.id),'day'):null,next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+' '+next.lastError);c=next;
 if(quote){assert.equal(c.resources.treasury,before-quote.price);assert.equal(c.contracts[a.id].expiresAt,quote.expiresAt);}
 events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:before-c.resources.treasury});
};
order({type:'assignCare',operativeId:57,assignment:'active'});order({type:'createSquad',ids:[57],sector:'salta',name:'Reserva del mando'});order({type:'configureArtillery',types:[]});order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});
const rear=c.activeSquadId;assert.equal(squadTravelStatus(c.squads.find(q=>q.id===rear)).remaining,4);
for(let h=0;h<12&&c.squads.find(q=>q.id===rear).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.equal(c.operativeState[57].location,'tucuman');assert.equal(c.operativeState[57].hp,old57.hp);assert.deepEqual(c.loadouts[57],oldLoadout);assert.equal(c.operativeState[5].alive,true);assert.equal(c.operativeState[5].location,'tucuman');
order({type:'selectSquad',id:front});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
assert.deepEqual([...c.squad].sort((a,b)=>a-b),[6,7,11,135,147]);
 report({event:'saltaActualCommandReserve',hour:c.hour,treasury:c.resources.treasury,field:c.squad,events});return c;
}

// Treat the actual defense survivors, then bring back the rear pair.
export function rejoinActualNorthernColumn(start,{report=()=>{}}={}){
 let c=recoverActualNorthernLocal(start,{doctorId:135,report});
const front=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),rear=[57,5],retained=[...front,...rear],events=[];
assert.equal(front.length,4);assert.equal(new Set(retained).size,6);
const rearBefore=structuredClone(Object.fromEntries(rear.map(id=>[id,{operative:c.operativeState[id],loadout:c.loadouts[id]}])));
const order=a=>{
 if(a.type==='wait')for(const id of retained){while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});}
 const money=c.resources.treasury,quote=a.type==='renewContract'?contractQuote(c,rosterFor(c).find(o=>o.id===a.id),'day'):null,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);c=n;
 if(quote){assert.equal(c.resources.treasury,money-quote.price);assert.equal(c.contracts[a.id].expiresAt,quote.expiresAt);}
 events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:money-c.resources.treasury});
};
for(const operativeId of front)order({type:'assignCare',operativeId,assignment:'rest'});
for(const id of rear){assert.equal(c.operativeState[id].location,'tucuman');assert.equal(c.operativeState[id].alive,true);order({type:'assignCare',operativeId:id,assignment:'active'});}
order({type:'createSquad',ids:rear,sector:'tucuman',name:'Mando y reserva'});order({type:'configureArtillery',types:[]});
order({type:'travel',sector:'salta',queue:true,mode:'posta'});const incoming=c.activeSquadId;
assert.equal(squadTravelStatus(c.squads.find(q=>q.id===incoming)).remaining,4);
for(let h=0;h<12&&c.squads.find(q=>q.id===incoming).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const id of rear){assert.equal(c.operativeState[id].location,'salta');assert.equal(c.operativeState[id].hp,rearBefore[id].operative.hp);assert.deepEqual(c.loadouts[id],rearBefore[id].loadout);}
order({type:'createSquad',ids:[57,...front,5],sector:'salta',name:'Columna real reunida'});
for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'active'});
assert.equal(c.squad.length,6);assert.ok(c.squad.every(id=>c.operativeState[id].alive&&c.operativeState[id].hp===c.operativeState[id].maxHp));
for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
report({event:'northernActualSaltaRejoined',hour:c.hour,treasury:c.resources.treasury,field:c.squad,events});
 return c;
}

// A normal boundary withdrawal protects the physician; he rejoins by road.
export function rejoinActualJujuyPhysician(start,{report=()=>{}}={}){
let c=start;const front=[...c.squad],retained=[...front,135],events=[];
assert.equal(front.length,4);assert.equal(c.operativeState[135].alive,true);assert.equal(c.operativeState[135].location,'salta');
const old=structuredClone(c.operativeState[135]),loadout=structuredClone(c.loadouts[135]);
const order=a=>{
 if(a.type==='wait')for(const id of retained){while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});}
 const money=c.resources.treasury,q=a.type==='renewContract'?contractQuote(c,rosterFor(c).find(o=>o.id===a.id),'day'):null,next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+' '+next.lastError);c=next;
 if(q){assert.equal(c.resources.treasury,money-q.price);assert.equal(c.contracts[a.id].expiresAt,q.expiresAt);}
 events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:money-c.resources.treasury});
};
for(const operativeId of front)order({type:'assignCare',operativeId,assignment:'rest'});
order({type:'assignCare',operativeId:135,assignment:'active'});order({type:'createSquad',ids:[135],sector:'salta',name:'Regreso del sanitario'});order({type:'configureArtillery',types:[]});order({type:'travel',sector:'jujuy',queue:true,mode:'posta'});const incoming=c.activeSquadId;
assert.equal(squadTravelStatus(c.squads.find(q=>q.id===incoming)).remaining,6);
for(let h=0;h<16&&c.squads.find(q=>q.id===incoming).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.equal(c.operativeState[135].location,'jujuy');assert.equal(c.operativeState[135].hp,old.hp);assert.deepEqual(c.loadouts[135],loadout);
order({type:'createSquad',ids:[57,7,6,147,135],sector:'jujuy',name:'Columna con sanitario'});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
assert.equal(c.squad.length,5);assert.ok(c.squad.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp));
report({event:'northernActualPhysicianRejoined',hour:c.hour,treasury:c.resources.treasury,events});
 return recoverCreatedJujuy(c,{report});
}

// Hire real short-term relief and recover exact kit from discovered bodies.
export function prepareActualHighPassRelief(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
const initial=structuredClone(c),events=[],field=[57,7,135,142,145];
const order=a=>{const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);c=decodeSave(encodeSave(n)).campaign;events.push({action:a,before,after:{hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury}});assert.equal(c.pendingEncounter,null);};
const inventory=id=>sectorInventoryModel(c,'jujuy',rosterFor(c),id);
for(const id of [142,145]){const q=contractQuote(c,rosterFor(c).find(o=>o.id===id),'day'),cash=c.resources.treasury;assert.equal(q.available,true,q.reason);order({type:'recruitCivic',id,term:'day',destination:'jujuy'});assert.equal(c.resources.treasury,cash-q.price);assert.equal(c.hour,initial.hour);assert.equal(c.recruited.includes(id),false);assert.equal(c.hiringArrivals.find(a=>a.operativeId===id)?.dueAt,initial.hour+6);}
const need=Math.ceil((c.operativeState[7].maxHp-c.operativeState[7].hp)/doctorRate(rosterFor(c).find(o=>o.id===135),c));assert.equal(need,6);
while(c.operativeState[135].medkits<need){const row=inventory(135).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row);const count=Math.min(row.count,need-c.operativeState[135].medkits);order({type:'sectorInventory',sector:'jujuy',operativeId:135,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(inventory(135).entries.find(r=>r.key===row.key)?.count??0,row.count-count);}
const medicalBefore=c.operativeState[135].medkits;
order({type:'assignCare',operativeId:135,assignment:'doctor'});order({type:'assignCare',operativeId:7,assignment:'patient'});order({type:'assignCare',operativeId:57,assignment:'rest'});
for(let h=0;h<6;h++){assert.ok(c.contracts[135].expiresAt>c.hour+1);order({type:'wait',hours:1});}
assert.equal(c.hour,initial.hour+6);assert.equal(c.operativeState[7].hp,c.operativeState[7].maxHp);assert.equal(medicalBefore-c.operativeState[135].medkits,6);
for(const id of field){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,'jujuy');assert.equal(c.operativeState[id].alive,true);order({type:'assignCare',operativeId:id,assignment:'active'});}
order({type:'squad',ids:field});
for(const id of [142,145]){assert.equal(c.contracts[id].started,c.hour);assert.equal(c.contracts[id].expiresAt,c.hour+24);assert.equal(rosterFor(c).find(o=>o.id===id).weapon,0);assert.equal(c.operativeState[id].headwear,null);}
let p=visit(c);const beforeVisit=structuredClone(c),moves=[];
const tactical=a=>{const n=actBattle(p.battle,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);const pair=syncBattleTime(p.campaign,n);assert.equal(pair.error,null);p=decodeSave(encodeSave(pair.campaign,pair.battle));moves.push(a);};
// Body discovery needs no maintenance or perfect-condition gun. Keep the
// commander's actual worn firearm and supplies while the physician approaches.
const command=structuredClone(p.battle.units.find(u=>u.id==='57'));
const doctor=p.battle.units.find(u=>u.id==='135'),body=p.battle.units.find(u=>u.id==='6');assert.equal(body.hp,0);assert.equal(Boolean(body.knownToPlayer),false);
const points=getReachable(p.battle,doctor),point=points.find(q=>q.x===43&&q.y===15&&(q.tacticalLevel??0)===0);assert.ok(point,'the actual physician has the known six-step body approach');
const preview=targetPreview(p.battle,doctor,point,{mode:'move',reachable:points});assert.equal(preview.valid,true);
const gunRecords=structuredClone(p.battle.artillery),bodyKit=structuredClone(body);
tactical({type:'move',unitId:'135',x:point.x,y:point.y,tacticalLevel:0});
assert.deepEqual(p.battle.artillery,gunRecords);const discovered=p.battle.units.find(u=>u.id==='6');assert.equal(discovered.knownToPlayer,true);
for(const key of ['hp','weapon','condition','blade','bladeCondition','inventory','headwear','outfit','legwear','loaded','ammo','ammunitionVersion','ammunition'])assert.deepEqual(discovered[key],bodyKit[key]);
const retainedCommand=p.battle.units.find(u=>u.id==='57');
for(const key of ['hp','loaded','ammo','ammunitionVersion','ammunition','ammunitionCounts','reloadProgress','weapon','weaponDefinition','weaponMetadata','weaponFittings','weaponFittingPattern','weaponInstanceId','condition','inventory','blade','bladeCondition','headwear','outfit','legwear','medkits','rations','toolkitPoints'])assert.deepEqual(retainedCommand[key],command[key],key+' survives actual body discovery');
assert.ok(retainedCommand.ap<=command.ap);assert.ok(retainedCommand.energy<=command.energy);
c=decodeSave(encodeSave(leave(p))).campaign;
assert.equal(c.operativeState[57].condition,command.condition);assert.equal(c.resources.treasury,beforeVisit.resources.treasury);
const equip=(id,row,slot)=>{assert.equal(row.reachable,true,row.reason);const clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},terms=structuredClone(c.contracts),keys=new Set(inventory(id).carried.map(r=>r.inventoryKey).filter(Boolean)),stack=JSON.parse(row.expected);order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});assert.equal(inventory(id).entries.find(r=>r.key===row.key)?.count??0,row.count-1);const carried=inventory(id).carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(carried);const {item,...record}=stack;assert.deepEqual(JSON.parse(carried.expected),record);order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});if(slot==='blade')assert.deepEqual(JSON.parse(inventory(id).carried.find(r=>r.item==='blade').store.expected),stack);else assert.deepEqual(c.operativeState[id][slot],record);assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);assert.deepEqual(c.contracts,terms);events.push({event:'exactFiniteReliefKit',id,slot,key:row.key,stack});};
for(const [id,bodyId]of [[142,'5'],[145,'6']])for(const [slot,kind]of [['headwear','hat'],['outfit','poncho'],['legwear','trousers'],['blade',null]]){const row=inventory(id).entries.find(r=>{const stack=JSON.parse(r.expected);return r.reachable&&r.key.startsWith(JSON.stringify(['body',bodyId]).slice(0,-1))&&(kind?stack.kind==='outfit'&&stack.outfit===kind&&stack.condition===100:Boolean(BLADES[stack.weapon])&&stack.condition>0);});assert.ok(row,'exact discovered fallen body kit '+bodyId+' '+slot);equip(id,row,slot);}
for(const [id,r]of Object.entries(initial.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(c.squad,field);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
const clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},terms=structuredClone(c.contracts),medical=[];
while(c.operativeState[135].medkits<6){
 const model=sectorInventoryModel(c,'jujuy',rosterFor(c),135),row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row);const count=Math.min(row.count,6-c.operativeState[135].medkits),before=c.operativeState[135].medkits;
 const n=dispatchCampaign(c,{type:'sectorInventory',sector:'jujuy',operativeId:135,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(n.lastError,null);c=decodeSave(encodeSave(n)).campaign;assert.equal(c.operativeState[135].medkits,before+count);assert.equal(sectorInventoryModel(c,'jujuy',rosterFor(c),135).entries.find(r=>r.key===row.key)?.count??0,row.count-count);medical.push({key:row.key,expected:row.expected,count});
}
assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);assert.deepEqual(c.contracts,terms);
 report({event:'actualHighPassRelief',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field,medical,events,visitOrders:moves});return c;
}

// Continue the earned created-route survivors through the northern road.
// Every battle uses the ordinary settlement/replay/save and loss guards.
export function finishActualCreatedNorthernReturn(prefix,{onCheckpoint}={}){
 const alive=prefix.campaign.recruited.filter(id=>prefix.campaign.operativeState[id].alive&&!prefix.campaign.operativeState[id].captured);
 let campaign=recoverFreshPort(prefix.campaign,{hospital:'cordoba',fieldIds:alive});
 campaign=prepareActualCreatedNorthernRelief(campaign);
 const notes=[...prefix.notes],note=(stage,details={})=>{notes.push({stage,hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...details});onCheckpoint?.(stage,campaign,notes);};
 note('northern-relief');
 let initial=enterSector(campaign.pendingBattle,campaign.sectorStates.tucuman);
 const tucuman=fightNorthernSector(campaign,'tucuman',{deploy:withdrawCommandToRear(initial,135,'cordoba'),controller:stagedBatteryController()});campaign=tucuman.campaign;note('tucuman-return',tucuman.summary);
 const localReserve=structuredClone({operative:campaign.operativeState[5],loadout:campaign.loadouts[5]});
 campaign=dispatchCampaign(campaign,{type:'assignCare',operativeId:5,assignment:'rest'});assert.equal(campaign.lastError,null);
 campaign=prepareCreatedSaltaReturn(campaign,{retainedIds:[57,135,6,7,11,147]});
 assert.equal(campaign.pendingBattle.squad.length,6);assert.equal(campaign.operativeState[5].location,'tucuman');assert.equal(campaign.operativeState[5].hp,localReserve.operative.hp);assert.deepEqual(campaign.loadouts[5],localReserve.loadout);
 const salta=fightNorthernSector(campaign,'salta',{controller:stagedBatteryController()});campaign=salta.campaign;note('salta-return',salta.summary);
 campaign=recoverActualNorthernLocal(campaign,{activateAfterCare:false});note('salta-care');
 campaign=prepareActualSaltaReserve(campaign);
 campaign=prepareCreatedSaltaDefense(campaign);
 const defense=fightNorthernSector(campaign,'salta',{controller:stableCrewController()});campaign=defense.campaign;note('salta-defense',defense.summary);
 campaign=rejoinActualNorthernColumn(campaign);note('salta-defense-care');
 campaign=prepareCreatedJujuyReturn(campaign);initial=enterSector(campaign.pendingBattle,campaign.sectorStates.jujuy);
 const search=coastalSearchController(initial),held=(battle,unit)=>{const action=search(battle,unit);return unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;};
 const jujuy=fightNorthernSector(campaign,'jujuy',{deploy:withdrawCommandToRear(initial,135,'salta'),controller:held});campaign=jujuy.campaign;note('jujuy',jujuy.summary);
 assert.equal(campaign.operativeState[135].alive,true);assert.equal(campaign.operativeState[135].location,'salta');
 campaign=rejoinActualJujuyPhysician(campaign);note('jujuy-care');
 campaign=prepareCreatedJujuyDefense(campaign);
 const northernDefense=fightNorthernSector(campaign,'jujuy',createdSupportedJujuyBattery(campaign));campaign=northernDefense.campaign;note('jujuy-defense',northernDefense.summary);
 campaign=prepareActualHighPassRelief(campaign);
 campaign=prepareCreatedHumahuacaReturn(campaign);
 assert.deepEqual(campaign.squad,[57,7,135,142,145]);assert.equal(campaign.pendingBattle.squad.length,5);
 const pass=fightNorthernSector(campaign,'humahuaca',createdHighPassBattery(campaign,{reserveCommand:false}));campaign=pass.campaign;note('humahuaca',pass.summary);
 campaign=stabilizeCreatedHighPass(campaign);note('humahuaca-stabilization');
 for(const [id,r]of Object.entries(prefix.campaign.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[57].alive,true);
 return {campaign,notes,prefix:prefix.prefix,roles:prefix.roles};
}
