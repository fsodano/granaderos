import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {recoverDelayedFoundryConvoy,completeFreshArmyFunding} from './fresh-cuyo-route.mjs';

test('earned foundry convoy recaptures its real route, treats routed survivors with finite stock, and funds the army without replacing the spent cannon',t=>{
 const compressed=readFileSync(new URL('./fixtures/foundry-native-edge-delayed-convoy.save.json.gz',import.meta.url));
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/foundry-native-edge-delayed-convoy.provenance.json',import.meta.url)));
 const sha=value=>createHash('sha256').update(value).digest('hex');assert.equal(sha(compressed),provenance.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),provenance.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[595,323]);assert.equal(start.flags.foundry,true);assert.equal(start.flags.armyFunded,false);
 assert.equal(start.sectors.salta.owner,'royalist');assert.equal(start.sectorStates.mendoza.wallGeometryVersion,2);
 const transfer=start.artilleryTransfers.find(piece=>piece.id==='arsenal:cordoba:2');assert.ok(transfer);assert.equal(transfer.gun.loaded,false);assert.equal(transfer.gun.ammo,0);
 assert.equal(ownedArtilleryCount(start),3);
 const recovered=recoverDelayedFoundryConvoy(start,{report:event=>events.push(event)}),receipt=events.find(event=>event.event==='foundryConvoyRecovered');
 assert.ok(receipt);assert.equal(receipt.battle.status,'victory');assert.equal(receipt.battle.turns,20);assert.equal(receipt.battle.actions,301);
 assert.deepEqual(receipt.deaths,[11,103,8,122,139]);assert.deepEqual(receipt.record,transfer.gun);
 assert.deepEqual([recovered.hour,recovered.secondOfHour],[612,499]);assert.equal(recovered.location,'mendoza');
 assert.equal(recovered.sectors.salta.owner,'patriot');assert.deepEqual(recovered.artilleryDepots.cordoba.find(gun=>gun.id===transfer.id),transfer.gun);
 assert.equal(ownedArtilleryCount(recovered),3);assert.ok(!recovered.artilleryTransfers.some(piece=>piece.id===transfer.id));
 assert.equal(events.filter(event=>event.event==='convoyFiniteDressings').reduce((sum,event)=>sum+event.count,0),2);
 const aid=events.filter(event=>event.event==='convoyActualCare');assert.equal(aid.length,4);assert.ok(aid.every(event=>event.used===1));
 assert.deepEqual(aid.map(event=>event.action.targetId),['111','111','140','125']);
 for(const id of receipt.carePatients){assert.equal(recovered.operativeState[id].alive,true);assert.ok(recovered.operativeState[id].hp>=15);assert.equal(recovered.operativeState[id].bleeding,0);}
 const funded=completeFreshArmyFunding(recovered,{report:event=>events.push(event)});
 assert.equal(funded.flags.armyFunded,true);assert.equal(funded.defeated,false);assert.equal(funded.operativeState[2].alive,true);
 assert.equal(funded.sectors.cordoba.militia[0],3);assert.equal(ownedArtilleryCount(funded),3);
 assert.deepEqual(funded.artilleryDepots.mendoza.find(gun=>gun.id===transfer.id),transfer.gun);
 assert.ok(events.some(event=>event.event==='freshRouteOrder'&&event.action.type==='respondToEncounter'&&event.action.choice==='retreat'&&event.action.destination==='tucuman'));
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(funded.operativeState[id].alive,false);
 for(const id of receipt.deaths)assert.equal(funded.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(funded)).campaign,funded);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],recoveredClock:[recovered.hour,recovered.secondOfHour],fundedClock:[funded.hour,funded.secondOfHour],deaths:receipt.deaths,dressingsUsed:aid.length,gunId:transfer.id,gunShots:0,actualRearWithdrawal:true}));
});
