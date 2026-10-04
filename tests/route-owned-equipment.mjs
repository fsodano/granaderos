import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {WEAPONS} from '../game/data.js';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord,applyItemQuantity} from '../game/tactical-inventory.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {order,saved} from './local-contract-fixture.mjs';

// Keep a serviceable primary unless replacement is explicitly requested.
// New equipment comes from this person's actual pockets or known local loot.
export function recoverRoutePrimary(start,operativeId,{preferredWeapon=1801,required=true,replace=false,report=()=>{}}={}){
 let campaign=structuredClone(start);const op=rosterFor(campaign).find(unit=>unit.id===operativeId),record=campaign.operativeState[operativeId];
 assert.ok(op&&campaign.recruited.includes(operativeId)&&record?.alive&&!record.captured,'The actual firearm recipient must be serving and alive.');
 const sector=operativeLocation(campaign,operativeId),model=()=>sectorInventoryModel(campaign,sector,rosterFor(campaign),operativeId);
 const primary=()=>model().personal;
 if(!record.weaponDropped&&WEAPONS[primary()?.weapon]?.capacity>0&&!replace)return saved({campaign}).campaign;
 const choices=()=>model().carried.filter(row=>row.expected&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0&&row.equip?.some(option=>option.slot==='primary'&&option.valid)).sort((a,b)=>Number(JSON.parse(b.expected).weapon===preferredWeapon)-Number(JSON.parse(a.expected).weapon===preferredWeapon));
 let gun=choices()[0],incoming;
 if(!gun){
  let available=model().entries.filter(row=>row.reachable&&row.count>0&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0).sort((a,b)=>Number(JSON.parse(b.expected).weapon===preferredWeapon)-Number(JSON.parse(a.expected).weapon===preferredWeapon));
  if(!available.length){campaign=discoverRouteCache(campaign,operativeId);available=model().entries.filter(row=>row.reachable&&row.count>0&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0).sort((a,b)=>Number(JSON.parse(b.expected).weapon===preferredWeapon)-Number(JSON.parse(a.expected).weapon===preferredWeapon));}
  const row=available.find(row=>{try{applyItemQuantity(primary(),{...JSON.parse(row.expected),count:1});return true;}catch{return false;}});
  if(row){
   const keys=new Set(Object.keys(primary().inventory??{}));incoming={...JSON.parse(row.expected),count:1};
   campaign=order(campaign,{type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   gun=choices().find(candidate=>!keys.has(candidate.inventoryKey));
   assert.ok(gun,'The actual recovered gun must have one identifiable carried record.');
  }
 }
 if(!gun){
  report({event:'finitePrimaryUnavailable',operativeId,sector,preferredWeapon});
  assert.ok(!required,`No actual reachable finite firearm or carrying room is available for ${operativeId} at ${sector}.`);
  return saved({campaign}).campaign;
 }
 incoming=JSON.parse(gun.expected);const money=campaign.resources.treasury;
 campaign=order(campaign,{type:'sectorInventory',sector,operativeId,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
 assert.equal(campaign.resources.treasury,money);
 const equipped=handRecord(primary(),'primary');
 for(const [key,value]of Object.entries(incoming))if(key!=='item')assert.deepEqual(equipped[key],value,`Recovered firearm must preserve ${key}.`);
 report({event:'finitePrimaryRecovered',operativeId,sector,weapon:equipped.weapon,instanceId:equipped.instanceId});
 return saved({campaign}).campaign;
}
