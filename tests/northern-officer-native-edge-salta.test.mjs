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

test('earned native Salta battery uses every finite charge and completes Yatasto with exact saved replay and permanent losses',t=>{
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
 assert.equal(result.battle.status,'victory');assert.equal(result.battle.turn,24);assert.equal(result.actions,410);
 const spent=result.battle.artillery.find(piece=>piece.id===gun.id),shots=result.orders.filter(action=>action.type==='artillery'&&action.artilleryId===gun.id);
 assert.equal(shots.length,7);assert.equal(spent.loaded,false);assert.equal(spent.ammo,0);
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
 const losses=result.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0).map(unit=>Number(unit.id));assert.deepEqual(losses,[104,146,101,117,108,133]);
 const completed=completeHiredNorthernMission(settled);
 assert.deepEqual([completed.hour,completed.secondOfHour],[507,1083]);assert.equal(completed.flags.northPact,true);assert.equal(completed.flags.partisanSupply,true);assert.equal(completed.missions.yatasto.completed,true);assert.equal(completed.phase,3);assert.equal(completed.pendingBattle,null);assert.ok(completed.resources.treasury>0);
 for(const id of losses)assert.equal(completed.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(completed.operativeState[id].alive,false);
 for(const id of [9,11,1])assert.equal(completed.operativeState[id].alive,true);
 assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],status:result.battle.status,turns:result.battle.turn,actions:result.actions,shots:shots.length,chargesRemaining:0,losses,yatastoClock:[completed.hour,completed.secondOfHour],exactBattleReplay:true,officialMidpoint:true}));
});
