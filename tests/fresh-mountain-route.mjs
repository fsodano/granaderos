import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

// Normal funding, equipment, timed approaches and explicitly coordinated squads.
export function prepareFreshUspallataAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(7)).id});order({type:'assignCare',operativeId:7,assignment:'active'});order({type:'travel',sector:'mendoza',mode:'posta'});order({type:'diplomacy',kind:'parliament'});order({type:'fortify',sector:'mendoza'});
for(const operativeId of [2,7,8])order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<600&&c.resources.treasury<12000;i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
order({type:'produce',recipe:'powder',sector:'mendoza'});for(let i=0;i<24&&c.production.length;i++)order({type:'wait',hours:1});
for(const recipe of ['ammo_rifle_62','ammo_musket_69'])order({type:'produce',recipe,sector:'mendoza'});
for(let i=0;i<36&&(c.production.length||c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
for(const id of [105,128,109,132,145,106])order({type:'recruitCivic',id,term:'day'});
order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId:106,slot:'weapon',itemId:1801});
order({type:'squad',ids:[7,8,105,128,109,132]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo de la cordillera',ids:[145,106],sector:'mendoza'});const support=c.activeSquadId;
order({type:'purchaseMedicalSupplies',operativeId:8,quantity:15});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
order({type:'beginAssault',sector:'uspallata'});
 assert.equal(c.pendingBattle.squad.length,8);return c;
}

// Two salvaged dressings stabilize the actual critical survivors before relief.
export function recoverFreshUspallata(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
const row=sectorInventoryModel(c,'uspallata',rosterFor(c),7).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row);order({type:'sectorInventory',sector:'uspallata',operativeId:7,direction:'take',sourceKey:row.key,expected:row.expected,count:2});order({type:'assignCare',operativeId:7,assignment:'doctor'});for(const operativeId of [8,105])order({type:'assignCare',operativeId,assignment:'patient'});order({type:'wait',hours:1});
order({type:'wait',hours:1});
for(const id of [8,105]){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].bleeding,0);}
order({type:'selectSquad',id:c.squads.find(q=>q.members.includes(2)).id});order({type:'purchaseMedicalSupplies',operativeId:2,quantity:20});order({type:'assignCare',operativeId:2,assignment:'active'});order({type:'travel',sector:'uspallata',mode:'posta'});order({type:'assignCare',operativeId:2,assignment:'doctor'});order({type:'assignCare',operativeId:7,assignment:'patient'});order({type:'fortify',sector:'uspallata'});
for(let i=0;i<60&&[7,105].some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);i++){
 if(c.contracts[105].expiresAt-c.hour<=1)order({type:'renewContract',id:105,term:'day',expectedExpiresAt:c.contracts[105].expiresAt});
 if(c.operativeState[8].hp>=15&&c.operativeState[8].medkits&&c.operativeState[8].assignment!=='doctor')order({type:'assignCare',operativeId:8,assignment:'doctor'});
 if(c.operativeState[2].medkits===0&&c.operativeState[8].medkits===0)break;
 order({type:'wait',hours:1});
}
order({type:'squad',ids:[2,7,8,105]});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'mendoza',mode:'posta'});
order({type:'assignCare',operativeId:8,assignment:'patient'});order({type:'purchaseMedicalSupplies',operativeId:2,quantity:15});order({type:'assignCare',operativeId:2,assignment:'doctor'});
for(let i=0;i<24&&c.operativeState[8].hp<c.operativeState[8].maxHp;i++){if(c.contracts[105].expiresAt-c.hour<=1)order({type:'renewContract',id:105,term:'day',expectedExpiresAt:c.contracts[105].expiresAt});order({type:'wait',hours:1});}
 for(const id of [2,7,8,105]){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.equal(c.location,'mendoza');assert.equal(c.sectors.uspallata.fort,1);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Bank ordinary income before signing new contracts; wait for finite shop stock.
export function prepareFreshLosPatosAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<1200&&(c.resources.treasury<14000||c.hour%24<6||c.hour%24>10);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(let i=0;i<4;i++){for(let h=0;h<25&&!c.merchants.mendoza.stock['1801'];h++)order({type:'wait',hours:1});order({type:'purchaseEquipment',item:1801});}
for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
for(let h=0;h<24&&c.hour%24!==0;h++)order({type:'wait',hours:1});
for(const id of [105,147,143,118,138,135])order({type:'recruitCivic',id,term:'day'});
for(const operativeId of [147,118,138,135]){order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
order({type:'squad',ids:[7,8,105,147,143,118]});const main=c.activeSquadId;order({type:'createSquad',name:'Apoyo de Los Patos',ids:[138,135],sector:'mendoza'});const support=c.activeSquadId;
order({type:'purchaseMedicalSupplies',operativeId:135,quantity:15});order({type:'purchaseMedicalSupplies',operativeId:7,quantity:5});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'uspallata',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'los_patos',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'los_patos'});
 assert.equal(c.pendingBattle.squad.length,8);
 assert.ok(c.pendingBattle.squad.every(u=>u.entryEdge==='E'));
 return c;
}

export function completeFreshAndesPreparation(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'fortify',sector:'los_patos'});assert.equal(c.phase,4);
order({type:'renewContract',id:118,term:'day',expectedExpiresAt:c.contracts[118].expiresAt});
order({type:'assignCare',operativeId:2,assignment:'doctor'});order({type:'assignCare',operativeId:118,assignment:'patient'});
order({type:'squad',ids:[105,138]});order({type:'travel',sector:'mendoza',mode:'posta'});
order({type:'createSquad',name:'Mando de los Andes',ids:[2,118],sector:'mendoza'});
order({type:'purchaseMedicalSupplies',operativeId:2,quantity:10});
for(let i=0;i<18&&c.operativeState[118].hp<c.operativeState[118].maxHp;i++)order({type:'wait',hours:1});assert.equal(c.operativeState[118].hp,c.operativeState[118].maxHp);
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
c=meetRecruits(c,['san-martin'],118);assert.ok(c.recruited.includes(57));assert.equal(c.completed,false);
 for(const id of [105,138]){assert.ok(c.operativeState[id].alive);assert.ok(['los_patos','mendoza'].includes(c.operativeState[id].location));assert.equal(c.recruited.includes(id),false);}
 assert.equal(c.conversations['san-martin'].lastApproach,'recruit');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
