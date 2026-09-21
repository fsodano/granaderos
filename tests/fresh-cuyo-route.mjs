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
