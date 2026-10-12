import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {recoverNorthernLocalPatients} from './fresh-northern-fixture.mjs';

test('earned northern care uses real passive rest after its actual dressings are exhausted',()=>{
 const base='./fixtures/earned-convoy-tucuman-stable-care',proof=JSON.parse(readFileSync(new URL(base+'.provenance.json',import.meta.url),'utf8'));
 const raw=gunzipSync(readFileSync(new URL(base+'.campaign.json.gz',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const start=decodeSave(encodeSave(JSON.parse(raw))).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[1457,1310]);
 const campaign=recoverNorthernLocalPatients(start,{report:event=>events.push(event)});
 const rest=events.find(event=>event.event==='stableRouteRestFinished'),care=events.find(event=>event.event==='northernLocalCare');
 assert.ok(rest&&care);assert.equal(rest.completed,true);assert.equal(rest.hours,59);assert.equal(rest.boundHours,60);assert.equal(rest.dressingsUsed,0);
 assert.equal(care.dressingsUsed,0);assert.deepEqual(care.transfers,[]);assert.deepEqual(care.defenses,[]);
 assert.deepEqual([campaign.hour,campaign.secondOfHour],[1516,1310]);assert.equal(campaign.resources.treasury,start.resources.treasury+24000);
 for(const id of [110,134]){assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);assert.equal(campaign.operativeState[id].bleeding,0);}
 for(const [id,record]of Object.entries(start.operativeState)){
  assert.equal(campaign.operativeState[id].alive,record.alive);assert.equal(campaign.operativeState[id].medkits,record.medkits);
  assert.deepEqual(campaign.operativeState[id].inventory,record.inventory);
 }
 assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.sectorStates,start.sectorStates);assert.deepEqual(campaign.artilleryTransfers,start.artilleryTransfers);
 assert.deepEqual(campaign.loadouts,start.loadouts);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
});
