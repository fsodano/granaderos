import {RECIPES} from '../game/data.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';

// Actual transport, shop care and defense preparation after fresh Yatasto.
export function prepareFreshCuyoDefense(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
order({type:'purchaseMedicalSupplies',operativeId:8,quantity:15});order({type:'assignCare',operativeId:8,assignment:'doctor'});order({type:'assignCare',operativeId:1,assignment:'patient'});
for(let i=0;i<24&&c.operativeState[1].hp<c.operativeState[1].maxHp;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(c.operativeState[1].hp,c.operativeState[1].maxHp);
order({type:'recruitCivic',id:142,term:'day'});order({type:'purchaseAmmunition',ammoType:'rifle_62',quantity:12});
for(const id of c.squad){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));if(row&&![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}const type=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===type)){const count=Math.min(row.count,Math.max(0,10-availableAmmunition(c.operativeState[id],type)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}order({type:'assignCare',operativeId:id,assignment:'rest'});}
for(let i=0;i<24&&!c.pendingEncounter;i++)order({type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');
order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});assert.equal(c.contracts[142].term,'day');assert.ok(c.contracts[142].paid>0);
 return c;
}

export function prepareFreshMendozaAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'attack',sector:'mendoza',queue:true,mode:'posta'});
 for(let i=0;i<12&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';i++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'mendoza'});return c;
}

export function startFreshFoundry(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 c=meetRecruits(c,['beltran'],8);
 const resources=structuredClone(c.resources);order({type:'foundry'});
 assert.equal(c.resources.treasury,resources.treasury-500);assert.equal(c.resources.copper,resources.copper-20);
 order({type:'diplomacy',kind:'emancipation'});c=meetRecruits(c,['barcala'],8);
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
order({type:'purchaseMedicalSupplies',operativeId:2,quantity:10});order({type:'assignCare',operativeId:2,assignment:'doctor'});order({type:'assignCare',operativeId:8,assignment:'patient'});order({type:'assignCare',operativeId:7,assignment:'rest'});for(let i=0;i<30&&c.operativeState[8].hp<c.operativeState[8].maxHp;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(c.operativeState[8].hp,c.operativeState[8].maxHp);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
const waitFor=predicate=>{for(let i=0;i<80&&predicate();i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.equal(predicate(),false);};
for(let i=0;i<3;i++)order({type:'produce',recipe:'muskets',sector:'mendoza'});waitFor(()=>c.production.length>0);
order({type:'produce',recipe:'uniforms',sector:'mendoza'});const uniformId=c.production.at(-1).id;order({type:'produce',recipe:'cannon',sector:'mendoza'});waitFor(()=>c.production.some(p=>p.id===uniformId));order({type:'produce',recipe:'infantry',sector:'mendoza'});waitFor(()=>c.production.length>0);assert.equal(c.resources.infantry,200);assert.equal(c.resources.cannons,2);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Leave a trained local defense, then fund the full army through ordinary orders.
export function completeFreshArmyProduction(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba',mode:'posta'});
 const before=structuredClone(c.resources);
 order({type:'militia',sector:'cordoba',trainerId:7,rank:0});
 assert.equal(c.resources.treasury,before.treasury-60);
 assert.equal(c.resources.muskets,before.muskets-5);
 for(let i=0;i<60&&c.militiaTraining.length;i++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.militiaTraining.length,0);assert.equal(c.sectors.cordoba.militia[0],3);
 order({type:'createSquad',name:'Fundición de Mendoza',ids:[2,8],sector:'cordoba'});
 order({type:'travel',sector:'mendoza',mode:'posta'});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<1500&&(c.resources.infantry<3000||c.resources.cannons<3);i++){
  assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);
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
