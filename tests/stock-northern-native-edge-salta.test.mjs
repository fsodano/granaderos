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
import {autoBandageBattle} from '../game/auto-bandage.js';
import {operativeLocation} from '../game/squads.js';
import {fight} from './opening-driver.mjs';
import {stockNorthernSaltaController} from './fresh-northern-fixture.mjs';
import {completeHiredNorthernMission} from './fresh-northern-command.mjs';
import {visit,sync,leave} from './local-contract-fixture.mjs';

test('earned stock Salta keeps a finite medic ready and physically relieves the routed survivor before exact Yatasto completion',t=>{
 const compressed=readFileSync(new URL('./fixtures/stock-northern-native-edge-salta-ready.save.json.gz',import.meta.url));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/stock-northern-native-edge-salta-ready.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start);
 assert.deepEqual([start.hour,start.secondOfHour],[371,2150]);assert.equal(start.pendingBattle.sector,'salta');
 assert.equal(start.sectorStates.tucuman.wallGeometryVersion,2);assert.equal(start.sectors.tucuman.owner,'patriot');
 const initial=enterSector(start.pendingBattle,start.sectorStates.salta),gun=initial.artillery.find(piece=>piece.id==='arsenal:cordoba:2');
 assert.ok(gun);assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);
 const result=fight(start.pendingBattle,start.sectorStates.salta,{controller:stockNorthernSaltaController(initial)});
 // Re-run the unchanged earned input through the current native controller.
 // Its actual tape, deaths and wounds remain receipts; old outcomes are not
 // permission to restore bodies or manufacture the former critical wounds.
 assert.equal(result.battle.status,'victory');assert.equal(result.battle.turn,9);assert.equal(result.actions,243);
 const spent=result.battle.artillery.find(piece=>piece.id===gun.id),shots=result.orders.filter(action=>action.type==='artillery'&&action.artilleryId===gun.id);
 assert.equal(Number(gun.loaded)+gun.ammo-Number(spent.loaded)-spent.ammo,shots.length,'Every shot consumes an actual finite charge.');
 assert.ok(result.orders.some(action=>action.type==='weapon'&&action.unitId==='146'&&action.slot==='medical'));
 assert.equal(result.battle.units.find(unit=>unit.id==='146').activeSlot,'medical');
 let pair={campaign:start,battle:initial};
 for(let index=0;index<result.orders.length;index++){
  const action=result.orders[index],battle=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(battle.lastError,null);
  const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null);pair={campaign:synced.campaign,battle:synced.battle};
  if(index===Math.floor(result.orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 }
 const direct=syncBattleTime(start,result.battle);assert.equal(direct.error,null);assert.deepEqual(pair,{campaign:direct.campaign,battle:direct.battle});
 const settled=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:start.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(unit=>unit.side==='player'),sectorState:pair.battle});
 assert.equal(settled.lastError,null);assert.equal(settled.sectors.salta.owner,'patriot');assert.equal(settled.pendingBattle,null);
 const losses=result.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0).map(unit=>Number(unit.id));assert.deepEqual(losses,[11,101,117,139]);
 for(const id of [146,100,102]){assert.equal(settled.operativeState[id].alive,true);assert.equal(settled.operativeState[id].hp,settled.operativeState[id].maxHp);assert.equal(settled.operativeState[id].bleeding,0);}
 assert.equal(settled.operativeState[146].medkits,start.operativeState[146].medkits,'The protected field physician retains the actual dressing reserve.');
 assert.equal(settled.operativeState[102].hp,72);assert.equal(settled.operativeState[102].bleeding,0);
 assert.equal(settled.operativeState[107].hp,42);assert.equal(settled.operativeState[107].bleeding,2);assert.equal(operativeLocation(settled,107),'cell-12-8');assert.equal(settled.operativeState[107].medkits,0);
 const events=[];let roadInput=null,roadOutput=null;
 const completed=completeHiredNorthernMission(settled,{routeKind:'stock',report:event=>events.push(structuredClone(event)),onCheckpoint:(stage,campaign)=>{
  if(stage==='stock-road-relief-before-aid')roadInput=structuredClone(campaign);
  if(stage==='stock-road-relief-complete')roadOutput=structuredClone(campaign);
 }});
 assert.equal(events.some(event=>event.event==='northernMissionFirstAid'),false,'This real result has no local acute patient; it must not spend phantom field dressings.');
 const relief=events.find(event=>event.event==='northernRoadRelief');
 assert.equal(relief.patientId,107);assert.equal(relief.doctor,116);assert.equal(relief.source,'salta');assert.equal(relief.destination,'cell-12-8');assert.equal(relief.hours,2);assert.equal(relief.dressingsUsed,1);
 assert.equal(relief.actions,1);assert.equal(relief.elapsedSeconds,2);
 assert.ok(roadInput&&roadOutput);assert.equal(operativeLocation(roadInput,116),'cell-12-8');assert.equal(roadInput.operativeState[116].activeSlot,'medical');assert.equal(roadInput.operativeState[107].hp,40);
 const dressingStock=roadInput.operativeState[116].medkits+roadInput.operativeState[107].medkits;
 let aidPair=visit(roadInput);const aid=autoBandageBattle(aidPair.battle);
 for(let index=0;index<aid.steps.length;index++){
  const battle=actBattle(aidPair.battle,aid.steps[index]);assert.equal(battle.lastError,null);aidPair=sync({campaign:aidPair.campaign,battle});
  if(index===Math.floor(aid.steps.length/2))aidPair=decodeSave(encodeSave(aidPair.campaign,aidPair.battle));
 }
 assert.deepEqual(decodeSave(encodeSave(leave(aidPair))).campaign,roadOutput,'Actual road aid replays exactly through the official midpoint save.');
 assert.equal(roadOutput.operativeState[116].medkits+roadOutput.operativeState[107].medkits,dressingStock-1);
 assert.equal(roadOutput.operativeState[107].hp,40);assert.equal(roadOutput.operativeState[107].bleeding,0);assert.equal(roadOutput.operativeState[107].bandaged,34);
 assert.equal(completed.flags.northPact,true);assert.equal(completed.flags.partisanSupply,true);assert.equal(completed.missions.yatasto.completed,true);assert.equal(completed.phase,3);assert.equal(completed.pendingBattle,null);assert.ok(completed.resources.treasury>0);
 const formation=events.find(event=>event.event==='northernMissionLocalFormation');assert.equal(formation.occupiedSquads,5);assert.deepEqual(formation.envoyMembers,[1]);assert.equal(completed.activeSquadId,formation.envoySquad);assert.equal(completed.squads.filter(squad=>squad.members.length).length,5);
 for(const id of losses)assert.equal(completed.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(completed.operativeState[id].alive,false);
 for(const id of completed.recruited.filter(id=>completed.operativeState[id].alive&&!completed.operativeState[id].captured)){assert.ok(completed.operativeState[id].hp>=15);assert.equal(completed.operativeState[id].bleeding,0);}
 assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);assert.deepEqual(start,before);
 assert.deepEqual([completed.hour,completed.secondOfHour],[378,2528]);assert.equal(completed.resources.treasury,98868);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],status:result.battle.status,turns:result.battle.turn,actions:result.actions,shots:shots.length,losses,localAidSeconds:0,actualRoadDoctor:relief.doctor,roadHours:relief.hours,dressingsUsed:relief.dressingsUsed,occupiedSquads:formation.occupiedSquads,yatastoClock:[completed.hour,completed.secondOfHour],treasury:completed.resources.treasury,exactBattleReplay:true,officialRoadAidMidpoint:true}));
});
