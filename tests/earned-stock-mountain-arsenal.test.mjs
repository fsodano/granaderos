import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {prepareFreshCuyoMountainArtillery} from './fresh-cuyo-fixture.mjs';

test('the actual funded stock route earns the remaining mountain guns without refilling its depleted bronze battery',t=>{
 const name='earned-stock-funded-before-mountain-arsenal',fixture=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url)),meta=JSON.parse(fixture('provenance.json')),gzip=fixture('save.json.gz'),raw=gunzipSync(gzip),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(raw),meta.rawSha256);assert.equal(sha(gzip),meta.gzipSha256);assert.equal(raw.length,meta.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],checkpoints=new Map();
 assert.deepEqual([start.hour,start.secondOfHour],meta.clock);assert.equal(start.resources.treasury,meta.treasury);
 assert.equal(start.flags.armyFunded,true);assert.equal(start.sectors.ensenada.owner,'royalist');assert.equal(start.artilleryArsenalRecoveries.ensenada,undefined);
 assert.equal(start.artilleryDepots.mendoza.reduce((sum,gun)=>sum+gun.ammo+Number(gun.loaded),0),5);
 const result=prepareFreshCuyoMountainArtillery(start,{report:event=>{const {campaign,battle,...receipt}=event;events.push(receipt);},onCheckpoint:(stage,campaign)=>{
  const battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):undefined;
  const restored=decodeSave(encodeSave(campaign,battle));assert.deepEqual(restored.campaign,campaign);if(battle)assert.deepEqual(restored.battle,battle);checkpoints.set(stage,campaign);
 }});
 const end=result.campaign,ready=checkpoints.get('arsenal-assault'),victory=checkpoints.get('arsenal-victory'),preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady'),battle=events.find(event=>event.event==='battleFinished');
 assert.equal(ready.pendingBattle.squad.length,12);assert.deepEqual(ready.pendingBattle.artillery,[]);assert.equal(preparation.reinforcements.length,7);
 for(const id of preparation.reinforcements){assert.equal(ready.contracts[id].kind,'paid');assert.equal(ready.contracts[id].term,'day');assert.ok(ready.contracts[id].paid>0);}
 assert.equal(battle.sector,'ensenada');assert.equal(battle.status,'victory');assert.ok(battle.actions>0&&battle.elapsedSeconds>0);
 const losses=preparation.field.filter(id=>!victory.operativeState[id].alive);assert.deepEqual(losses,[120,139,128,135]);
 assert.equal(end.sectors.ensenada.owner,'patriot');assert.ok(end.artilleryArsenalRecoveries.ensenada);assert.equal(end.location,'mendoza');assert.equal(end.pendingBattle,null);assert.equal(end.pendingEncounter,null);assert.equal(end.defeated,false);
 assert.deepEqual(result.batteryIds,FINITE_ARTILLERY_ARSENALS.ensenada.pieces.map(gun=>gun.id));
 for(const gun of FINITE_ARTILLERY_ARSENALS.ensenada.pieces)assert.deepEqual(storedArtilleryRecord(end.artilleryDepots.mendoza.find(piece=>piece.id===gun.id)),gun);
 for(const [sector,guns]of Object.entries(start.artilleryDepots))for(const gun of guns)assert.deepEqual(end.artilleryDepots[sector].find(piece=>piece.id===gun.id),gun,'The original gun retains its actual loading and reserve.');
 for(const id of preparation.field){assert.equal(end.operativeState[id].alive,!losses.includes(id));if(!losses.includes(id)){assert.equal(end.operativeState[id].location,'mendoza');assert.equal(end.operativeState[id].bleeding,0);assert.ok(end.operativeState[id].hp>=15);}}
 for(const id of preparation.reinforcements)assert.ok(!end.recruited.includes(id),'Temporary survivors end service after their real return; new casualties remain dead.');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(end.operativeState[id].alive,false);
 assert.deepEqual(end.squad,start.squad);assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);
 t.diagnostic(JSON.stringify({scope:meta.scope,inputClock:meta.clock,field:preparation.field,paidReinforcements:preparation.reinforcements,losses,battle:{turns:battle.turns,actions:battle.actions},batteryIds:result.batteryIds,return:[end.hour,end.secondOfHour],treasury:end.resources.treasury,originalGunRecordsPreserved:true,exactNativeReplay:true}));
});
