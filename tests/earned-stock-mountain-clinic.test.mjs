import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {recoverFreshUspallata} from './fresh-mountain-route.mjs';

test('actual stock Uspallata survivors finish finite full-health recovery without cycling their physicians sole dressing',t=>{
 const name='earned-stock-uspallata-before-clinic',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url)),meta=JSON.parse(fixture('provenance.json')),gzip=fixture('save.json.gz'),raw=gunzipSync(gzip),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(gzip),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],doctors=[146,107,122,116],survivors=[127,139,128,105,145,147,109],preparedDoctors=new Set();
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);assert.equal(start.operativeState[139].hp,1);
 const result=recoverFreshUspallata(start,{report:event=>{
  const {campaign,battle,...receipt}=event;events.push(receipt);
  if(event.event==='freshRouteOrder'&&event.action.type==='assignCare'&&event.action.assignment==='doctor'&&doctors.includes(event.action.operativeId)){
   preparedDoctors.add(event.action.operativeId);
   for(const id of preparedDoctors)assert.ok(campaign.operativeState[id].medkits>=1,'Every already prepared physician keeps its actual dressing while the other physicians are supplied.');
  }
  if(event.event==='mountainMedicalCare'){assert.equal(preparedDoctors.size,4);preparedDoctors.clear();}
 }});
 const medical=events.filter(event=>event.event==='mountainMedicalCare');assert.ok(medical.length>0&&medical.length<=48);
 assert.equal(medical.at(-1).patients.find(patient=>patient.id===139).hp,75);assert.equal(medical.at(-1).patients.find(patient=>patient.id===105).hp,70);
 for(const id of survivors){assert.equal(result.operativeState[id].alive,true);assert.equal(result.operativeState[id].location,'mendoza');assert.equal(result.operativeState[id].hp,result.operativeState[id].maxHp);assert.equal(result.operativeState[id].bleeding,0);}
 assert.equal(result.pendingBattle,null);assert.equal(result.pendingEncounter,null);assert.equal(result.defeated,false);assert.equal(result.sectors.uspallata.owner,'patriot');assert.ok(result.sectors.uspallata.fort>=1);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(result.operativeState[id].alive,false);
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
 t.diagnostic(JSON.stringify({scope:meta.scope,medicalAttempts:medical.length,medicalHours:[...new Set(medical.map(event=>event.hour))],survivors,doctors,clock:[result.hour,result.secondOfHour],treasury:result.resources.treasury,fullHealthRequired:true,priorDeathsPreserved:true}));
});
