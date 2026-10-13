import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {recoverRouteBodywear} from './route-owned-bodywear.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0),living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured),longguns=[1800,1801,1802];
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);
const medical=(c,sector,id)=>sectorInventorySites(c,sector).flatMap(site=>sectorInventoryModel(c,site.id,rosterFor(c),id).entries.filter(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).item==='medkits').map(row=>({site:site.id,...row})));

// Quote only currently known, reachable physical equipment. Remaining wounds,
// full rest and any missing linen stay separate from this local stock phase.
export function livingNorthernEquipmentPlan(c,{commanderId=57,rounds=16,dressings=10}={}){
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.ok(Number.isSafeInteger(rounds)&&rounds>=16);assert.ok(Number.isSafeInteger(dressings)&&dressings>=10);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId),sector=c.operativeState[field[0]]?.location;
 assert.ok(keepers.includes(commanderId)&&field.length>=6&&field.length<=42);assert.equal(c.location,sector);assert.equal(c.sectors[sector].owner,'patriot');assert.ok(!c.enemyGroups.some(g=>g.target===sector&&['waiting','engaged','stationed'].includes(g.status)));
 for(const id of keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(r.hp>=15&&!r.bleeding);assert.ok(expiry===null||expiry>clock(c));if(id!==commanderId){assert.equal(r.location,sector);assert.equal(sectorInventoryModel(c,sector,rosterFor(c),id).reason,null);}}
 const needsPrimary=field.filter(id=>{const u=sectorInventoryModel(c,sector,rosterFor(c),id).personal;return u.weaponDropped||!longguns.includes(u.weapon);});
 const worn=field.flatMap(id=>['headwear','outfit','legwear'].filter(slot=>!(c.operativeState[id][slot]?.condition>0)).map(slot=>({id,slot}))),carried=field.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0),known=medical(c,sector,field[0]).reduce((sum,row)=>sum+row.count,0),target=field.length*dressings;
 return {commanderId,keepers,field,sector,rounds,dressings,needsPrimary,missingWear:worn,carriedDressings:carried,knownDressings:known,collectDressings:Math.min(known,Math.max(0,target-carried)),unprovedDressings:Math.max(0,target-carried-known),patients:field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp)};
}

export function recoverLivingNorthernEquipment(start,{report=()=>{},...options}={}){
 const before=structuredClone(start),plan=livingNorthernEquipmentPlan(start,options),oldGuns=guns(start),oldClock=clock(start),oldCash=start.resources.treasury;
 let c=decodeSave(encodeSave(start)).campaign,phase='known-longguns';const receipts=[],emit=e=>receipts.push(e);
 const safe=()=>{assert.deepEqual(living(c),plan.keepers);assert.equal(clock(c),oldClock);assert.equal(c.resources.treasury,oldCash);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.deepEqual(guns(c),oldGuns);for(const id of plan.keepers){const r=c.operativeState[id],old=start.operativeState[id];for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','asleep','location'])assert.deepEqual(r[key],old[key],`Equipment must preserve actual ${id} ${key}.`);}for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}};
 const adopt=(name,transform)=>{const receipts=[],next=transform(c,e=>receipts.push(e));c=next;safe();for(const e of receipts)emit(e);emit({event:'livingNorthernEquipmentAdopted',phase,name,hour:c.hour,second:c.secondOfHour??0});};
 const issue=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;safe();emit({event:'livingNorthernEquipmentOrder',phase,action,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury});};
 try{
  for(const id of plan.needsPrimary){const model=sectorInventoryModel(c,plan.sector,rosterFor(c),id),preferred=[1801,1800,1802].find(weapon=>model.entries.some(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).weapon===weapon));assert.ok(preferred,'A real known local long gun must exist before its pickup.');adopt('finite local primary',(input,r)=>recoverRoutePrimary(input,id,{preferredWeapon:preferred,strictPreference:true,replace:true,report:r}));assert.ok(longguns.includes(carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]).weapon));}
  phase='known-protection';adopt('finite local worn protection',(input,r)=>recoverRouteBodywear(input,plan.field,{report:r}));
  phase='known-ammunition';adopt('finite local sixteen rounds',(input,r)=>supplyRouteAmmunition(input,plan.field,{target:plan.rounds,report:r}).campaign);
  phase='known-dressings';let collected=0;
  for(const id of plan.field)while(collected<plan.collectDressings&&(c.operativeState[id].medkits??0)<plan.dressings){const row=medical(c,plan.sector,id)[0];assert.ok(row,'The quoted known dressing stock must still be reachable.');const model=sectorInventoryModel(c,row.site,rosterFor(c),id),poolBefore=medical(c,plan.sector,id).reduce((sum,row)=>sum+row.count,0),carried=c.operativeState[id].medkits??0;let count=Math.min(row.count,plan.dressings-carried,plan.collectDressings-collected);while(count>0){try{applyItemQuantity(model.personal,{...JSON.parse(row.expected),count});break;}catch{count--;}}assert.ok(count,'The real carrier needs room for the quoted known linen.');issue({type:'sectorInventory',sector:row.site,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.operativeState[id].medkits,carried+count);assert.equal(medical(c,plan.sector,id).reduce((sum,row)=>sum+row.count,0),poolBefore-count);collected+=count;emit({event:'livingNorthernKnownDressings',id,sourceKey:row.key,expected:row.expected,count,poolBefore,poolAfter:poolBefore-count});}
  assert.equal(collected,plan.collectDressings);const carried=plan.field.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);assert.equal(carried,plan.carriedDressings+collected);
  for(const id of plan.field){const r=c.operativeState[id],u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),r);assert.ok(longguns.includes(u.weapon)&&u.loaded+ammoCount(u)>=plan.rounds);for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);}
  safe();assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);emit({event:'livingNorthernLocalEquipmentComplete',plan,collected,carriedDressings:carried,remainingDressings:Math.max(0,plan.field.length*plan.dressings-carried),campaign:structuredClone(c),scope:'Known finite local equipment only; remaining linen, wounds, loaded activation, paid rest and next request remain separate.'});for(const receipt of receipts)report(receipt);return c;
 }catch(error){assert.deepEqual(start,before);report({event:'livingNorthernEquipmentStopped',phase,reason:error.message,attemptReports:receipts,input:structuredClone(start),lastObservedCampaign:structuredClone(c),scope:'Failure evidence only; no returned or adopted campaign.'});throw error;}
}
