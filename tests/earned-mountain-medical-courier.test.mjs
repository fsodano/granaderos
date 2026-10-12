import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dailyTownIncome} from '../game/town-income.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the earned mountain clinic uses its unlocked posta and four existing Retiro dressings at actual renewal prices',t=>{
 const name='earned-installed-mountain-medical-courier';
 const metadata=JSON.parse(fixture(`${name}.provenance.json`)),compressed=fixture(`${name}.campaign.json.gz`),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(sha(raw),metadata.rawSha256);assert.equal(raw.length,metadata.rawBytes);
 const input=JSON.parse(raw),before=structuredClone(input),start=decodeSave(encodeSave(input)).campaign;
 assert.deepEqual(input,before);assert.deepEqual(start,input);
 const events=[],result=collectRouteMedicalSupplies(start,metadata.physicianId,metadata.neededDressings,{mode:'posta',report:event=>events.push(event)}),end=result.campaign;
 const receipt=events.find(event=>event.event==='finiteMedicalCourier');
 assert.equal(result.collected,4);assert.equal(receipt.source,'retiro');assert.equal(receipt.mode,'posta');
 assert.equal(receipt.outward.valid,true);assert.equal(receipt.returning.valid,true);
 assert.ok(receipt.outward.path.every(id=>start.sectors[id]?.owner==='patriot'));
 assert.deepEqual([end.hour,end.secondOfHour],[1634,1397]);assert.equal(receipt.elapsedSeconds,20*3600);
 assert.equal(end.resources.treasury,142190);
 const renewals=events.filter(event=>event.event==='medicalCourierRenewal'),cost=renewals.reduce((sum,event)=>sum+event.cost,0);
 const travelCost=(receipt.outward.path.length+receipt.returning.path.length-2)*10;
 assert.equal(cost,30660);assert.equal(travelCost,60);assert.equal(dailyTownIncome(start),8000);
 assert.equal(end.townIncome.lastPaidDay,start.townIncome.lastPaidDay+1);
 assert.equal(end.resources.treasury,start.resources.treasury-cost-travelCost+dailyTownIncome(start));
 const kits=c=>c.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.find(item=>item.item==='medkits').count;
 assert.equal(kits(start),11);assert.equal(kits(end),7);
 assert.equal(end.operativeState[112].medkits,start.operativeState[112].medkits+4);
 assert.deepEqual(end.loadouts,start.loadouts);assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(end.squad,start.squad);
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive)){
  assert.ok(end.recruited.includes(id));assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,start.operativeState[id].location);
  const expiry=contractExpiresSeconds(end.contracts[id]);assert.ok(expiry===null||expiry>end.hour*3600+end.secondOfHour);
  if(id!==112)assert.equal(end.operativeState[id].medkits,start.operativeState[id].medkits);
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(end.operativeState[id].alive,false);
 assert.equal(end.operativeState[134].bleeding,0);assert.ok(end.operativeState[134].hp<end.operativeState[134].maxHp,'ordinary rest does not grant full recovery');
 assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({source:receipt.source,mode:receipt.mode,outward:receipt.outward.hours,returning:receipt.returning.hours,elapsedSeconds:receipt.elapsedSeconds,renewalCost:cost,travelCost,sourceBefore:11,sourceAfter:7,inputSha256:metadata.rawSha256,scope:metadata.scope}));
});
