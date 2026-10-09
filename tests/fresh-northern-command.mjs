import {routeHiringCeiling} from './funded-route-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {collectRouteMedicalSupplies,discoverRouteCache} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {attendYatasto} from './mission-helpers.mjs';

// Reinforce and position the real survivors before the arriving counterattack.
export function prepareHiredNorthernDefense(start){
 let c=structuredClone(start);
 const order=a=>{if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null);c=n;}}const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;};
 const defendNow=()=>{assert.equal(c.pendingEncounter?.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});return c;};
 if(c.pendingEncounter)return defendNow();

// Keep the actual hired force; local officers are not unlocked yet.

const candidates=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&contractQuote(c,o,'week').price<=routeHiringCeiling(c,200)).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(o=>o.id);
for(const id of candidates)order({type:'recruitCivic',id,term:'week',destination:'cordoba'});
const until=c.hour+6;for(let h=0;c.hour<until&&!c.pendingEncounter&&h<20;h++)order({type:'wait',hours:1});
// An actual arrival ends preparation. Fight with whoever reached the province;
// outstanding paid hires cannot be granted their remaining travel time early.
if(c.pendingEncounter)return defendNow();
const field=rosterFor(c).filter(o=>c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].location==='cordoba').sort((a,b)=>b.marksmanship-a.marksmanship).map(o=>o.id),groups=[];
for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),name:'Defensa de Córdoba',sector:'cordoba'});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:groups[0]});let p=visit(c),b=p.battle;
const cells=b.upperSurfaces.filter(t=>!t.blocked).sort((a,d)=>Math.hypot(a.x-b.width*.5,a.y-b.height*.5)-Math.hypot(d.x-b.width*.5,d.y-b.height*.5)||a.y-d.y||a.x-d.x);
const act=a=>{b=actBattle(b,a);assert.equal(b.lastError,null,JSON.stringify(a)+b.lastError);};
for(const id of c.squad){let u=b.units.find(u=>u.id===String(id));act({type:'movement',unitId:u.id,movement:'walk'});u=b.units.find(u=>u.id===String(id));const dest=cells.find(p=>!b.units.some(v=>v.id!==u.id&&v.hp>0&&sameCell(v,p))&&getReachable(b,u,{stopAt:cell=>sameCell(cell,p)}).length);assert.ok(dest);act({type:'move',unitId:u.id,...spacePoint(dest)});act({type:'stance',unitId:u.id,stance:'crouched'});}
c=leave(sync({campaign:p.campaign,battle:b}));
order({type:'fortify',sector:'cordoba'});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;!c.pendingEncounter&&h<144;h++)order({type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');
order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 return c;
}

// A courier recovers officers, a real provincial gun and finite dressings.
export function prepareNorthernOfficerRelief(start,{report=()=>{}}={}){
 let c=structuredClone(start);
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
const order=a=>{if(a.type==='assignCare'&&c.operativeState[a.operativeId].assignment===a.assignment)return;if(a.type==='wait')for(const id of live()){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(c.lastError,null);}}c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const travel=at=>{const id=c.activeSquadId;order({type:'travel',sector:at,queue:true,mode:'posta'});for(let h=0;h<36&&c.squads.find(q=>q.id===id).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(c.location,at);};

 for(const id of live())order({type:'assignCare',operativeId:id,assignment:'rest'});
 const courier=rosterFor(c).filter(op=>live().includes(op.id)&&op.leadership>=60&&c.operativeState[op.id].location==='tucuman'&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>Number(b.id===114)-Number(a.id===114)||c.operativeState[b.id].energy-c.operativeState[a.id].energy||b.leadership-a.leadership)[0]?.id;
 assert.ok(courier,'the envoy must be a living local leader, preserving every actual fallen soldier');
 for(let h=0;h<72&&(c.operativeState[courier].fatigue||c.operativeState[courier].energy<100||c.operativeState[courier].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[courier].asleep,false);assert.equal(c.operativeState[courier].energy,100);
 order({type:'transport',mode:'posta'});
 order({type:'createSquad',ids:[courier],name:'Enlace provincial',sector:'tucuman'});order({type:'assignCare',operativeId:courier,assignment:'active'});travel('cordoba');
 c=meetRecruits(c,['quiroga','paz'],courier);
 // The clinic delivery needs twenty owned dressings in total. Existing
 // carried stock counts toward that delivery; demanding twenty extra can
 // exceed the courier's real pockets and force an unnecessary supply trip.
 const dressingTarget=Math.max(c.operativeState[courier].medkits??0,20);
 c=discoverRouteCache(c,courier);
 const localStock=sectorInventoryModel(c,'cordoba',rosterFor(c),courier).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
 const donations=live().filter(id=>id!==courier&&c.operativeState[id].location==='cordoba'&&!sectorInventoryModel(c,'cordoba',rosterFor(c),id).reason).reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);
 c=supplyRouteDressings(c,courier,Math.min(dressingTarget,(c.operativeState[courier].medkits??0)+localStock+donations),{report});
 for(let trip=0;trip<20&&(c.operativeState[courier].medkits??0)<dressingTarget;trip++){
  const found=collectRouteMedicalSupplies(c,courier,dressingTarget-(c.operativeState[courier].medkits??0),{report});c=found.campaign;
 }
 assert.equal(c.operativeState[courier].medkits,dressingTarget,'the courier must recover every delivered dressing from actual finite stocks');
 // Ensenada holds the only swivel. The first northern assault instead uses
 // Córdoba's existing bronze piece and its real two-person provincial crew.
 const battery=prepareRouteBattery(c,['bronze4'],{destination:'tucuman',keepServing:live(),report});c=battery.campaign;
 order({type:'configureArtillery',types:battery.selections});
 order({type:'diplomacy',kind:'partisanSupply'});c=meetRecruits(c,['azurduy'],courier);
 order({type:'sectorInventory',sector:'tucuman',operativeId:courier,direction:'drop',item:'medkits',count:20});
 const model=id=>sectorInventoryModel(c,'tucuman',rosterFor(c),id);
 const physicians=[1,...rosterFor(c).filter(op=>op.id!==1&&live().includes(op.id)&&op.medical>=20&&c.operativeState[op.id].location==='tucuman'&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical).map(op=>op.id)].slice(0,2);
 assert.equal(physicians.length,2,'two actual living local doctors must carry the delivered dressings');
 for(const id of physicians){const row=model(id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits'&&r.count>=10);assert.ok(row);order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:10});}
 const patients=live().filter(id=>!physicians.includes(id)&&c.operativeState[id].location==='tucuman'&&(c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding));
 for(const operativeId of physicians)order({type:'assignCare',operativeId,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);h++){
  assert.equal(c.pendingEncounter,null);
  for(const id of physicians)if(!c.operativeState[id].medkits){const row=model(id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row,'the doctor must recover actual field dressings when the delivered batch is spent');order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(10,row.count)});}
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp,'finite provincial care must restore the actual injured support');
 for(const operativeId of [...physicians,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const officers=[9,11,1],field=[...officers,...live().filter(id=>!officers.includes(id)&&c.operativeState[id].location==='tucuman'&&c.operativeState[id].hp===c.operativeState[id].maxHp&&c.operativeState[id].morale>=30)];
 report({event:'northernReliefFormation',field,campaign:structuredClone(c)});
 assert.ok(field.length>=8,'the officers need actual fit survivors as support');
 for(let h=0;h<36&&field.some(id=>c.operativeState[id].fatigue||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){
  assert.equal(c.pendingEncounter,null);for(const id of live())order({type:'assignCare',operativeId:id,assignment:c.operativeState[id].hp<c.operativeState[id].maxHp?'patient':'rest'});order({type:'wait',hours:1});
 }
 for(const id of field){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
 for(let i=0;i<field.length;i+=6){order({type:'createSquad',ids:field.slice(i,i+6),name:'Columna con oficiales',sector:'tucuman'});const p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=finishReloadsBeforeMarch(c);}
 return prepareFinalAssault(c,{staging:'tucuman',target:'salta',fieldIds:field});
}

// Yatasto accepts a capable local envoy; it does not require a particular officer.
// Stable wounds remain real wounds. Only acute survivors need finite field aid.
export function completeHiredNorthernMission(start,{report=()=>{},onCheckpoint}={}){
 let c=structuredClone(start);const prior=structuredClone(start),now=()=>c.hour*3600+(c.secondOfHour??0);
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const acute=()=>live().filter(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const checkpoint=stage=>{assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:stage,campaign:structuredClone(c)});onCheckpoint?.(stage,structuredClone(c));};
 const keepServing=(hours=2)=>{
  for(const id of live()){
   let contract=c.contracts[id],expiry=contractExpiresSeconds(contract);
   assert.ok(contract&&(expiry===null||expiry>now()),`The actual survivor ${id} must still be serving; expired service cannot be restored by this route.`);
   for(let renewals=0;expiry!==null&&expiry<=now()+hours*3600;renewals++){
    assert.ok(renewals<4,'The mission renewal horizon must remain bounded.');
    const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
    assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
    assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);
    report({event:'northernMissionRenewal',id,price:quote.price,hour:c.hour,secondOfHour:c.secondOfHour??0,expiresAt:c.contracts[id].expiresAt,expiresSecond:c.contracts[id].expiresSecond??0});
    contract=c.contracts[id];expiry=contractExpiresSeconds(contract);
   }
  }
 };
 const waitHour=()=>{
  assert.equal(acute().length,0,`All actual acute survivors need care before mission hours: ${acute().join(',')}.`);
  assert.equal(c.pendingEncounter,null);keepServing();const before=now();order({type:'wait',hours:1});
  assert.ok(now()>before,'The real mission wait must advance time.');assert.equal(c.pendingEncounter,null,'An actual raid must be resolved before continuing to Yatasto.');
 };

 // Inspect every owned survivor, including people left in another cell. A
 // local capable medic and actual reachable dressing stock are mandatory.
 for(let batches=0;acute().length;batches++){
  assert.ok(batches<live().length,'Finite first aid must resolve each actual acute group.');keepServing();
  const patients=acute().sort((a,b)=>c.operativeState[a].hp/Math.max(1,c.operativeState[a].bleeding)-c.operativeState[b].hp/Math.max(1,c.operativeState[b].bleeding)),at=operativeLocation(c,patients[0]);
  const medic=rosterFor(c).filter(op=>live().includes(op.id)&&operativeLocation(c,op.id)===at&&!operativeInTransit(c,op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>0&&op.medical>0).sort((a,b)=>Number(c.operativeState[a.id].bleeding>0)-Number(c.operativeState[b.id].bleeding>0)||b.medical-a.medical)[0];
  assert.ok(medic,`No actual capable local medic can stabilize the survivors at ${at}.`);
  const group=[medic.id,...patients.filter(id=>id!==medic.id&&operativeLocation(c,id)===at).slice(0,5)];
  order({type:'createSquad',ids:group,sector:at,name:'Socorro del norte'});
  for(const id of group)order({type:'assignCare',operativeId:id,assignment:'active'});
  if(!(c.operativeState[medic.id].medkits>0)){
   const row=sectorInventoryModel(c,at,rosterFor(c),medic.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   assert.ok(row,`No actual reachable dressings remain for first aid at ${at}.`);
   const count=Math.min(row.count,2*group.length);
   order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   report({event:'northernMissionDressingsCollected',id:medic.id,sector:at,count,sourceKey:row.key});
  }
  const p=visit(c),aid=autoBandageBattle(p.battle);c=leave(sync({campaign:p.campaign,battle:aid.battle}));
  for(const id of group){assert.ok(c.operativeState[id].alive&&c.operativeState[id].hp>=15,`Actual finite first aid must stabilize ${id}.`);assert.equal(c.operativeState[id].bleeding,0);}
  report({event:'northernMissionFirstAid',sector:at,ids:group,actions:aid.steps.length,elapsedSeconds:aid.elapsedSeconds,treatedIds:aid.treatedIds,stoppedReason:aid.stoppedReason});
 }
 assert.equal(acute().length,0);keepServing();
 const envoy=rosterFor(c).filter(op=>live().includes(op.id)&&operativeLocation(c,op.id)==='salta'&&!operativeInTransit(c,op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>c.operativeState[b.id].hp/c.operativeState[b.id].maxHp-c.operativeState[a.id].hp/c.operativeState[a.id].maxHp||b.leadership-a.leadership||a.id-b.id)[0];
 assert.ok(envoy,'The agreement needs an actual living capable local envoy.');
 order({type:'createSquad',ids:[envoy.id],sector:'salta',name:'Enlace de Yatasto'});
 order({type:'assignCare',operativeId:envoy.id,assignment:'rest'});
 for(let h=0;h<72&&(c.operativeState[envoy.id].fatigue||c.operativeState[envoy.id].energy<100||c.operativeState[envoy.id].asleep);h++)waitHour();
 assert.equal(c.operativeState[envoy.id].fatigue,0);assert.equal(c.operativeState[envoy.id].energy,100);assert.equal(c.operativeState[envoy.id].asleep,false);
 order({type:'assignCare',operativeId:envoy.id,assignment:'active'});
 report({event:'northernMissionEnvoy',id:envoy.id,name:envoy.name,hp:c.operativeState[envoy.id].hp,actualSurvivors:live()});
 if(!c.flags.northPact){const cash=c.resources.treasury;order({type:'diplomacy',kind:'northPact'});assert.equal(c.resources.treasury,cash-300);report({event:'northernMissionPact',cost:300});}
 order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});const squadId=c.activeSquadId;
 for(let h=0;h<48&&c.squads.find(q=>q.id===squadId).journey;h++){
  const journey=c.squads.find(q=>q.id===squadId).journey;assert.equal(journey.status,'moving',`The real envoy route stopped: ${journey.reason}.`);waitHour();
 }
 assert.equal(c.squads.find(q=>q.id===squadId).journey,undefined);assert.equal(c.location,'tucuman');checkpoint('northernMissionArrival');
 assert.equal(acute().length,0);keepServing();c=attendYatasto(c);
 assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const [id,r]of Object.entries(prior.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 for(const id of live()){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>now());}
 assert.equal(c.operativeState[10].alive,prior.operativeState[10].alive);assert.equal(c.operativeState[57].hp,88);assert.ok(!c.recruited.includes(57));checkpoint('northernMissionCompleted');
 return c;
}
