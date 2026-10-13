import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount,ammoTypeFor} from '../game/ammo-types.js';
import {livingNorthernEquipmentPlan,recoverLivingNorthernEquipment} from './created-living-northern-equipment.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const input=()=>{const stem='./fixtures/earned-living-northern-replacements',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.campaignSha256);return {c,proof};};
const rows=c=>sectorInventoryModel(c,'tucuman',rosterFor(c),101).entries.map(row=>({...JSON.parse(row.expected),count:row.count}));
const localMusketRounds=c=>{const roster=rosterFor(c),field=livingNorthernEquipmentPlan(c).field;return rows(c).reduce((sum,row)=>sum+(row.ammoType==='musket_75'?row.count:0)+(row.weapon&&ammoTypeFor(row)==='ammoMusket'?(row.loaded??0)*row.count:0),0)+field.reduce((sum,id)=>{const r=c.operativeState[id],u=carriedAmmunition(roster.find(op=>op.id===id),r);return sum+ammoCount(u,'ammoMusket')+(ammoTypeFor(u)==='ammoMusket'?u.loaded:0)+Object.values(r.inventory??{}).reduce((n,row)=>n+(row.weapon&&ammoTypeFor(row)==='ammoMusket'?(row.loaded??0)*row.count:0),0);},0);};

test('the actual paid northern replacement force quotes only known local equipment and retains its real wound and linen deficits',()=>{
 const {c}=input(),before=structuredClone(c),p=livingNorthernEquipmentPlan(c);
 assert.deepEqual(p.keepers,[57,101,107,130,142,106,147,118]);assert.deepEqual(p.field,[101,107,130,142,106,147,118]);assert.deepEqual(p.needsPrimary,[130,142,106,147,118]);assert.equal(p.missingWear.length,15);assert.deepEqual(p.patients,[142,106,147]);assert.equal(p.sector,'tucuman');assert.equal(p.rounds,16);assert.equal(p.dressings,10);assert.equal(p.carriedDressings,7);assert.equal(p.knownDressings,45);assert.equal(p.collectDressings,45);assert.equal(p.unprovedDressings,18);assert.deepEqual(c,before);
});

test('the complete current known equipment phase debits physical long guns, clothing, rounds and45 dressings without changing wounds, time, service or enemy schedule',t=>{
 const {c:start,proof}=input(),before=structuredClone(start),p=livingNorthernEquipmentPlan(start),events=[],oldRows=rows(start),oldRounds=localMusketRounds(start);
 const c=recoverLivingNorthernEquipment(start,{report:e=>{events.push(e);if(process.env.GRANADEROS_LIVING_NORTHERN_EQUIPMENT_EVENTS)appendFileSync(process.env.GRANADEROS_LIVING_NORTHERN_EQUIPMENT_EVENTS,JSON.stringify(e)+'\n');}});
 assert.deepEqual(start,before);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[4275,3290,905968]);assert.deepEqual(c.resources,start.resources);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.equal(c.blockade,true);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const id of p.keepers){const r=c.operativeState[id],old=start.operativeState[id];for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','asleep','location'])assert.deepEqual(r[key],old[key]);}for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}for(const id of proof.nativeDeaths)assert.equal(c.operativeState[id].hp,0);
 const remaining=rows(c),count=(list,predicate)=>list.filter(predicate).reduce((sum,row)=>sum+row.count,0);
 assert.equal(count(oldRows,r=>[1800,1801,1802].includes(r.weapon))-count(remaining,r=>[1800,1801,1802].includes(r.weapon)),5);for(const outfit of ['hat','poncho','trousers'])assert.equal(count(oldRows,r=>r.kind==='outfit'&&r.outfit===outfit)-count(remaining,r=>r.kind==='outfit'&&r.outfit===outfit),5);
 assert.equal(localMusketRounds(c),oldRounds,'Real loose and loaded musket charges keep the same physical total.');assert.equal(count(remaining,r=>r.item==='medkits'),0);assert.equal(p.field.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),52);assert.equal(events.filter(e=>e.event==='livingNorthernKnownDressings').reduce((sum,e)=>sum+e.count,0),45);
 for(const id of p.field){const r=c.operativeState[id],u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),r);assert.ok([1800,1801,1802].includes(u.weapon));assert.equal(u.loaded+ammoCount(u),16);for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);}assert.deepEqual(c.operativeState[57],start.operativeState[57]);
 for(const [sector,state]of Object.entries(start.sectorStates))if(sector!=='tucuman')assert.deepEqual(c.sectorStates[sector],state);assert.deepEqual(c.sceneStates,start.sceneStates);assert.deepEqual(c.artilleryDepots,start.artilleryDepots);
 const official=encodeSave(c);assert.deepEqual(decodeSave(official).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Known finite equipment only; three real wounds and18 missing dressings remain, with no loaded/activation/rest/request claim',inputRawSha:proof.rawSha256,keepers:p.keepers,knownLongguns:5,wornPieces:15,fieldRounds:112,collectedDressings:45,carriedDressings:52,remainingDressings:18,wounded:p.patients.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp})),clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,canonicalCampaignSha:sha(JSON.stringify(c))}));
 if(process.env.GRANADEROS_LIVING_NORTHERN_EQUIPMENT_CAPTURE)writeFileSync(process.env.GRANADEROS_LIVING_NORTHERN_EQUIPMENT_CAPTURE,official);
});
