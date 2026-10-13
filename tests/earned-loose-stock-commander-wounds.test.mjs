import {admitEarnedArtilleryMarkers} from './earned-artillery-admission-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {isUnconscious} from '../game/actor-condition.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {completeHiredNorthernMission} from './fresh-northern-command.mjs';

// This is the real loose seed-8 Salta checkpoint from the failed complete
// 3200-peso ending run. It proves the native handover, not the full ending.
test('earned loose stock Yatasto preserves the capable commander wounds, finite aid, service and exact saved outcome',t=>{
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-loose-stock-commander-wounds.provenance.json',import.meta.url)));
 const fixture=record=>{
  const compressed=readFileSync(new URL(`./fixtures/${record.fixture}`,import.meta.url));assert.equal(sha(compressed),record.gzipSha256);
  const raw=gunzipSync(compressed);assert.equal(raw.length,record.rawBytes);assert.equal(sha(raw),record.rawSha256);return admitEarnedArtilleryMarkers(JSON.parse(raw),{sectors:['retiro','buenos_aires','san_nicolas','san_lorenzo','cordoba','tucuman','salta'],scenes:record===metadata.continuation?{yatasto:'tucuman'}:{},label:record.fixture});
 };
 const start=fixture(metadata.input),expected=fixture(metadata.continuation),before=structuredClone(start);
 assert.deepEqual([start.hour,start.secondOfHour],[792,3583]);assert.equal(start.resources.treasury,231172);
 assert.equal(start.phase,2);assert.equal(start.missions.yatasto?.completed??false,false);
 assert.deepEqual([start.operativeState[57].hp,start.operativeState[57].maxHp,start.operativeState[57].bleeding,start.operativeState[57].bandaged],[21,88,0,67]);
 assert.equal(start.operativeState[57].alive,true);assert.equal(isUnconscious(start.operativeState[57]),false);
 assert.deepEqual(decodeSave(encodeSave(start)).campaign,start,'The genuine input must admit through the official save codec.');
 const events=[];let arrival=null,checkpoint=null;
 const completed=completeHiredNorthernMission(decodeSave(encodeSave(start)).campaign,{routeKind:'stock',report:event=>events.push(event),onCheckpoint:(stage,campaign)=>{
  if(stage==='northernMissionArrival')arrival=campaign;
  if(stage==='northernMissionCompleted')checkpoint=campaign;
 }});
 assert.deepEqual(completed,expected,'All native orders must reproduce the actual captured post-mission campaign.');
 assert.deepEqual(checkpoint,completed);assert.ok(arrival);assert.equal(arrival.location,'tucuman');
 assert.deepEqual(decodeSave(encodeSave(arrival)).campaign,arrival,'The real arrival checkpoint must remain admissible.');
 assert.deepEqual([completed.hour,completed.secondOfHour],[798,107]);
 assert.equal((completed.hour-start.hour)*3600+completed.secondOfHour-start.secondOfHour,18124);
 const collected=events.filter(event=>event.event==='northernMissionDressingsCollected').map(({id,sector,count,sourceKey})=>({id,sector,count,sourceKey}));
 assert.deepEqual(collected,[{id:108,sector:'salta',count:2,sourceKey:'["body","enemy-2","medkits"]'}]);
 const source=c=>c.sectorStates.salta.units.find(unit=>unit.id==='enemy-2');
 assert.equal(source(start).medkits,2);assert.equal(source(completed).medkits,0,'Both dressings must leave the genuine fallen body.');
 assert.equal(start.operativeState[108].medkits,0);assert.equal(completed.operativeState[108].medkits,0,'The physician spends both collected dressings.');
 const aid=events.find(event=>event.event==='northernMissionFirstAid');
 assert.deepEqual([aid.ids,aid.actions,aid.elapsedSeconds,aid.treatedIds,aid.stoppedReason],[[108,110,125],4,13,['110','125'],null]);
 assert.deepEqual([completed.operativeState[110].hp,completed.operativeState[110].bleeding,completed.operativeState[125].hp,completed.operativeState[125].bleeding],[15,0,30,0],'Real treatment preserves the injury and its actual deterioration.');
 const renewals=events.filter(event=>event.event==='northernMissionRenewal');
 assert.deepEqual(renewals.map(({id,price})=>({id,price})),[{id:117,price:108},{id:121,price:72},{id:126,price:42},{id:100,price:40}]);
 assert.equal(events.find(event=>event.event==='northernMissionPact').cost,300);
 assert.equal(completed.resources.treasury,start.resources.treasury-300-262-10,'The pact, real service renewals and posta fare are paid; this interval contains no midnight income.');
 assert.deepEqual(completed.recruited,start.recruited);
 for(const [id,record]of Object.entries(start.operativeState))assert.equal(completed.operativeState[id].alive,record.alive,`The native handover preserves the actual survival of ${id}.`);
 for(const id of completed.recruited.filter(id=>completed.operativeState[id].alive&&!completed.operativeState[id].captured)){
  const record=completed.operativeState[id],expiry=contractExpiresSeconds(completed.contracts[id]);
  assert.ok(record.hp>=15);assert.equal(record.bleeding,0);assert.ok(expiry===null||expiry>completed.hour*3600+completed.secondOfHour);
 }
 const commander=completed.operativeState[57],npc=completed.sceneStates.yatasto.npcs.find(npc=>npc.id==='yatasto-san-martin');
 assert.equal(commander.alive,true);assert.equal(isUnconscious(commander),false);
 assert.deepEqual([commander.hp,commander.bleeding,commander.bandaged],[21,0,67]);
 assert.deepEqual([npc.hp,npc.bleeding,npc.bandaged,npc.unconscious],[21,0,67,false],'The real scene uses the same wounded, conscious commander.');
 assert.equal(completed.phase,3);assert.equal(completed.missions.yatasto.completed,true);assert.equal(completed.flags.northPact,true);assert.equal(completed.flags.partisanSupply,true);
 assert.equal(completed.pendingBattle,null);assert.equal(completed.pendingEncounter,null);assert.equal(completed.completed,false);assert.equal(completed.defeated,false);assert.ok(!completed.recruited.includes(57));
 const formation=events.find(event=>event.event==='northernMissionLocalFormation');
 assert.deepEqual([formation.occupiedSquads,formation.envoyMembers,formation.actualSurvivors],[4,[1],12]);
 assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Earned loose seed-8 Yatasto handover only',inputClock:[start.hour,start.secondOfHour],outputClock:[completed.hour,completed.secondOfHour],commanderHp:commander.hp,finiteDressingsSpent:2,firstAidOrders:aid.actions,firstAidSeconds:aid.elapsedSeconds,renewals:262,pact:300,postaFare:10,treasury:completed.resources.treasury,priorDeathsPreserved:true,exactNativeCapturedOutput:true,officialSave:true}));
});
