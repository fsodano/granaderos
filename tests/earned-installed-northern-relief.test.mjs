import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {prepareNorthernOfficerRelief} from './fresh-northern-command.mjs';

test('the installed Tucumán survivors receive finite field aid before their actual northern relief trip',t=>{
 const name='earned-installed-tucuman-before-relief',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
 const meta=JSON.parse(fixture('provenance.json')),gzip=fixture('campaign.json.gz'),raw=gunzipSync(gzip),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(gzip),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const input=JSON.parse(raw),start=decodeSave(encodeSave(input)).campaign,before=structuredClone(start),events=[];
 assert.deepEqual(start,input);assert.equal(start.operativeState[122].hp,19);assert.equal(start.operativeState[122].bleeding,4);
 const ready=prepareNorthernOfficerRelief(start,{routeKind:'stock',report:event=>events.push(event)});
 const aid=events.find(event=>event.event==='createdCuyoFieldAid');assert.ok(aid);assert.equal(aid.sector,'tucuman');assert.deepEqual(aid.patients,[122,121,129]);
 assert.equal(aid.campaign.hour,start.hour);assert.equal(aid.campaign.secondOfHour,start.secondOfHour+10);
 assert.equal(aid.campaign.operativeState[122].hp,19);assert.equal(aid.campaign.operativeState[122].bleeding,0);assert.equal(aid.campaign.operativeState[122].medkits,1);
 for(const id of [121,129]){assert.equal(aid.campaign.operativeState[id].bleeding,0);assert.equal(aid.campaign.operativeState[id].medkits,1);}
 assert.equal(aid.steps.filter(action=>action.type==='useItem').length,3);assert.equal(aid.officialMidpoint,true);
 assert.equal(ready.pendingBattle.sector,'salta');assert.equal(ready.operativeState[122].alive,true);assert.ok(ready.operativeState[122].hp>=15);assert.equal(ready.operativeState[122].bleeding,0);
 const battle=enterSector(ready.pendingBattle,ready.sectorStates.salta);assert.deepEqual(decodeSave(encodeSave(ready,battle)),{campaign:ready,battle});
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(ready.operativeState[id].alive,false);
 assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:meta.scope,aidSeconds:10,dressings:3,doctorHp:ready.operativeState[122].hp,ready:[ready.hour,ready.secondOfHour],treasury:ready.resources.treasury,field:ready.pendingBattle.squad.map(unit=>unit.id)}));
});
