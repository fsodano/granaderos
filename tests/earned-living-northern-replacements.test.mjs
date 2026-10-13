import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {livingNorthernReplacementPlan,hireLivingNorthernReplacements} from './created-living-northern-replacements.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const input=()=>{const stem='./fixtures/earned-living-northern-clinic',p=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),p.gzipSha256);assert.equal(sha(raw),p.rawSha256);assert.equal(raw.length,p.rawBytes);assert.equal(JSON.parse(raw).savedAt,p.savedAt);const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),p.campaignSha256);return {c,p};};

test('current actual willingness and owned-property admission quote a seven-person replacement force without treating wounded veterans as ready',()=>{
 const {c}=input(),before=structuredClone(c),p=livingNorthernReplacementPlan(c);
 assert.deepEqual(p.keepers,[57,101,107]);assert.deepEqual(p.field,[101,107]);assert.equal(p.fieldSize,7);assert.equal(p.destination,'tucuman');assert.deepEqual(p.candidates.map(r=>r.id),[130,142,106,147,118]);assert.equal(p.cost,226366);
 assert.deepEqual(p.quotes.map(r=>r.quote.price),[280,54180,57960,47880,66066]);assert.ok(p.retainedQuotes.every(r=>r.day.available&&r.week.available));assert.equal(p.retainedQuotes.find(r=>r.id===101).week.price,434);assert.equal(p.retainedQuotes.find(r=>r.id===107).week.price,826);
 assert.deepEqual(p.candidates.filter(r=>r.hp<r.maxHp).map(r=>r.id),[142,106,147]);assert.deepEqual(c,before);assert.throws(()=>livingNorthernReplacementPlan(c,{fieldSize:8}),/real willing living candidate/);
});

test('the complete actual weekly replacement booking pays every quote and admits five living recovered-property veterans while preserving wounds, finite stock and old survivors',t=>{
 const {c:start,p:proof}=input(),before=structuredClone(start),events=[],p=livingNorthernReplacementPlan(start);
 const c=hireLivingNorthernReplacements(start,{report:e=>{events.push(e);if(process.env.GRANADEROS_LIVING_NORTHERN_REPLACEMENTS_EVENTS)appendFileSync(process.env.GRANADEROS_LIVING_NORTHERN_REPLACEMENTS_EVENTS,JSON.stringify(e)+'\n');}});
 assert.deepEqual(start,before);assert.equal(c.resources.treasury,905968);assert.deepEqual(c.resources,{...start.resources,treasury:905968});assert.deepEqual([c.hour,c.secondOfHour],[4275,3290]);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.equal(c.blockade,true);
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),[...p.keepers,...p.candidates.map(r=>r.id)]);
 for(const id of p.keepers){assert.deepEqual(c.operativeState[id],start.operativeState[id]);assert.deepEqual(c.contracts[id],start.contracts[id]);}
 const hired=events.filter(e=>e.event==='livingNorthernReplacementHired');assert.equal(hired.length,5);
 for(const receipt of hired){const r=c.operativeState[receipt.id];assert.ok(r.alive&&!r.captured);assert.equal(r.location,'tucuman');assert.equal(r.hp,start.operativeState[receipt.id].hp);assert.equal(r.bleeding,0);assert.equal(r.medkits,0);assert.deepEqual(receipt.propertyBefore,receipt.propertyAfter);assert.equal(receipt.treasuryAfter,receipt.treasuryBefore-receipt.quote.total);assert.equal(receipt.startedSeconds,receipt.arrivedSeconds);assert.equal(contractExpiresSeconds(c.contracts[receipt.id]),(4275+168)*3600+3290);assert.equal(c.operativeState[receipt.id].serviceEquipmentReturn,undefined);}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}for(const id of proof.nativeDeaths)assert.equal(c.operativeState[id].hp,0);
 assert.deepEqual(c.sectorStates,start.sectorStates,'Booking must not debit, duplicate or replace any physical local source.');assert.deepEqual(c.sceneStates,start.sceneStates);assert.deepEqual(c.artilleryDepots,start.artilleryDepots);
 const official=encodeSave(c);assert.deepEqual(decodeSave(official).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Actual five weekly paid hires and admitted arrival only; clinical care, finite gear/readiness and next native request remain separate',inputRawSha:proof.rawSha256,originalKeepers:p.keepers,added:p.candidates.map(r=>r.id),field:p.fieldSize,cost:p.cost,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,wounded:p.candidates.filter(r=>r.hp<r.maxHp).map(r=>({id:r.id,hp:r.hp,maxHp:r.maxHp})),canonicalCampaignSha:sha(JSON.stringify(c))}));
 if(process.env.GRANADEROS_LIVING_NORTHERN_REPLACEMENTS_CAPTURE)writeFileSync(process.env.GRANADEROS_LIVING_NORTHERN_REPLACEMENTS_CAPTURE,official);
});
