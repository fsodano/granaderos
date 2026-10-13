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
import {prepareGarrison,returnGarrison} from '../game/garrison.js';
import {createBattle} from '../game/tactical.js';
import {prepareStockMendozaAmmunition,stockAmmunitionLedger} from './created-cuyo-route.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=()=>{
 const stem='./fixtures/earned-mendoza-ammunition-service-return',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(raw),proof.rawSha256);assert.equal(sha(packed),proof.gzipSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);
 const campaign=decodeSave(raw.toString()).campaign;assert.deepEqual([campaign.hour,campaign.secondOfHour],proof.clock);return{campaign,proof};
};
const ground=(c,id)=>c.sectorStates.cordoba.groundItems.find(row=>row.id===id);
const physicalTotal={musket_75:989,rifle_62:208,pistol_69:303,shot_16:176};

test('an actual expired contractor owns returned stacks while his old living scene copy is only history',()=>{
 const{campaign:c,proof}=fixture(),before=structuredClone(c),r=c.operativeState[133],old=c.sectorStates.cordoba.units.find(u=>u.id==='133');
 assert.equal(r.alive,true);assert.equal(r.hp,91);assert.equal(c.recruited.includes(133),false);assert.equal(c.contracts[133],undefined);
 assert.deepEqual(unitAmmunitionByType(carriedAmmunition(rosterFor(c).find(op=>op.id===133),r)),{});
 assert.equal(old.hp,40);assert.deepEqual(unitAmmunitionByType(old),{musket_75:7,pistol_69:9});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-0')),{musket_75:1});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-5')),{pistol_69:9});
 assert.deepEqual(stackAmmunitionByType(ground(c,'service-return-2-6')),{musket_75:6});
 assert.ok(['service-return-2-0','service-return-2-5','service-return-2-6'].every(id=>ground(c,id).knownToPlayer));
 const ally=c.missionAllies.san_lorenzo,oldAlly=c.sectorStates.san_lorenzo.units.find(u=>u.id==='57');
 assert.equal(ally.id,oldAlly.id);assert.equal(ally.id,'57');assert.equal(ally.missionAlly,true);assert.equal(ally.contentId,'person-57');
 assert.deepEqual(unitAmmunitionByType(ally),{pistol_69:2});assert.deepEqual(unitAmmunitionByType(oldAlly),{pistol_69:2});
 assert.deepEqual(proof.physicalLedgerBeforeAfter,physicalTotal);
 for(const mirror of proof.excludedLivingSceneMirrors){const unit=c.sectorStates[mirror.sector].units.find(u=>u.id===mirror.unitId),record=c.operativeState[mirror.unitId];assert.equal(unit.side,'player');assert.ok(unit.hp>0);assert.equal(record.alive,mirror.globalAlive);assert.equal(c.recruited.includes(Number(unit.id)),false);assert.deepEqual(unitAmmunitionByType(unit),mirror.counts);}
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
 assert.deepEqual(c.missionAllies,start.missionAllies,'the real retained ally keeps its exact identity, physical gear and charges');
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
 const missingAllyCharge=structuredClone(start);missingAllyCharge.missionAllies.san_lorenzo.loaded--;
 assert.deepEqual(stockAmmunitionLedger(missingAllyCharge),{...physicalTotal,pistol_69:physicalTotal.pistol_69-1},'the retained mission ally remains an authoritative owner despite its old scene copy');
 const missingCorpseCharge=structuredClone(start),body=missingCorpseCharge.sectorStates.san_lorenzo.units.find(u=>u.id==='110');
 assert.equal(body.side,'player');assert.equal(body.hp,0);assert.equal(start.operativeState[110].alive,false);assert.equal(body.loaded,1);body.loaded--;
 assert.deepEqual(stockAmmunitionLedger(missingCorpseCharge),{...physicalTotal,musket_75:physicalTotal.musket_75-1},'a real dead operative body remains a physical owner even with a global record');
 assert.deepEqual(start,before);
});

test('a living scene-only player unit without a global or retained owner keeps its actual ammunition',()=>{
 // This is an ownership-model control, not a campaign victory or funded route.
 const militiaModel={sectors:{cordoba:{owner:'patriot',militia:[1,0,0]}}},[issued]=prepareGarrison(militiaModel,'cordoba');
 const scene=createBattle([{...issued,x:2,y:2}],{width:12,height:8,enemies:[]}),unit=scene.units[0];
 const c={recruited:[],operativeState:{},sectorStates:{cordoba:scene},sceneStates:{},ammunitionStores:{}};
 assert.equal(unit.side,'player');assert.ok(unit.hp>0&&unit.militia);assert.equal(Object.hasOwn(c.operativeState,unit.id),false);
 const counts=unitAmmunitionByType(unit),expected={musket_75:0,rifle_62:0,pistol_69:0,shot_16:0,...counts};assert.ok(Object.values(counts).some(n=>n>0));
 assert.deepEqual(stockAmmunitionLedger(c),expected);
 const corrupted=structuredClone(c);corrupted.sectorStates.cordoba.units[0].loaded--;
 const family=Object.keys(stackAmmunitionByType(unit))[0];assert.ok(family);
 assert.deepEqual(stockAmmunitionLedger(corrupted),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(corrupted),expected),'a sole scene owner cannot be excluded as operative history');
});

test('retained garrison records own rounds once and a dead garrison body keeps its remaining rounds',()=>{
 // Exercise the real garrison issue/return data model. This does not claim a
 // native battle, a militia casualty or a funded campaign outcome.
 const c={sectors:{cordoba:{owner:'patriot',militia:[2,0,0]}},recruited:[],operativeState:{},sectorStates:{},sceneStates:{},ammunitionStores:{},log:[],hour:0};
 const issued=prepareGarrison(c,'cordoba'),scene=createBattle(issued.map((u,i)=>({...u,x:2+i,y:2})),{width:12,height:8,enemies:[]});
 const request={sector:'cordoba',garrison:issued};returnGarrison(c,request,scene);c.sectorStates.cordoba=scene;
 assert.deepEqual(c.garrisons.cordoba.map(u=>String(u.id)),scene.units.map(u=>u.id));assert.ok(c.garrisons.cordoba.every(u=>u.hp>0&&u.militia));
 const expected={musket_75:0,rifle_62:0,pistol_69:0,shot_16:0};
 for(const u of c.garrisons.cordoba)for(const[type,n]of Object.entries(unitAmmunitionByType(u)))expected[type]+=n;
 const family=Object.keys(stackAmmunitionByType(c.garrisons.cordoba[0]))[0];assert.ok(family&&expected[family]>0);assert.deepEqual(stockAmmunitionLedger(c),expected,'the live scene cannot issue another copy of retained garrison rounds');
 const oldMirror=structuredClone(c);oldMirror.sectorStates.cordoba.units[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(oldMirror),expected,'retained garrison gear is authoritative over an old living scene copy');
 const lost=structuredClone(c);lost.garrisons.cordoba[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(lost),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(lost),expected),'a missing retained garrison charge must fail conservation');
 const withBody=structuredClone(c);withBody.sectorStates.cordoba.units[0].hp=0;returnGarrison(withBody,request,withBody.sectorStates.cordoba);
 assert.equal(withBody.garrisons.cordoba.length,1);assert.equal(withBody.garrisons.cordoba[0].id,issued[1].id);
 assert.equal(withBody.sectorStates.cordoba.units[0].id,String(issued[0].id));assert.deepEqual(stockAmmunitionLedger(withBody),expected,'the removed garrison record does not erase the real body ammunition');
 withBody.sectorStates.cordoba.units[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(withBody),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(withBody),expected),'a missing corpse charge must fail conservation');
});
