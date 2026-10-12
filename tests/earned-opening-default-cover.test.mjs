import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {prepareSaltaAssault} from './salta-route.mjs';
import provenance from './fixtures/opening-port-recovered-before-salta.provenance.json' with {type:'json'};

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clock=c=>c.hour*3600+(c.secondOfHour??0);
test('default Salta preparation covers the supplied port-funded force and wins its actual rear raid',t=>{
 const bytes=readFileSync(new URL('./fixtures/'+provenance.fixture,import.meta.url));assert.equal(sha(bytes),provenance.gzipSha256);
 const raw=gunzipSync(bytes);assert.equal(sha(raw),provenance.rawSha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),stop=Symbol('Stop after real default rear victory');
 let medical,cover,raid,victory,settled,defense,care;
 assert.throws(()=>prepareSaltaAssault(start,{onCheckpoint:(name,c,detail)=>{
  if(name==='salta-medical-courier')medical=structuredClone(detail.receipt);
  if(name==='salta-rear-cover')cover=structuredClone(detail.receipt);
  if(name==='support-battery-encounter')raid=structuredClone(c);
  if(name==='support-battery-victory')victory=structuredClone(c);
  if(name==='support-battery-care')care=structuredClone(detail.care);
  if(name==='support-battery-settled'){settled=structuredClone(c);defense=structuredClone(detail.defense);throw stop;}
 }}),error=>error===stop);
 assert.deepEqual(start,before);assert.ok(medical&&cover&&raid&&victory&&settled&&defense&&care);
 assert.equal(medical.needed,false);assert.deepEqual(medical.actions,[]);assert.deepEqual(medical.renewals,[]);assert.deepEqual(medical.transfers,[]);
 assert.equal(cover.ids.length,15);assert.equal(cover.actions.length,3);assert.ok(!cover.ids.includes(100));assert.ok(cover.endSeconds>cover.startSeconds);
 assert.equal(raid.pendingEncounter.sector,'tucuman');assert.equal(raid.pendingEncounter.groupId,'enemy-group-3');
 assert.equal(defense.status,'victory');assert.ok(defense.actions>0&&defense.turns>0&&defense.elapsedSeconds>0);
 assert.equal(clock(victory),defense.startSeconds+defense.elapsedSeconds);assert.equal(care.hours,0);assert.deepEqual(care.patients,[]);
 assert.deepEqual(victory,settled);assert.equal(settled.pendingEncounter,null);assert.equal(settled.pendingBattle,null);assert.equal(settled.defeated,false);
 assert.equal(settled.sectors.tucuman.owner,'patriot');assert.equal(settled.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');
 const deaths=start.recruited.filter(id=>start.operativeState[id].alive&&!settled.operativeState[id].alive);assert.deepEqual(deaths,[131]);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(settled.operativeState[id].alive,false);assert.equal(settled.operativeState[id].deathMinute,r.deathMinute);}
 for(const id of [122,121]){assert.equal(settled.operativeState[id].alive,true);assert.equal(settled.operativeState[id].bleeding,0);assert.ok(settled.operativeState[id].hp<settled.operativeState[id].maxHp);}
 assert.deepEqual(decodeSave(encodeSave(settled)).campaign,settled);
 t.diagnostic(JSON.stringify({scope:'Default earned Tucuman defense only; no completed battery, Cordoba raid, Salta or Yatasto claim.',turns:defense.turns,actions:defense.actions,elapsedSeconds:defense.elapsedSeconds,deaths,clock:[settled.hour,settled.secondOfHour]}));
});
