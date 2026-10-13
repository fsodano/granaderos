import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount,ammoTypeFor} from '../game/ammo-types.js';
import {unitAmmunitionByType,stackAmmunitionByType} from '../game/physical-ammunition.js';
import {prepareStockMendozaAmmunition,stockAmmunitionLedger} from './created-cuyo-route.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=()=>{
 const stem='./fixtures/earned-mendoza-ammunition-service-return',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(raw),proof.rawSha256);assert.equal(sha(packed),proof.gzipSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);
 const campaign=decodeSave(raw.toString()).campaign;assert.deepEqual([campaign.hour,campaign.secondOfHour],proof.clock);return{campaign,proof};
};
const ground=(c,id)=>c.sectorStates.cordoba.groundItems.find(row=>row.id===id);
const physicalTotal={musket_75:989,rifle_62:208,pistol_69:301,shot_16:176};

test('an actual expired contractor owns returned stacks while his old living scene copy is only history',()=>{
 const{campaign:c}=fixture(),before=structuredClone(c),r=c.operativeState[133],old=c.sectorStates.cordoba.units.find(u=>u.id==='133');
 assert.equal(r.alive,true);assert.equal(r.hp,91);assert.equal(c.recruited.includes(133),false);assert.equal(c.contracts[133],undefined);
 assert.deepEqual(unitAmmunitionByType(carriedAmmunition(rosterFor(c).find(op=>op.id===133),r)),{});
 assert.equal(old.hp,40);assert.deepEqual(unitAmmunitionByType(old),{musket_75:7,pistol_69:9});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-0')),{musket_75:1});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-5')),{pistol_69:9});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-6')),{musket_75:6});
 assert.ok(['service-return-2-0','service-return-2-5','service-return-2-6'].every(id=>ground(c,id).knownToPlayer));
 assert.deepEqual(stockAmmunitionLedger(c),physicalTotal);
 const withoutHistory=structuredClone(c);withoutHistory.sectorStates.cordoba.units=withoutHistory.sectorStates.cordoba.units.filter(u=>u.id!=='133');
 assert.deepEqual(stockAmmunitionLedger(withoutHistory),physicalTotal,'discarding the old scene copy cannot discard its real returned ammunition');
 assert.deepEqual(c,before);
});

test('the complete actual allocation reloads nineteen soldiers and conserves returned and corpse rounds through ordinary orders',t=>{
 const{campaign:start,proof}=fixture(),before=structuredClone(start),events=[],c=prepareStockMendozaAmmunition(start,proof.field,{report:e=>events.push(structuredClone(e))});
 const audit=events.find(e=>e.event==='stockCuyoAmmoConservation');assert.ok(audit);assert.deepEqual(audit.beforeLedger,physicalTotal);assert.deepEqual(audit.afterLedger,physicalTotal);
 assert.equal(proof.target,12);assert.equal(proof.field.length,19);assert.deepEqual([c.hour,c.secondOfHour],[572,471]);
 assert.equal(events.filter(e=>e.event==='stockCuyoCourierTravel').length,0,'the admitted local stock needs no new courier or expiry premise');
 const picked=events.filter(e=>e.event==='stockCuyoAmmoPickup'&&e.sourceKey==='ground:service-return-2-6');
 assert.deepEqual(picked.map(e=>[e.id,e.quantity]),[[146,3],[125,2],[144,1]]);
 for(const e of picked){assert.equal(e.family,'ammoMusket');assert.equal(e.sourceFamilyBefore-e.sourceFamilyAfter,e.quantity);}
 assert.equal(ground(c,'service-return-2-6').count,0);assert.deepEqual(ground(c,'service-return-2-0'),ground(start,'service-return-2-0'));assert.deepEqual(ground(c,'service-return-2-5'),ground(start,'service-return-2-5'));
 assert.equal(c.sectorStates.cordoba.units.some(u=>u.id==='133'),false);assert.deepEqual(c.operativeState[133],start.operativeState[133]);
 assert.deepEqual(c.recruited,start.recruited);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 for(const id of proof.field){const op=rosterFor(c).find(o=>o.id===id),u=carriedAmmunition(op,c.operativeState[id]);assert.ok(u.loaded>0&&!u.jammed);assert.ok(u.loaded+ammoCount(u,ammoTypeFor(u))>=12);for(const key of ['hp','maxHp','bleeding','medkits','headwear','outfit','legwear'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(stockAmmunitionLedger(c),stockAmmunitionLedger(start));assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:proof.scope,field:19,target:12,seconds:5,originalDuplicate:proof.duplicateSceneOwner.counts,physicalTotal,roundsFromReturnedStack:6,recipients:picked.map(e=>[e.id,e.quantity]),officialSaveRoundTrip:true}));
});

test('the ownership oracle still detects a real missing returned round and a missing loaded charge',()=>{
 const{campaign:start}=fixture(),before=structuredClone(start);
 for(const[id,family,field]of[['service-return-2-5','pistol_69','count'],['service-return-2-0','musket_75','loaded']]){
  const corrupted=structuredClone(start);ground(corrupted,id)[field]--;
  const expected={...physicalTotal,[family]:physicalTotal[family]-1};assert.deepEqual(stockAmmunitionLedger(corrupted),expected);
  assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(corrupted),physicalTotal),'a true one-round loss must still fail strict conservation');
 }
 assert.deepEqual(start,before);
});
