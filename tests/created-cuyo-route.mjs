import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {fightNorthernSector} from './northern-route.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';

// Actual transport, shop care and defense preparation after fresh Yatasto.
export function assembleCreatedCuyo(start,{report=()=>{}}={}){
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
order({type:'createSquad',sector:'salta',ids:[9],name:'Enlace de Salta'});
c=meetRecruits(c,['guemes','macacha'],9);
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
// Bring the surviving northern reserve to the assembly point before paying
// for the elite's short contract. Every reinforcement travels normally.
const assemblySquad=c.activeSquadId,reinforcementSquads=[];
const elsewhere=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location!=='cordoba';});
for(const sector of new Set(elsewhere.map(id=>c.operativeState[id].location))){
 const ids=elsewhere.filter(id=>c.operativeState[id].location===sector);
 for(let offset=0;offset<ids.length;offset+=6){
  const members=ids.slice(offset,offset+6);order({type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector});
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  for(const id of members){
   const model=()=>sectorInventoryModel(c,sector,rosterFor(c),id);
   for(const row of model().entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
    let count=Math.min(row.count,20-c.operativeState[id].medkits);if(count<=0)break;
    while(count>0&&dispatchCampaign(c,{type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count}).lastError)count--;
    if(count)order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   }
  }
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
const donate=id=>{
 const sourceId=assembled.find(other=>other!==id&&c.operativeState[other].medkits>0&&!sectorInventoryModel(c,'cordoba',rosterFor(c),other).reason);
 if(sourceId){order({type:'sectorInventory',sector:'cordoba',operativeId:sourceId,direction:'drop',item:'medkits',count:1});const row=sectorInventoryModel(c,'cordoba',rosterFor(c),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});return true;}
 if(c.merchants.cordoba.supplies.medkits>0){order({type:'purchaseMedicalSupplies',operativeId:id,quantity:1});return true;}return false;
};
for(let h=0;h<144&&assembled.some(id=>c.operativeState[id].alive&&c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});c=fightNorthernSector(c,'cordoba',{controller:cautiousCombatOrder,report}).campaign;}
 const injured=assembled.filter(id=>c.operativeState[id].alive&&c.operativeState[id].hp<c.operativeState[id].maxHp);
 const docs=rosterFor(c).filter(op=>assembled.includes(op.id)&&c.operativeState[op.id].alive&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&op.medical>=20).sort((a,b)=>Number(injured.includes(a.id))-Number(injured.includes(b.id))||b.medical-a.medical).slice(0,Math.min(4,injured.length)).map(op=>op.id);
 for(const id of docs)if(!c.operativeState[id].medkits)donate(id);
 const supplied=new Set(docs.filter(id=>c.operativeState[id].medkits>0));
 for(const id of assembled)if(c.operativeState[id].alive){const assignment=supplied.has(id)?'doctor':injured.includes(id)?'patient':'rest';if(c.operativeState[id].assignment!==assignment)order({type:'assignCare',operativeId:id,assignment});}
 if(h%12===0)report({event:'createdCuyoCare',hour:c.hour,cash:c.resources.treasury,injured:injured.map(id=>[id,c.operativeState[id].hp]),doctors:[...supplied]});
 order({type:'wait',hours:1});
}
for(const id of assembled)if(c.operativeState[id].alive)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
return c;
}

// Reuse the living hospital survivors and pay available reinforcements. All
// guns and cartridges come from finite recovered equipment or the local shop.
export function prepareCreatedMendozaAssault(start){
let c=decodeSave(encodeSave(start)).campaign;
const field=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
const order=a=>{if(a.type==='wait')for(const id of field){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(c.lastError,null);}}c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const recruits=rosterFor(c).filter(o=>{const r=c.operativeState[o.id],q=contractQuote(c,o,'day');return o.id>=100&&o.id<1000&&!field.includes(o.id)&&r.alive&&r.hp===r.maxHp&&r.morale>=50&&q.available&&q.price<=30;}).map(o=>o.id);
for(const id of recruits){order({type:'recruitCivic',id,term:'week',destination:'cordoba'});field.push(id);}
for(let n=0;n<2;n++){for(let h=0;h<48&&!c.merchants.cordoba.stock.bronze4;h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:'bronze4'});}
order({type:'recruitCivic',id:142,term:'day',destination:'cordoba'});field.push(142);
for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
order({type:'configureArtillery',types:[]});
for(let offset=0;offset<field.length;offset+=6){order({type:'createSquad',name:'Columna de Cuyo',ids:field.slice(offset,offset+6),sector:'cordoba'});for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));c=supplyRouteAmmunition(c,c.squad,{target:12}).campaign;c=finishReloadsBeforeMarch(c);}
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue||c.operativeState[id].energy<100||c.operativeState[id].asleep));h++)order({type:'wait',hours:1});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'configureArtillery',types:['bronze4','bronze4']});

return prepareFinalAssault(c,{staging:'cordoba',target:'mendoza',fieldIds:field});
}
