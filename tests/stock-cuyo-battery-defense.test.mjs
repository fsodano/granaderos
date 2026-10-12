import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {incomeSummary} from '../game/economy.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {queueSquadTravel} from '../game/squad-travel.js';
import {fight} from './opening-driver.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {prepareStockCuyoBatteryGuard,stockCuyoBatteryDefenseOrder,resolveStockCuyoBatteryEncounter} from './stock-cuyo-battery-defense.mjs';

test('earned stock battery pays for its arriving guard, resolves the actual raid and delivers original guns after finite timely aid and exact replay',t=>{
 const compressed=readFileSync(new URL('./fixtures/stock-cuyo-native-edge-battery-ready.save.json.gz',import.meta.url));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/stock-cuyo-native-edge-battery-ready.provenance.json',import.meta.url)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(sha(compressed),metadata.gzipSha256);
 const raw=gunzipSync(compressed);assert.equal(sha(raw),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],keepServing=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),retained=[...keepServing];
 assert.deepEqual([start.hour,start.secondOfHour],[426,1356]);assert.equal(start.location,'cordoba');assert.deepEqual(start.squad,[1,0,8,127,140]);assert.equal(start.pendingEncounter,null);
 // This older source-pinned preparation has expensive authored hires. Book
 // the real guard before the journey, rather than inserting a defender into
 // the already interrupted deployment or rewriting an existing soldier.
 const guard=prepareStockCuyoBatteryGuard(start,{report:event=>events.push(structuredClone(event))}),quoted=contractQuote(start,rosterFor(start).find(op=>op.id===guard.guardId),'day');
 assert.equal(guard.guardId,142);assert.equal(guard.quote.price,quoted.price);assert.equal(guard.quote.price,7740);assert.equal(guard.campaign.resources.treasury,start.resources.treasury-quoted.price);
 assert.equal(guard.campaign.recruited.includes(guard.guardId),false);assert.equal(guard.campaign.contracts[guard.guardId],undefined);assert.deepEqual([guard.arrival.bookedAt,guard.arrival.bookedSecond,guard.arrival.dueAt,guard.arrival.dueSecond],[426,1356,432,1356]);assert.equal(guard.arrival.serviceHours,24);
 let interrupted=null,stage=null;
 const result=prepareRouteBattery(guard.campaign,['bronze4','bronze4'],{destination:'cordoba',keepServing,report:event=>events.push(structuredClone(event)),resolveEncounter:(campaign,context)=>{assert.equal(interrupted,null);interrupted=structuredClone(campaign);stage=context.stage;return resolveStockCuyoBatteryEncounter(campaign,context);}});
 const completed=result.campaign;assert.equal(stage,'crew-travel');assert.deepEqual([interrupted.hour,interrupted.secondOfHour],[438,1356]);assert.equal(interrupted.location,'tucuman');assert.equal(interrupted.pendingEncounter.sector,'cordoba');assert.equal(interrupted.pendingEncounter.groupId,'enemy-group-3');
 assert.equal(interrupted.hiringArrivals.some(arrival=>arrival.operativeId===guard.guardId),false);assert.equal(interrupted.recruited.includes(guard.guardId),true);assert.deepEqual([interrupted.contracts[guard.guardId].started,interrupted.contracts[guard.guardId].startedSecond,interrupted.contracts[guard.guardId].expiresAt,interrupted.contracts[guard.guardId].expiresSecond],[432,1356,456,1356]);
 assert.equal(completed.sectors.cordoba.owner,'patriot');assert.deepEqual(result.selections,['depot:arsenal:buenos_aires:1','depot:arsenal:cordoba:1']);assert.deepEqual([completed.hour,completed.secondOfHour],[456,1405]);assert.equal(completed.location,'cordoba');assert.equal(completed.pendingBattle,null);assert.equal(completed.pendingEncounter,null);
 const defense=events.find(event=>event.event==='stockCuyoBatteryDefenseComplete'),settled=events.find(event=>event.event==='stockCuyoBatteryDefenseSettled').campaign;
 assert.deepEqual(defense.losses,[117,116,107,130]);assert.equal(defense.turns,6);assert.equal(defense.actions,122);assert.equal(defense.battleSeconds,36);
 const care=events.filter(event=>event.event==='stockCuyoBatteryDefenseFirstAid'),aidStarts=events.filter(event=>event.event==='stockCuyoBatteryDefenseAidStarted');assert.equal(care.length,2);assert.equal(aidStarts.length,care.length);
 assert.deepEqual(care.flatMap(event=>event.patientsBefore.map(patient=>patient.id)).sort((a,b)=>a-b),[102,104,108]);assert.equal(settled.operativeState[104].hp,1);assert.equal(settled.operativeState[104].bleeding,4);
 for(const patient of [102,104,108]){assert.equal(defense.campaign.operativeState[patient].alive,true);assert.ok(defense.campaign.operativeState[patient].hp>=15);assert.equal(defense.campaign.operativeState[patient].bleeding,0);assert.equal(completed.operativeState[patient].alive,true);assert.ok(completed.operativeState[patient].hp>=15);assert.equal(completed.operativeState[patient].bleeding,0);}
 for(const id of settled.recruited.filter(id=>settled.operativeState[id].alive))assert.equal(completed.operativeState[id].alive,true,'Every actual survivor must remain alive through finite care and delivery.');
 assert.equal(defense.careSeconds,13);assert.equal(defense.careSeconds,care.reduce((sum,event)=>sum+event.elapsedSeconds,0));assert.equal(care.reduce((sum,event)=>sum+event.dressingsUsed,0),5);
 assert.equal(settled.operativeState[146].medkits,2);assert.equal(defense.campaign.operativeState[146].medkits,2);assert.equal(completed.operativeState[146].medkits,2,'The reserved physician keeps the unspent original dressings.');
 assert.equal(settled.operativeState[101].medkits,13);assert.equal(completed.operativeState[101].medkits,13,'The unused nearby stock remains finite and unchanged.');
 for(let index=0;index<care.length;index++){
  const receipt=care[index],entry=aidStarts[index];assert.equal(receipt.stoppedReason,null);assert.equal(receipt.dressingsUsed,receipt.orders.filter(action=>action.type==='useItem').length);
  let aidPair={campaign:entry.campaign,battle:entry.battle};
  for(let step=0;step<receipt.orders.length;step++){const next=actBattle(aidPair.battle,receipt.orders[step]);assert.equal(next.lastError,null);const synced=syncBattleTime(aidPair.campaign,next);assert.equal(synced.error,null);aidPair={campaign:synced.campaign,battle:synced.battle};if(step===Math.floor(receipt.orders.length/2))aidPair=decodeSave(encodeSave(aidPair.campaign,aidPair.battle));}
  const returned=dispatchCampaign(aidPair.campaign,{type:'leaveSector',battleId:aidPair.campaign.pendingBattle.id,sectorState:aidPair.battle,survivors:aidPair.battle.units.filter(unit=>unit.side==='player')});assert.equal(returned.lastError,null);assert.deepEqual(decodeSave(encodeSave(returned)).campaign,receipt.campaign);
  const beforeDressings=entry.ids.reduce((sum,id)=>sum+entry.campaign.operativeState[id].medkits,0),afterDressings=entry.ids.reduce((sum,id)=>sum+receipt.campaign.operativeState[id].medkits,0);assert.equal(beforeDressings-afterDressings,receipt.dressingsUsed);
 }
 assert.equal(completed.recruited.includes(guard.guardId),true);assert.equal(completed.operativeState[guard.guardId].alive,true);assert.ok(contractExpiresSeconds(completed.contracts[guard.guardId])>completed.hour*3600+completed.secondOfHour);
 for(const id of defense.losses)assert.equal(completed.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(completed.operativeState[id].alive,false);
 let request=dispatchCampaign(interrupted,{type:'respondToEncounter',groupId:'enemy-group-3',choice:'tactical'});assert.equal(request.lastError,null);
 assert.deepEqual(request.pendingBattle.artillery,[]);const localOriginal=start.recruited.filter(id=>start.operativeState[id].alive&&start.operativeState[id].location==='cordoba'&&!start.squad.includes(id));assert.equal(localOriginal.length,13);assert.deepEqual(request.pendingBattle.squad.map(unit=>Number(unit.id)).sort((a,b)=>a-b),[...localOriginal,guard.guardId].sort((a,b)=>a-b));
 const initial=enterSector(request.pendingBattle,request.sectorStates.cordoba),battle=fight(request.pendingBattle,request.sectorStates.cordoba,{controller:stockCuyoBatteryDefenseOrder});assert.equal(battle.battle.status,'victory');assert.equal(battle.actions,defense.actions);
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
 assert.deepEqual(completed.townIncome.activations,start.townIncome.activations);assert.equal(incomeSummary(completed).daily,incomeSummary(start).daily);assert.equal(completed.resources.treasury,start.resources.treasury+midnights*incomeSummary(start).daily-quoted.price-renewals-shipments-postaCost);
 assert.deepEqual(keepServing,retained);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(completed)).campaign,completed);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],guardId:guard.guardId,paidGuard:quoted.price,arrivalClock:[interrupted.contracts[guard.guardId].started,interrupted.contracts[guard.guardId].startedSecond],raidClock:[interrupted.hour,interrupted.secondOfHour],turns:defense.turns,actions:defense.actions,losses:defense.losses,finiteDressings:care.reduce((sum,event)=>sum+event.dressingsUsed,0),careSeconds:defense.careSeconds,aid:care.map(({campaign,...event})=>event),deliveryClock:[completed.hour,completed.secondOfHour],guns:result.selections,paidRenewals:renewals,shipments,postaCost,midnights,treasury:completed.resources.treasury,exactBattleReplay:true,exactAidReplay:true,officialMidpoint:true}));
});
