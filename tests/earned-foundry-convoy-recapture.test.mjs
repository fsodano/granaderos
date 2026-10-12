import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {recoverDelayedFoundryConvoy} from './fresh-cuyo-route.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the earned installed convoy recaptures both cut towns and returns actual survivors with the exact gun',t=>{
 const meta=JSON.parse(fixture('earned-installed-two-cut-convoy.provenance.json'));
 const compressed=fixture('earned-installed-two-cut-convoy.save.json.gz'),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],meta.inputClock);assert.equal(start.resources.treasury,meta.inputTreasury);
 const original=start.artilleryTransfers.find(row=>row.id===meta.originalTransferId);
 assert.deepEqual(original.path.filter(id=>start.sectors[id].owner!=='patriot'),meta.cutLocalities.slice().reverse());
 const result=recoverDelayedFoundryConvoy(start,{report:event=>{
  // Keep receipts, rather than hundreds of large duplicate campaign clones.
  const {campaign,battle,...receipt}=event;events.push(receipt);
 }});
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(result)).campaign,result);
 assert.deepEqual([result.hour,result.secondOfHour],[1533,1397]);assert.equal(result.resources.treasury,167020);
 assert.equal(result.location,'mendoza');assert.equal(result.pendingBattle,null);assert.equal(result.pendingEncounter,null);
 assert.equal(result.defeated,false);assert.equal(result.flags.armyFunded,false);
 assert.ok(original.path.every(id=>result.sectors[id].owner==='patriot'));
 assert.equal(result.artilleryTransfers.some(row=>row.id===original.id),false);
 assert.deepEqual(result.artilleryDepots.cordoba.find(gun=>gun.id===original.id),original.gun);
 assert.equal(original.gun.loaded,true);assert.equal(original.gun.ammo,2);
 const recovered=events.find(event=>event.event==='foundryConvoyRecovered');
 assert.deepEqual(recovered.battles.map(row=>({sector:row.sector,status:row.status,turns:row.turns,actions:row.actions})),[
  {sector:'tucuman',status:'victory',turns:11,actions:420},
  {sector:'salta',status:'victory',turns:8,actions:264}
 ]);
 const newDeaths=Object.keys(result.operativeState).filter(id=>before.operativeState[id].alive&&!result.operativeState[id].alive).map(Number).sort((a,b)=>a-b);
 assert.deepEqual(newDeaths,[9,100,103,122]);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(result.operativeState[id].alive,false);
 for(const id of result.recruited.filter(id=>result.operativeState[id].alive)){
  assert.equal(result.operativeState[id].location,'mendoza');assert.ok(result.contracts[id]);
  assert.ok(result.operativeState[id].hp>=15);assert.equal(result.operativeState[id].bleeding,0);
 }
 assert.equal(result.operativeState[2].alive,true);assert.equal(result.operativeState[134].hp,17);assert.equal(result.operativeState[134].maxHp,72);
 assert.deepEqual(result.squad,start.squad.filter(id=>result.operativeState[id].alive));
 assert.ok(events.some(event=>event.event==='stableRouteRestFinished'&&event.completed&&event.hours===59));
 t.diagnostic(JSON.stringify({inputSha256:meta.rawSha256,battles:recovered.battles,newDeaths,returned:[result.hour,result.secondOfHour],treasury:result.resources.treasury,originalGun:original.gun,scope:meta.scope}));
});
