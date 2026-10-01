import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {contractQuote} from '../game/contracts.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';

const rifleKey=campaign=>equipmentKey(equipmentCatalog(campaign).find(item=>item.id===1801));

function restockDressings(c,order,operativeId,target){
 const quantity=Math.max(0,target-(c.operativeState[operativeId].medkits??0));
 if(quantity)order({type:'purchaseMedicalSupplies',operativeId,quantity});
}

// Normal funding, equipment, timed approaches and explicitly coordinated squads.
export function prepareFreshUspallataAssault(start,{guns=2}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(7)).id});order({type:'assignCare',operativeId:7,assignment:'active'});order({type:'travel',sector:'mendoza',mode:'posta'});
const locals=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
c=sellSurplusEquipment(c,'mendoza',locals,400);
order({type:'diplomacy',kind:'parliament'});order({type:'fortify',sector:'mendoza'});
for(const operativeId of locals)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<600&&c.resources.treasury<12000;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
// Contracts can expire while the treasury recovers. Select a physician who
// is still in service at departure, rather than keeping a stale roster entry.
const physician=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location==='mendoza'&&op.id!==7&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];assert.ok(physician,'the mountain column needs a living local medic');
const recruits=[105,128,109,132,145,106,147,143,118,138,135].filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!c.recruited.includes(id)&&r.hp===r.maxHp&&r.morale>=50;}).slice(0,6);
assert.equal(recruits.length,6,'six living and ready replacements must accept paid contracts');
for(const id of recruits)order({type:'recruitCivic',id,term:'day'});
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(recruits.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
for(const operativeId of recruits.filter(id=>![1800,1801,1802].includes(rosterFor(c).find(op=>op.id===id).weapon))){order({type:'purchaseEquipment',item:rifleKey(c)});order({type:'equip',operativeId,slot:'weapon',itemId:rifleKey(c)});}
order({type:'squad',ids:[7,physician.id,...recruits.slice(0,4)]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo de la cordillera',ids:recruits.slice(4),sector:'mendoza'});const support=c.activeSquadId;
// Retain unused dressings from earlier care; buy only the field-stock shortfall.
restockDressings(c,order,physician.id,15);
// Buy finite compatible cartridges through the current treasury economy.
// Finish real reloads before attaching the reserve cannon to the assault.
c=supplyRouteAmmunition(c,[7,physician.id,...recruits],{target:12}).campaign;
order({type:'configureArtillery',types:[]});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
order({type:'configureArtillery',types:Array.from({length:guns},()=> 'bronze4')});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
order({type:'beginAssault',sector:'uspallata'});
 assert.equal(c.pendingBattle.squad.length,8);return c;
}

// Recover finite field dressings and give real first aid before the return.
// Hire a surviving available doctor; renew only people who still need care.
export function recoverFreshUspallata(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const survivors=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='uspallata';});
assert.ok(survivors.length>0&&survivors.length<=6,'the recovered mountain column fits a normal squad');
order({type:'squad',ids:survivors});
const doctors=rosterFor(c).filter(o=>survivors.includes(o.id)&&c.operativeState[o.id].hp>=15&&!c.operativeState[o.id].bleeding&&o.medical>=20).sort((a,b)=>b.medical-a.medical).map(o=>o.id);
assert.ok(doctors.length);
for(const id of doctors)for(const row of sectorInventoryModel(c,'uspallata',rosterFor(c),id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){const count=Math.min(row.count,10-c.operativeState[id].medkits);if(count>0)order({type:'sectorInventory',sector:'uspallata',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
let p=visit(c);const aid=autoBandageBattle(p.battle);assert.ok(!aid.error);c=leave(sync({campaign:p.campaign,battle:aid.battle}));
report({event:'mountainFirstAid',hour:c.hour,survivors:survivors.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))});
for(const id of survivors){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
order({type:'fortify',sector:'uspallata'});order({type:'travel',sector:'mendoza',mode:'posta'});assert.equal(c.location,'mendoza');
const medic=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&o.medical>=60&&contractQuote(c,o,'day').available).sort((a,b)=>b.medical-a.medical)[0];assert.ok(medic);order({type:'recruitCivic',id:medic.id,term:'day'});
for(let h=0;h<24&&!c.recruited.includes(medic.id);h++){
 for(const id of survivors){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
 order({type:'wait',hours:1});
}
assert.equal(c.operativeState[medic.id].location,'mendoza');assert.ok(c.recruited.includes(medic.id));
const patients=survivors.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
const localDoctors=rosterFor(c).filter(o=>c.recruited.includes(o.id)&&!patients.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].location==='mendoza'&&o.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,patients.length).map(o=>o.id);
c=sellSurplusEquipment(c,'mendoza',[...patients,...localDoctors],5000,{reserve:0,report});
for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 assert.equal(c.pendingEncounter,null);
 for(const id of [...patients,...localDoctors]){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
 for(const id of localDoctors){if(!c.operativeState[id].medkits)order({type:'purchaseMedicalSupplies',operativeId:id,quantity:1});order({type:'assignCare',operativeId:id,assignment:'doctor'});}
 for(const id of patients)order({type:'assignCare',operativeId:id,assignment:'patient'});
 order({type:'wait',hours:1});report({event:'mountainMedicalCare',hour:c.hour,treasury:c.resources.treasury,patients:patients.map(id=>({id,hp:c.operativeState[id].hp}))});
}
for(const id of survivors){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
return c;
}

// Bank ordinary income before signing new contracts; wait for finite shop stock.
export function prepareFreshLosPatosAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const permanent=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='mendoza'&&c.contracts[op.id]?.expiresAt===null;});
 const commander=permanent.filter(op=>op.leadership>=80).sort((a,b)=>b.marksmanship-a.marksmanship)[0];
 const physician=permanent.filter(op=>op.id!==commander?.id&&op.medical>=20).sort((a,b)=>b.leadership-a.leadership)[0];
 assert.ok(commander&&physician,'the second column needs living command and medical roles');
 order({type:'squad',ids:[commander.id,physician.id]});
 for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';}))order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<1200&&(c.resources.treasury<14000||c.hour%24<6||c.hour%24>10);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 const recruits=[105,128,147,132,106,135,143,118,138].filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!c.recruited.includes(id)&&r.hp===r.maxHp&&r.morale>=50;}).slice(0,8-permanent.length);
 assert.equal(recruits.length,8-permanent.length,'available survivors or replacements accept actual contracts');
 const field=[commander.id,physician.id,...permanent.filter(o=>![commander.id,physician.id].includes(o.id)).map(o=>o.id),...recruits];
 const rearm=field.filter(id=>c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon));
 // Build the finite local stock before starting short paid contracts.
 for(let n=0;n<rearm.length;n++){
  for(let h=0;h<48&&!c.merchants.mendoza.stock[rifleKey(c)];h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  order({type:'purchaseEquipment',item:rifleKey(c)});
 }
 // Earlier assaults can use every issued gun. Buy the real shortfall and
 // wait for finite shop stock before starting the new one-day contracts.
 while((c.armory.bronze4??0)<2){
  for(let h=0;h<48&&!c.merchants.mendoza.stock.bronze4;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(let h=0;h<24&&(c.hour%24<6||c.hour%24>10);h++)order({type:'wait',hours:1});
 for(const id of recruits)order({type:'recruitCivic',id,term:'day'});
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(recruits.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
 for(const operativeId of rearm)order({type:'equip',operativeId,slot:'weapon',itemId:rifleKey(c)});
 order({type:'squad',ids:field.slice(0,6)});const main=c.activeSquadId;
 order({type:'createSquad',name:'Apoyo de Los Patos',ids:field.slice(6),sector:'mendoza'});const support=c.activeSquadId;
 restockDressings(c,order,physician.id,10);
 c=supplyRouteAmmunition(c,field,{target:12}).campaign;
 order({type:'configureArtillery',types:[]});
 for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
 order({type:'configureArtillery',types:['bronze4','bronze4']});
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'travel',sector:'uspallata',mode:'posta'});}
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'los_patos',queue:true,mode:'posta'});}
 for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'los_patos'});
 assert.equal(c.pendingBattle.squad.length,field.length);
 assert.ok(c.pendingBattle.squad.every(u=>u.entryEdge==='E'));
 for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export function completeFreshAndesPreparation(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
 if(a.type==='wait')for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos'))while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+a.hours){const renewed=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});assert.equal(renewed.lastError,null,renewed.lastError);c=renewed;}
 c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
// Stabilize the actual survivors before the return journey advances time.
const pair=visit(c),aid=autoBandageBattle(pair.battle);assert.ok(!aid.error);c=leave(sync({campaign:pair.campaign,battle:aid.battle}));
for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos')){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
order({type:'fortify',sector:'los_patos'});assert.equal(c.phase,4);
const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos');
const returning=c.squads.filter(q=>q.members.some(id=>field.includes(id))).map(q=>q.id);
assert.ok(returning.length>0);
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
// Keep both surviving squads within the normal six-person limit and return
// concurrently, paying each route rather than merging eight people into one.
for(const id of returning){order({type:'selectSquad',id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
for(let hour=0;hour<80&&returning.some(id=>c.squads.find(q=>q.id===id)?.journey);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const id of field)assert.equal(c.operativeState[id].location,'mendoza');
const envoy=field.find(id=>c.operativeState[id].hp>=15&&rosterFor(c).find(op=>op.id===id).leadership>=80);assert.notEqual(envoy,undefined,'a living qualified envoy must meet San Martín');
const speakerSquad=c.squads.find(q=>q.members.includes(envoy));assert.ok(speakerSquad);
order({type:'selectSquad',id:speakerSquad.id});
c=meetRecruits(c,['san-martin'],envoy);assert.ok(c.recruited.includes(57));assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}
