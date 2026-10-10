import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {recoverCreatedCuyoMountainArtillery} from './created-cuyo-artillery.mjs';

test('earned funded Cuyo wins Ensenada with paid columns and delivers only its two finite guns with exact battle replay',t=>{
 const compressed=readFileSync(new URL('./fixtures/created-cuyo-native-edge-funded.save.json.gz',import.meta.url));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/created-cuyo-native-edge-funded.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],checkpoints=new Map();
 assert.deepEqual([start.hour,start.secondOfHour],[680,499]);assert.equal(start.location,'mendoza');assert.equal(start.flags.armyFunded,true);
 assert.equal(start.sectors.ensenada.owner,'royalist');assert.deepEqual(start.squad,[2,0]);assert.equal(start.pendingBattle,null);
 assert.ok(Object.values(start.artilleryDepots).flat().every(gun=>!gun.loaded&&gun.ammo===0));
 const result=recoverCreatedCuyoMountainArtillery(start,{report:event=>{if(['createdCuyo','battle'].some(prefix=>String(event.event).startsWith(prefix))){const {campaign,...record}=event;events.push(structuredClone(record));}},onCheckpoint:(stage,campaign)=>{
  const battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):null;
  const restored=decodeSave(encodeSave(campaign,battle));assert.deepEqual(restored.campaign,campaign);if(battle)assert.deepEqual(restored.battle,battle);
  checkpoints.set(stage,restored.campaign);
 }});
 const completed=result.campaign,ready=checkpoints.get('arsenal-assault'),victory=checkpoints.get('arsenal-victory'),opened=checkpoints.get('arsenal-open');
 assert.equal(ready.pendingBattle.squad.length,12);assert.deepEqual(ready.pendingBattle.artillery,[]);
 const preparation=events.find(event=>event.event==='createdCuyoArsenalAssaultReady');assert.equal(preparation.field.length,12);assert.equal(preparation.reinforcements.length,7);assert.equal(new Set(preparation.doctors).size,2);
 assert.ok(preparation.reinforcements.every(id=>ready.contracts[id]?.kind==='paid'&&ready.contracts[id].term==='day'&&ready.contracts[id].paid>0));
 const battle=events.find(event=>event.event==='battleFinished');assert.equal(battle.sector,'ensenada');assert.equal(battle.status,'victory');assert.equal(battle.turns,13);assert.equal(battle.actions,410);
 const losses=preparation.field.filter(id=>!victory.operativeState[id].alive);assert.deepEqual(losses,[121,102,100,130,128,106,145,135]);
 assert.equal(victory.sectors.ensenada.owner,'patriot');assert.equal(victory.pendingBattle,null);
 assert.deepEqual(events.filter(event=>event.event==='createdCuyoArsenalCare').map(event=>event.dressingsSpent),[0]);
 assert.equal(opened.artilleryArsenalRecoveries.ensenada!==undefined,true);assert.deepEqual(opened.sectorStates.ensenada.artillery.map(storedArtilleryRecord),FINITE_ARTILLERY_ARSENALS.ensenada.pieces);
 const shipments=events.filter(event=>event.event==='createdCuyoArsenalShipment');assert.deepEqual(shipments.map(event=>event.id),FINITE_ARTILLERY_ARSENALS.ensenada.pieces.map(gun=>gun.id));assert.ok(shipments.every(event=>event.cost===0&&event.hours===54));
 assert.deepEqual(result.selections,['depot:arsenal:ensenada:1','depot:arsenal:ensenada:2']);
 for(const gun of FINITE_ARTILLERY_ARSENALS.ensenada.pieces)assert.deepEqual(completed.artilleryDepots.mendoza.find(record=>record.id===gun.id),gun);
 for(const [sector,guns]of Object.entries(start.artilleryDepots))for(const gun of guns)assert.deepEqual(completed.artilleryDepots[sector].find(record=>record.id===gun.id),gun);
 assert.ok(!completed.artilleryTransfers.some(transfer=>FINITE_ARTILLERY_ARSENALS.ensenada.pieces.some(gun=>gun.id===transfer.id)));
 const retreat=events.find(event=>event.event==='createdCuyoArsenalRearEncounter');assert.equal(retreat.choice,'retreat');assert.equal(retreat.sector,'tucuman');assert.equal(retreat.destination,'cordoba');assert.deepEqual(retreat.deaths,[]);assert.equal(completed.sectors.tucuman.owner,'royalist');
 for(const id of [...metadata.priorDeaths,...losses])assert.equal(completed.operativeState[id].alive,false);
 for(const id of preparation.reinforcements.filter(id=>completed.operativeState[id].alive)){assert.equal(completed.operativeState[id].location,'mendoza');assert.ok(!completed.recruited.includes(id));}
 assert.deepEqual(completed.squad,start.squad);assert.equal(completed.activeSquadId,start.activeSquadId);assert.equal(completed.location,'mendoza');assert.equal(completed.operativeState[2].alive,true);assert.equal(completed.operativeState[57].alive,true);assert.equal(completed.flags.armyFunded,true);assert.equal(completed.defeated,false);assert.equal(completed.pendingBattle,null);
 assert.deepEqual([completed.hour,completed.secondOfHour],[976,1721]);assert.equal(completed.resources.treasury,55583);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);
 t.diagnostic(JSON.stringify({inputClock:metadata.clock,columns:12,paidReinforcements:7,turns:battle.turns,actions:battle.actions,losses,finiteDressings:0,gunRounds:14,cartHours:54,deliveryClock:[completed.hour,completed.secondOfHour],treasury:completed.resources.treasury,exactBattleReplay:true,officialSaveRoundTrips:true}));
});
