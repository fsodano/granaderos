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
