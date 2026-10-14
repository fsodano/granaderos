import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {northernOfficerSaltaController} from './fresh-northern-fixture.mjs';
import {completeHiredNorthernMission} from './fresh-northern-command.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

test('earned native Salta battery preserves exact finite shot costs and completes Yatasto with saved replay and permanent losses',t=>{
 const compressed=readFileSync(new URL('./fixtures/northern-officer-native-edge-salta-ready.save.json.gz',import.meta.url));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/northern-officer-native-edge-salta-ready.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start);
 assert.deepEqual([start.hour,start.secondOfHour],[502,2699]);assert.equal(start.pendingBattle.sector,'salta');
 assert.equal(start.sectorStates.tucuman.wallGeometryVersion,2);assert.equal(start.sectors.tucuman.owner,'patriot');
 const initial=enterSector(start.pendingBattle,start.sectorStates.salta),gun=initial.artillery.find(piece=>piece.id==='arsenal:cordoba:2');
 assert.ok(gun);assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);
 const result=fight(start.pendingBattle,start.sectorStates.salta,{controller:northernOfficerSaltaController(initial)});
 recordRouteStrategicEvidence({helper:'northernOfficerNativeSaltaResult',stage:'route-checkpoint',campaign:start,context:{scope:'Actual existing native result before the receipt assertions. Replay, settlement and Yatasto continuation have not yet executed.',request:start.pendingBattle,previous:start.sectorStates.salta,initial,result}});
 // Exact 2026-10-13 source75079 native receipt: 9/438/1508, five paid shots,
 // losses117/108. The dated raw fixture/provenance remain unchanged; their
 // earlier 24/410, seven-shot, exhausted-piece and six-loss receipts are history.
 assert.equal(result.battle.status,'victory');assert.equal(result.battle.turn,9);assert.equal(result.actions,438);assert.equal(result.orders.length,462);assert.equal(result.battle.elapsedSeconds,1508);
 const spent=result.battle.artillery.find(piece=>piece.id===gun.id),shots=result.orders.filter(action=>action.type==='artillery'&&action.artilleryId===gun.id);
 assert.equal(shots.length,5);assert.equal(spent.loaded,true);assert.equal(spent.ammo,1);
 assert.equal(Number(gun.loaded)+gun.ammo-Number(spent.loaded)-spent.ammo,shots.length,'Every shot consumes one real charge.');
 let pair={campaign:start,battle:initial};
 for(let index=0;index<result.orders.length;index++){
  const action=result.orders[index],battle=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(battle.lastError,null);
  const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null);pair={campaign:synced.campaign,battle:synced.battle};
  if(index===Math.floor(result.orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 }
 const direct=syncBattleTime(start,result.battle);assert.equal(direct.error,null);assert.deepEqual(pair,{campaign:direct.campaign,battle:direct.battle});
 const settled=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:start.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(unit=>unit.side==='player'),sectorState:pair.battle});
 assert.equal(settled.lastError,null);assert.equal(settled.defeated,false);assert.equal(settled.sectors.salta.owner,'patriot');assert.equal(settled.pendingBattle,null);
 assert.deepEqual([settled.hour,settled.secondOfHour,settled.resources.treasury],[503,607,97782]);
 assert.deepEqual(settled.sectorStates.salta.artillery.find(piece=>piece.id===gun.id),spent,'Settlement retains the actual finite piece, placement and remaining charges.');
 const owners=[...Object.values(settled.sectorStates??{}).flatMap(scene=>scene.artillery??[]),...Object.values(settled.sceneStates??{}).flatMap(scene=>scene.artillery??[]),...Object.values(settled.artilleryDepots??{}).flat(),...(settled.artilleryTransfers??[]).map(transfer=>transfer.gun)].filter(piece=>piece.id===gun.id);
 assert.equal(owners.length,1,'The settled physical cannon has one field/depot/transfer owner.');assert.deepEqual(owners[0],spent);
 const losses=result.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0).map(unit=>Number(unit.id));assert.deepEqual(losses,[117,108]);
 const completed=completeHiredNorthernMission(settled);
 recordRouteStrategicEvidence({helper:'northernOfficerYatastoContinuation',stage:'route-checkpoint',campaign:settled,returnedCampaign:completed,context:{scope:'Actual existing whole Yatasto continuation output before mission, chronology, budget, survivor and save assertions. No additional orders or synchronization.',losses,shots:shots.length}});
 // Source5955's retained whole continuation proves 8s finite aid, four real
 // posta hours and 111s conference work. The dated 507:1083 receipt remains
 // historical; no clock assignment or additional order replaces this ledger.
 assert.deepEqual([completed.hour,completed.secondOfHour],[507,726]);assert.equal(completed.flags.northPact,true);assert.equal(completed.flags.partisanSupply,true);assert.equal(completed.missions.yatasto.completed,true);assert.equal(completed.phase,3);assert.equal(completed.pendingBattle,null);assert.ok(completed.resources.treasury>0);
 assert.equal((completed.hour-settled.hour)*3600+completed.secondOfHour-settled.secondOfHour,14519);
 assert.equal(completed.resources.treasury,105472);assert.equal(completed.resources.treasury,settled.resources.treasury+8000-300-10,'One actual midnight income pays the pact and posta fare.');
 assert.deepEqual(completed.contracts,settled.contracts,'The actual completed mission preserves every existing service term.');
 const returnedOwners=[...Object.values(completed.sectorStates??{}).flatMap(scene=>scene.artillery??[]),...Object.values(completed.sceneStates??{}).flatMap(scene=>scene.artillery??[]),...Object.values(completed.artilleryDepots??{}).flat(),...(completed.artilleryTransfers??[]).map(transfer=>transfer.gun)].filter(piece=>piece.id===gun.id);
 assert.equal(returnedOwners.length,1);assert.deepEqual(returnedOwners[0],spent,'The whole mission leaves both actual charges in the same physical cannon.');
 for(const [id,record]of Object.entries(settled.operativeState)){assert.equal(completed.operativeState[id].alive,record.alive);if(!record.alive){assert.equal(completed.operativeState[id].hp,0);assert.equal(completed.operativeState[id].deathMinute,record.deathMinute);}}
 for(const id of losses)assert.equal(completed.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(completed.operativeState[id].alive,false);
 for(const id of [9,11,1])assert.equal(completed.operativeState[id].alive,true);
 assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],status:result.battle.status,turns:result.battle.turn,actions:result.actions,shots:shots.length,chargesRemaining:Number(spent.loaded)+spent.ammo,losses,yatastoClock:[completed.hour,completed.secondOfHour],exactBattleReplay:true,officialMidpoint:true}));
});
