import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {prepareCreatedCuyoArsenalAssault} from './created-cuyo-artillery.mjs';

test('the earned loose route rests four actual veterans and pays eight reinforcements before its twelve-person arsenal assault',t=>{
 const name='earned-loose-funded-before-mountain-arsenal',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
 const meta=JSON.parse(fixture('provenance.json')),compressed=fixture('campaign.json.gz'),raw=gunzipSync(compressed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(compressed),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=JSON.parse(raw),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);
 assert.deepEqual(start.squad,[2,126,133,1,8]);assert.equal(start.flags.armyFunded,true);assert.equal(start.location,'mendoza');
 assert.equal(start.operativeState[1].morale,0);assert.equal(start.operativeState[8].morale,0);
 const result=prepareCreatedCuyoArsenalAssault(start,{report:event=>{const{campaign,battle,...record}=event;events.push(record);}});
 const ready=result.campaign,preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady');
 assert.deepEqual(preparation.field,[1,8,126,133,128,105,106,145,147,109,132,135]);assert.equal(new Set(preparation.field).size,12);
 assert.deepEqual(preparation.reinforcements,[128,105,106,145,147,109,132,135]);assert.deepEqual(preparation.doctors,[8,135]);
 assert.equal(ready.pendingBattle.squad.length,12);assert.deepEqual(ready.pendingBattle.artillery,[]);
 assert.ok(ready.hour>=start.hour+300,'Zero-morale permanent veterans earn the required readiness through the real rest clock.');
 for(const id of [1,8])assert.ok(ready.operativeState[id].morale>=50);
 for(const id of preparation.reinforcements){assert.equal(ready.contracts[id].kind,'paid');assert.equal(ready.contracts[id].term,'day');assert.ok(ready.contracts[id].paid>0);}
 for(const id of preparation.doctors)assert.equal(ready.operativeState[id].medkits,8);
 assert.deepEqual(ready.artilleryDepots,start.artilleryDepots,'Existing gun identities, charges and custody remain unchanged.');
 assert.equal(ready.sectors.ensenada.owner,'royalist');assert.equal(ready.artilleryArsenalRecoveries.ensenada,undefined);
 assert.equal(ready.operativeState[2].location,'mendoza');assert.equal(ready.operativeState[2].alive,true);assert.ok(!result.field.includes(2));
 for(const id of start.squad)assert.equal(ready.operativeState[id].alive,true);
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(ready.operativeState[id].alive,false);assert.equal(ready.operativeState[id].deathMinute,record.deathMinute);}
 const battle=enterSector(ready.pendingBattle,ready.sectorStates.ensenada),restored=decodeSave(encodeSave(ready,battle));
 assert.deepEqual(restored.campaign,ready);assert.deepEqual(restored.battle,battle);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Actual loose funded input, paid rest, recruitment, finite kit and pending assault only; native survival, arsenal return and ending remain separate.',inputSha256:meta.rawSha256,field:preparation.field,paidReinforcements:preparation.reinforcements,doctors:preparation.doctors,assaultClock:[ready.hour,ready.secondOfHour],treasury:ready.resources.treasury}));
});
