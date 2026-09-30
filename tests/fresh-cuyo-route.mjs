import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {doctorRate} from '../game/medical-care.js';
import {RECIPES} from '../game/data.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {contractQuote} from '../game/contracts.js';

// Actual transport, shop care and defense preparation after fresh Yatasto.
export function prepareFreshCuyoDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(c.pendingEncounter?.sector==='salta'&&a.type!=='respondToEncounter'){
   const selected=c.activeSquadId,groupId=c.pendingEncounter.groupId;
   c=dispatchCampaign(c,{type:'respondToEncounter',groupId,choice:'retreat',destination:'tucuman'});assert.equal(c.lastError,null,c.lastError);
   c=dispatchCampaign(c,{type:'selectSquad',id:selected});assert.equal(c.lastError,null,c.lastError);
   report({event:'cuyoRearWithdrawal',groupId,hour:c.hour,destination:'tucuman'});
  }
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<=c.hour+elapsed){const contract=c.contracts[id],next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
 };
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
// Bring the surviving northern reserve to the assembly point before paying
// for the elite's short contract. Every reinforcement travels normally.
const assemblySquad=c.activeSquadId,reinforcementSquads=[];
const elsewhere=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location!=='cordoba';});
for(const sector of new Set(elsewhere.map(id=>c.operativeState[id].location))){
 const ids=elsewhere.filter(id=>c.operativeState[id].location===sector);
 for(let offset=0;offset<ids.length;offset+=6){
  const members=ids.slice(offset,offset+6);order({type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector});
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  reinforcementSquads.push(c.activeSquadId);order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 }
}
for(let h=0;h<48&&reinforcementSquads.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(reinforcementSquads.every(id=>c.squads.find(q=>q.id===id)?.location==='cordoba'));
order({type:'selectSquad',id:assemblySquad});
const assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
const candidates=rosterFor(c).filter(op=>assembled.includes(op.id)).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.marksmanship-a.marksmanship);
const field=[...new Set([1,0,8,...candidates.map(op=>op.id)])].filter(id=>assembled.includes(id)).slice(0,5);
assert.equal(field.length,5,'keep five actual soldiers and a slot for the paid marksman');
order({type:'squad',ids:field});const main=c.activeSquadId;
const reserve=assembled.filter(id=>!field.includes(id));
for(let offset=0;offset<reserve.length;offset+=6)order({type:'createSquad',name:'Reserva de Cuyo',ids:reserve.slice(offset,offset+6),sector:'cordoba'});
order({type:'selectSquad',id:main});

// Budget care from actual wounds and carried dressings. A healthy party must
// not spend 450 pesos on a fixed bulk purchase before signing its defender.
const patients=assembled.filter(id=>{const r=c.operativeState[id];return r.alive&&(r.bleeding>0||r.hp<r.maxHp);});
for(const patientId of patients){
 const physician=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return assembled.includes(op.id)&&op.id!==patientId&&r.alive&&r.hp>=15&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical)[0];
 assert.ok(physician,'a living local physician must treat the actual Cuyo patient');
 const patient=c.operativeState[patientId],rate=doctorRate(physician);
 const treatments=Number(patient.bleeding>0)+Math.ceil((patient.maxHp-patient.hp)/rate);
 while(c.operativeState[physician.id].medkits<treatments)order({type:'purchaseMedicalSupplies',operativeId:physician.id,quantity:Math.min(20,treatments-c.operativeState[physician.id].medkits)});
 order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
 for(let i=0;i<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
}
c=sellSurplusEquipment(c,'cordoba',assembled,1400,{report});
report({event:'cuyoFunding',hour:c.hour,treasury:c.resources.treasury,availableGuns:sectorInventoryModel(c,'cordoba',rosterFor(c),assembled[0]).entries.filter(row=>JSON.parse(row.expected).weapon).length});
order({type:'recruitCivic',id:142,term:'day'});order({type:'purchaseAmmunition',ammoType:'rifle_62',quantity:12});
for(const id of c.squad){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));if(row&&![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}const type=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===type)){const count=Math.min(row.count,Math.max(0,10-availableAmmunition(c.operativeState[id],type)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}order({type:'assignCare',operativeId:id,assignment:'rest'});}
// The stronger northern route leaves a real Salta garrison. Withdraw it
// through the offered adjacent exit before the separate Córdoba defense.
const fieldSquad=c.activeSquadId;
assert.equal(c.contracts[142].term,'day');assert.ok(c.contracts[142].paid>0);
for(let i=0;i<24&&(c.pendingEncounter||c.enemyGroups.some(group=>['marching','waiting'].includes(group.status)&&group.target==='cordoba'));i++){
 if(c.pendingEncounter?.sector==='salta'){
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'retreat',destination:'tucuman'});
  order({type:'selectSquad',id:fieldSquad});
 }
 if(c.pendingEncounter)break;
 order({type:'wait',hours:1});
}
if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});}
 return c;
}

export function prepareFreshMendozaAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const veterans=[...c.squad],main=c.activeSquadId,columns=[main];
 // Northern victories can leave healthy veterans close to panic. Add a paid
 // fresh soldier and keep the actual veterans in a separate supporting column.
 const reinforcement=145,available=c.operativeState[reinforcement]?.alive&&!c.operativeState[reinforcement]?.captured&&!c.recruited.includes(reinforcement);
 if(available&&veterans.some(id=>c.operativeState[id].morale<30)){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===reinforcement),'day');
  c=sellSurplusEquipment(c,'cordoba',veterans,quote.price+70,{report,reserve:5});
  if(c.squad.length>=6){
   const field=c.squad.filter(id=>c.operativeState[id].morale>=50).slice(0,5);
   assert.ok(field.length,'a living ready soldier must lead the relief column');
   order({type:'squad',ids:field});
  }
  const cash=c.resources.treasury;order({type:'recruitCivic',id:reinforcement,term:'day'});
  assert.equal(c.resources.treasury,cash-quote.price);assert.ok(quote.price>0);
  const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),reinforcement);
  const gun=model().entries.filter(row=>row.reachable&&JSON.parse(row.expected).weapon===1800).sort((a,b)=>JSON.parse(b.expected).condition-JSON.parse(a.expected).condition)[0];
  assert.ok(gun,'the paid reinforcement needs an actual recovered long gun');
  order({type:'sectorInventory',sector:'cordoba',operativeId:reinforcement,direction:'take',sourceKey:gun.key,expected:gun.expected,count:1});
  const carried=model().carried.find(row=>row.expected&&JSON.parse(row.expected).weapon===1800);assert.ok(carried);
  order({type:'sectorInventory',sector:'cordoba',operativeId:reinforcement,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'primary'});
  const reserve=veterans.filter(id=>!c.squad.includes(id));
  if(reserve.length){order({type:'createSquad',name:'Apoyo de Mendoza',ids:reserve,sector:'cordoba'});columns.push(c.activeSquadId);}
  report({event:'mendozaPaidRelief',id:reinforcement,cost:quote.price,reserve,hour:c.hour});
 }
 const field=columns.flatMap(id=>c.squads.find(q=>q.id===id).members);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<24&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 for(const id of field){assert.equal(c.operativeState[id].energy,100);assert.equal(c.operativeState[id].fatigue,0);assert.equal(c.operativeState[id].asleep,false);}
 for(const id of columns){
  order({type:'selectSquad',id});
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});
  order({type:'attack',sector:'mendoza',queue:true,mode:'posta'});
 }
 for(let i=0;i<24&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');i++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));
 // Hold at the assembly point until the troops can approach in daylight.
 for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'mendoza'});
 assert.deepEqual(c.pendingBattle.squad.map(unit=>unit.id).sort((a,b)=>a-b),[...field].sort((a,b)=>a-b));
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export function startFreshFoundry(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const envoy=c.squad.find(id=>{const soldier=c.operativeState[id];return soldier.alive&&!soldier.captured&&soldier.hp>=15&&soldier.location==='mendoza';});
 assert.notEqual(envoy,undefined,'a living soldier in Mendoza must approach the recruits');
 c=meetRecruits(c,['beltran'],envoy);
 const resources=structuredClone(c.resources);order({type:'foundry'});
 assert.equal(c.resources.treasury,resources.treasury-500);assert.equal(c.resources.copper,resources.copper-20);
 order({type:'diplomacy',kind:'emancipation'});c=meetRecruits(c,['barcala'],envoy);
 const affordable=()=>Object.entries(RECIPES.cannon.cost).every(([key,value])=>c.resources[key]>=value);
 for(let h=0;h<48&&!affordable();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(affordable(),'territorial income must fund the first cannon');
 order({type:'produce',recipe:'cannon',sector:'mendoza'});
 const production=structuredClone(c.production.at(-1)),before=c.resources.cannons;
 for(let i=0;i<60&&c.production.some(p=>p.id===production.id);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.production.some(p=>p.id===production.id),false);assert.ok(c.hour>=production.due);
 assert.equal(c.resources.cannons,before+1);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshArmyProduction(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const local=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
const patients=local.filter(id=>{const r=c.operativeState[id];return r.bleeding>0||r.hp<r.maxHp;});
for(const patientId of patients){
 const physician=rosterFor(c).filter(op=>local.includes(op.id)&&op.id!==patientId&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];
 assert.ok(physician,'an actual local physician must provide foundry recovery');
 const patient=c.operativeState[patientId],required=Number(patient.bleeding>0)+Math.ceil((patient.maxHp-patient.hp)/doctorRate(physician));
 while(c.operativeState[physician.id].medkits<required)order({type:'purchaseMedicalSupplies',operativeId:physician.id,quantity:Math.min(20,required-c.operativeState[physician.id].medkits)});
 order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
 for(let h=0;h<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
}
for(const operativeId of local)order({type:'assignCare',operativeId,assignment:'rest'});
const waitFor=predicate=>{for(let i=0;i<80&&predicate();i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(predicate(),false);};
const produce=recipe=>{
 const affordable=()=>Object.entries(RECIPES[recipe].cost).every(([key,value])=>c.resources[key]>=value);
 // Production uses actual territorial income and material deliveries.
 for(let hour=0;!affordable()&&hour<80;hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(affordable(),`normal campaign production must fund ${recipe}`);
 order({type:'produce',recipe,sector:'mendoza'});
};
for(let i=0;i<3;i++)produce('muskets');
waitFor(()=>c.production.length>0);
produce('uniforms');const uniformId=c.production.at(-1).id;produce('cannon');waitFor(()=>c.production.some(p=>p.id===uniformId));produce('infantry');waitFor(()=>c.production.length>0);assert.equal(c.resources.infantry,200);assert.equal(c.resources.cannons,2);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Leave a trained local defense, then fund the full army through ordinary orders.
export function completeFreshArmyProduction(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const resolveNorthernDefense=()=>{
  if(c.pendingEncounter?.sector!=='tucuman')return;
  const selected=c.activeSquadId;
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'auto'});
  assert.equal(c.pendingBattle,null,'the ordinary automatic northern defense must settle');
  order({type:'selectSquad',id:selected});
 };

 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba',mode:'posta'});
 const before=structuredClone(c.resources);
 order({type:'militia',sector:'cordoba',trainerId:7,rank:0});
 assert.equal(c.resources.treasury,before.treasury-60);
 assert.equal(c.resources.muskets,before.muskets-5);
 for(let i=0;i<60&&c.militiaTraining.length;i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.militiaTraining.length,0);assert.equal(c.sectors.cordoba.militia[0],3);
const foundryWorkers=c.recruited.filter(id=>{const r=c.operativeState[id];return id!==7&&r.alive&&!r.captured&&r.location==='cordoba';}).slice(0,6);
assert.ok(foundryWorkers.includes(2),'the living founder must return to the foundry');
order({type:'createSquad',name:'Fundición de Mendoza',ids:foundryWorkers,sector:'cordoba'});
 order({type:'travel',sector:'mendoza',mode:'posta'});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<1500&&(c.resources.infantry<3000||c.resources.cannons<3);i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);
  const total=k=>c.resources[k]+c.production.reduce((sum,p)=>sum+(p.yield[k]??0),0);
  const affordable=r=>Object.entries(RECIPES[r].cost).every(([key,value])=>c.resources[key]>=value);
  const priorities=[
   ['cannon',total('cannons')<3],['infantry',total('infantry')<3000],
   ['muskets',total('infantry')<3000&&total('muskets')<200],
   ['uniforms',total('infantry')<3000&&total('uniforms')<200],['powder',c.resources.powder<5],
  ];
  const recipe=c.production.filter(p=>p.sector==='mendoza').length<3
   ?priorities.find(([id,needed])=>needed&&affordable(id))?.[0]:null;
  if(recipe){
   const paid=structuredClone(c.resources);order({type:'produce',recipe,sector:'mendoza'});
   for(const [key,value]of Object.entries(RECIPES[recipe].cost))assert.equal(c.resources[key],paid[key]-value);
  }else order({type:'wait',hours:1});
 }
 assert.equal(c.resources.infantry,3000);assert.equal(c.resources.cannons,3);
 assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.sectors.tucuman.owner,'royalist');
 assert.equal(c.squads.find(q=>q.members.includes(7)).location,'cordoba');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
