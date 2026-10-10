import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {incomeSummary} from '../game/economy.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {queueSquadTravel} from '../game/squad-travel.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {resolveStockCuyoBatteryEncounter} from './stock-cuyo-battery-defense.mjs';

test('earned stock battery resolves its actual Córdoba raid, uses two finite dressings and delivers original guns with exact defense replay',t=>{
 const compressed=readFileSync(new URL('./fixtures/stock-cuyo-native-edge-battery-ready.save.json.gz',import.meta.url));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/stock-cuyo-native-edge-battery-ready.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],keepServing=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),retained=[...keepServing];
 assert.deepEqual([start.hour,start.secondOfHour],[426,1356]);assert.equal(start.location,'cordoba');assert.deepEqual(start.squad,[1,0,8,127,140]);assert.equal(start.pendingEncounter,null);
 let interrupted=null,stage=null;
 const result=prepareRouteBattery(start,['bronze4','bronze4'],{destination:'cordoba',keepServing,report:event=>events.push(structuredClone(event)),resolveEncounter:(campaign,context)=>{assert.equal(interrupted,null);interrupted=structuredClone(campaign);stage=context.stage;return resolveStockCuyoBatteryEncounter(campaign,context);}});
 const completed=result.campaign;assert.equal(stage,'crew-travel');assert.deepEqual([interrupted.hour,interrupted.secondOfHour],[438,1356]);assert.equal(interrupted.location,'tucuman');assert.equal(interrupted.pendingEncounter.sector,'cordoba');assert.equal(interrupted.pendingEncounter.groupId,'enemy-group-3');
 assert.equal(completed.sectors.cordoba.owner,'patriot');assert.deepEqual(result.selections,['depot:arsenal:buenos_aires:1','depot:arsenal:cordoba:1']);assert.deepEqual([completed.hour,completed.secondOfHour],[457,1425]);assert.equal(completed.location,'cordoba');assert.equal(completed.pendingBattle,null);assert.equal(completed.pendingEncounter,null);
 const defense=events.find(event=>event.event==='stockCuyoBatteryDefenseComplete'),settled=events.find(event=>event.event==='stockCuyoBatteryDefenseSettled').campaign;
 assert.deepEqual(defense.losses,[133,117,116,107,9]);assert.equal(defense.turns,7);assert.equal(defense.actions,209);assert.equal(defense.battleSeconds,42);assert.equal(defense.careSeconds,3627);
 const care=events.find(event=>event.event==='stockCuyoBatteryDefenseHourlyCare'),aid=events.find(event=>event.event==='northernRoadRelief');
 assert.equal(care.doctor,146);assert.equal(care.patientId,108);assert.equal(care.hpBefore,6);assert.equal(care.hpAfter,6);assert.equal(care.dressingsUsed,1);assert.equal(aid.doctor,146);assert.equal(aid.patientId,108);assert.equal(aid.hours,0);assert.equal(aid.dressingsUsed,1);assert.equal(aid.elapsedSeconds,26);
 assert.equal(settled.operativeState[146].medkits,2);assert.equal(defense.campaign.operativeState[146].medkits,0);assert.equal(defense.campaign.operativeState[108].hp,15);assert.equal(defense.campaign.operativeState[108].bleeding,0);assert.equal(completed.operativeState[146].medkits,0);assert.equal(completed.operativeState[108].hp,18);assert.equal(completed.operativeState[108].bleeding,0);
 for(const id of defense.losses)assert.equal(completed.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(completed.operativeState[id].alive,false);
 let request=dispatchCampaign(interrupted,{type:'respondToEncounter',groupId:'enemy-group-3',choice:'tactical'});assert.equal(request.lastError,null);
 const initial=enterSector(request.pendingBattle,request.sectorStates.cordoba),battle=fight(request.pendingBattle,request.sectorStates.cordoba,{controller:cautiousCombatOrder});assert.equal(battle.battle.status,'victory');assert.equal(battle.actions,209);
 let pair={campaign:request,battle:initial};
 for(let index=0;index<battle.orders.length;index++){
  const action=battle.orders[index],next=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(next.lastError,null);const synced=syncBattleTime(pair.campaign,next);assert.equal(synced.error,null);pair={campaign:synced.campaign,battle:synced.battle};
  if(index===Math.floor(battle.orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 }
 const direct=syncBattleTime(request,battle.battle);assert.equal(direct.error,null);assert.deepEqual(pair,{campaign:direct.campaign,battle:direct.battle});
 const replayed=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:request.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(unit=>unit.side==='player'),sectorState:pair.battle});assert.equal(replayed.lastError,null);assert.deepEqual(decodeSave(encodeSave(replayed)).campaign,settled);
 for(const selection of result.selections){const id=selection.slice(6),source=Object.values(start.sectorStates).flatMap(scene=>scene.artillery??[]).find(gun=>gun.id===id)??Object.values(start.artilleryDepots).flat().find(gun=>gun.id===id);assert.ok(source);assert.deepEqual(completed.artilleryDepots.cordoba.find(gun=>gun.id===id),storedArtilleryRecord(source));}
 const selectedIds=result.selections.map(selection=>selection.slice(6));assert.ok(!completed.artilleryTransfers.some(transfer=>selectedIds.includes(transfer.id)));
 const renewals=events.filter(event=>['routeBatteryRenewal','stockCuyoBatteryDefenseRenewal'].includes(event.event)).reduce((sum,event)=>sum+event.price,0),shipments=events.filter(event=>event.event==='routeBatteryShipment').reduce((sum,event)=>sum+event.cost,0),midnights=Math.floor(completed.hour/24)-Math.floor(start.hour/24);
 let routePlanning=structuredClone(start);for(const id of start.squad){routePlanning=dispatchCampaign(routePlanning,{type:'assignCare',id,assignment:'active'});assert.equal(routePlanning.lastError,null);}const routeLegs=[['cordoba','buenos_aires'],['buenos_aires','tucuman'],['tucuman','cordoba']].reduce((sum,[from,to])=>{const draft={...routePlanning.squads.find(squad=>squad.id===routePlanning.activeSquadId),location:from};delete draft.journey;return sum+queueSquadTravel(routePlanning,draft,{sector:to,mode:'posta'}).path.length-1;},0);assert.equal(routeLegs,4);const postaCost=routeLegs*10;
 assert.deepEqual(completed.townIncome.activations,start.townIncome.activations);assert.equal(incomeSummary(completed).daily,incomeSummary(start).daily);assert.equal(completed.resources.treasury,start.resources.treasury+midnights*incomeSummary(start).daily-renewals-shipments-postaCost);
 assert.deepEqual(keepServing,retained);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],raidClock:[interrupted.hour,interrupted.secondOfHour],turns:defense.turns,actions:defense.actions,losses:defense.losses,finiteDressings:2,careSeconds:defense.careSeconds,deliveryClock:[completed.hour,completed.secondOfHour],guns:result.selections,paidRenewals:renewals,postaCost,midnights,exactBattleReplay:true,officialMidpoint:true}));
});
