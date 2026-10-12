import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {stabilizeCreatedCuyoSurvivors,assembleCreatedCuyo} from './created-cuyo-route.mjs';

function earnedYatasto(){
 const stem='./fixtures/created-cuyo-earned-yatasto-7415af55',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url),'utf8'));
 const packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.inputSha256);
 return decodeSave(raw.toString()).campaign;
}

test('the real bleeding Yatasto survivor uses his finite dressing before Cuyo meetings or marches',()=>{
 const start=earnedYatasto(),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[507,2014]);assert.equal(start.phase,3);assert.equal(start.missions.yatasto.completed,true);
 assert.deepEqual({hp:start.operativeState[133].hp,bleeding:start.operativeState[133].bleeding,medkits:start.operativeState[133].medkits},{hp:40,bleeding:3,medkits:1});
 const campaign=stabilizeCreatedCuyoSurvivors(start,{report:event=>events.push(event)}),aid=events.find(event=>event.event==='createdCuyoFieldAid');
 assert.ok(aid);assert.equal(aid.sector,'salta');assert.equal(aid.doctor,133);assert.deepEqual(aid.patients,[133]);assert.equal(aid.officialMidpoint,true);
 assert.ok(aid.steps.some(action=>action.type==='useItem'&&action.unitId==='133'&&action.targetId==='133'));
 const kept=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);assert.equal(kept.length,13);
 for(const id of kept){
  const old=start.operativeState[id],next=campaign.operativeState[id];assert.ok(next.alive&&campaign.recruited.includes(id));assert.equal(next.location,old.location);assert.deepEqual(campaign.contracts[id],start.contracts[id]);
  for(const key of ['inventory','ammo','carriedLoaded','weaponDropped','primaryWeapon','bladeWeapon','outfit','headwear','legwear'])assert.deepEqual(next[key],old[key],`native aid preserves the cohort's physical ownership: ${id}/${key}`);
  assert.equal(next.medkits,old.medkits-Number(id===133));if(id!==133)assert.equal(next.hp,old.hp);
  const previous=start.squads.find(squad=>squad.members.includes(id));
  if(previous)assert.ok(campaign.squads.find(squad=>squad.id===previous.id).members.includes(id),'previously assigned people return to their actual squad through ordinary orders');
 }
 assert.equal(campaign.activeSquadId,start.activeSquadId);assert.equal(campaign.operativeState[133].bleeding,0);assert.ok(campaign.operativeState[133].hp>=15&&campaign.operativeState[133].hp<=40,'first aid stops blood loss without replacing the real wound');
 assert.equal(campaign.operativeState[133].medkits,0);assert.equal(campaign.resources.treasury,start.resources.treasury);assert.deepEqual(campaign.loadouts,start.loadouts);assert.ok(campaign.hour*3600+campaign.secondOfHour>start.hour*3600+start.secondOfHour);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(start,before);
});

test('the complete actual Cuyo assembly keeps all living northern survivors after timely field aid and lawful care',()=>{
 const start=earnedYatasto(),before=structuredClone(start),events=[],campaign=assembleCreatedCuyo(start,{report:event=>events.push(event)});
 assert.ok(events.find(event=>event.event==='createdCuyoFieldAid'));
 for(const id of start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured)){
  const record=campaign.operativeState[id];assert.ok(record.alive&&campaign.recruited.includes(id),`the actual living survivor ${id} remains present`);assert.equal(record.location,'cordoba');assert.equal(record.hp,record.maxHp);assert.equal(record.bleeding,0);assert.ok(campaign.contracts[id]);
 }
 const positioned=events.filter(event=>event.event==='createdCuyoDefensePosition');assert.ok(positioned.some(event=>event.id===133&&event.hp>=15),'the saved native roof walk is performed by the living treated survivor');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.defeated,false);assert.equal(campaign.completed,false);assert.equal(campaign.pendingBattle,null);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(start,before);
});
