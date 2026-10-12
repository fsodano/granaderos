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
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareStockCuyoBatteryReserve,stockCuyoBatteryReservePosts} from './stock-cuyo-reserve-readiness.mjs';
import {prepareCreatedMendozaAssault} from './created-cuyo-route.mjs';
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
 const posts=[[108,14,21],[104,14,20],[102,14,19],[146,14,18],[119,13,21],[133,13,20],[101,13,19],[121,13,18],[117,12,21],[116,12,20],[107,12,19],[130,12,18],[9,11,21]].map(([id,x,y])=>({id,x,y,tacticalLevel:1}));
 assert.deepEqual(stockCuyoBatteryReservePosts(start),posts);
 const reserve=prepareStockCuyoBatteryReserve(start,posts,{report:event=>events.push(structuredClone(event))});
 assert.deepEqual(reserve.preparation.startClock,[426,1356]);assert.deepEqual(reserve.preparation.endClock,[426,1435]);assert.equal(reserve.preparation.elapsedSeconds,79);assert.equal(new Set(reserve.preparation.positions.map(post=>`${post.tacticalLevel}:${post.x}:${post.y}`)).size,13);
 assert.deepEqual(reserve.campaign.squads,start.squads);assert.deepEqual(reserve.campaign.contracts,start.contracts);assert.equal(reserve.campaign.resources.treasury,start.resources.treasury);
 for(const [id,weapon]of [[117,1803],[102,1804],[107,1805]]){assert.equal(reserve.preparation.equipmentReady.operativeState[id].weaponDropped,false);assert.equal(sectorInventoryModel(reserve.preparation.equipmentReady,'cordoba',rosterFor(reserve.preparation.equipmentReady),id).personal.weapon,weapon);}
 const roundSource='["body","137","inventory:ammo:musket_75"]',knownCount=c=>sectorInventoryModel(c,'cordoba',rosterFor(c),104).entries.find(row=>row.key===roundSource)?.count??0;
 assert.equal(knownCount(start),11);assert.equal(knownCount(reserve.preparation.equipmentReady),2);assert.equal(reserve.preparation.ammunition.length,1);assert.equal(reserve.preparation.ammunition[0].quantity,9);
 // Independently replay every formation, visit, paid movement and return.
 // A real official midpoint save must keep the same final reserved positions.
 let formation={campaign:reserve.preparation.equipmentReady,battle:null};
 for(let index=0;index<reserve.preparation.journal.length;index++){
  const step=reserve.preparation.journal[index];
  if(step.kind==='campaign'){formation.campaign=dispatchCampaign(formation.campaign,step.action);assert.equal(formation.campaign.lastError,null);}
  else if(step.kind==='enter')formation.battle=enterSector(formation.campaign.pendingBattle,formation.campaign.sectorStates.cordoba);
  else if(step.kind==='battle'){formation.battle=actBattle(formation.battle,step.action);assert.equal(formation.battle.lastError,null);}
  else if(step.kind==='sync'){const pair=syncBattleTime(formation.campaign,formation.battle);assert.equal(pair.error,null);formation={campaign:pair.campaign,battle:pair.battle};}
  else if(step.kind==='leave'){formation.campaign=dispatchCampaign(formation.campaign,{type:'leaveSector',battleId:step.battleId,sectorState:formation.battle,survivors:formation.battle.units.filter(unit=>unit.side==='player')});assert.equal(formation.campaign.lastError,null);formation.battle=null;}
  else assert.fail('Unknown native preparation step.');
  if(index===Math.floor(reserve.preparation.journal.length/2))formation=decodeSave(encodeSave(formation.campaign,formation.battle));
 }
 assert.deepEqual(decodeSave(encodeSave(formation.campaign)).campaign,reserve.campaign);
 const guard=prepareStockCuyoBatteryGuard(reserve.campaign,{report:event=>events.push(structuredClone(event))}),quoted=contractQuote(start,rosterFor(start).find(op=>op.id===guard.guardId),'day');
 assert.equal(guard.guardId,142);assert.equal(guard.quote.price,quoted.price);assert.equal(guard.quote.price,7740);assert.equal(guard.campaign.resources.treasury,start.resources.treasury-quoted.price);
 assert.equal(guard.campaign.recruited.includes(guard.guardId),false);assert.equal(guard.campaign.contracts[guard.guardId],undefined);assert.deepEqual([guard.arrival.bookedAt,guard.arrival.bookedSecond,guard.arrival.dueAt,guard.arrival.dueSecond],[426,1435,432,1435]);assert.equal(guard.arrival.serviceHours,24);
 let interrupted=null,stage=null;
 const result=prepareRouteBattery(guard.campaign,['bronze4','bronze4'],{destination:'cordoba',keepServing,report:event=>events.push(structuredClone(event)),resolveEncounter:(campaign,context)=>{assert.equal(interrupted,null);interrupted=structuredClone(campaign);stage=context.stage;return resolveStockCuyoBatteryEncounter(campaign,context);}});
 const completed=result.campaign;assert.equal(stage,'crew-travel');assert.deepEqual([interrupted.hour,interrupted.secondOfHour],[438,1435]);assert.equal(interrupted.location,'tucuman');assert.equal(interrupted.pendingEncounter.sector,'cordoba');assert.equal(interrupted.pendingEncounter.groupId,'enemy-group-3');
 assert.equal(interrupted.hiringArrivals.some(arrival=>arrival.operativeId===guard.guardId),false);assert.equal(interrupted.recruited.includes(guard.guardId),true);assert.deepEqual([interrupted.contracts[guard.guardId].started,interrupted.contracts[guard.guardId].startedSecond,interrupted.contracts[guard.guardId].expiresAt,interrupted.contracts[guard.guardId].expiresSecond],[432,1435,456,1435]);
 assert.equal(completed.sectors.cordoba.owner,'patriot');assert.deepEqual(result.selections,['depot:arsenal:buenos_aires:1','depot:arsenal:cordoba:1']);assert.deepEqual([completed.hour,completed.secondOfHour],[456,1514]);assert.equal(completed.location,'cordoba');assert.equal(completed.pendingBattle,null);assert.equal(completed.pendingEncounter,null);
 const defense=events.find(event=>event.event==='stockCuyoBatteryDefenseComplete'),settled=events.find(event=>event.event==='stockCuyoBatteryDefenseSettled').campaign;
 assert.deepEqual(defense.losses,[117,121,116,107,130,9]);assert.equal(defense.turns,12);assert.equal(defense.actions,120);assert.equal(defense.battleSeconds,72);
 const care=events.filter(event=>event.event==='stockCuyoBatteryDefenseFirstAid'),aidStarts=events.filter(event=>event.event==='stockCuyoBatteryDefenseAidStarted');assert.equal(care.length,1);assert.equal(aidStarts.length,care.length);
 assert.deepEqual(care.flatMap(event=>event.patientsBefore.map(patient=>patient.id)).sort((a,b)=>a-b),[102,104]);assert.equal(settled.operativeState[102].hp,7);assert.equal(settled.operativeState[102].bleeding,3);assert.equal(settled.operativeState[104].hp,39);assert.equal(settled.operativeState[104].bleeding,2);assert.equal(settled.operativeState[108].hp,84);
 for(const patient of [102,104,108]){assert.equal(defense.campaign.operativeState[patient].alive,true);assert.ok(defense.campaign.operativeState[patient].hp>=15);assert.equal(defense.campaign.operativeState[patient].bleeding,0);assert.equal(completed.operativeState[patient].alive,true);assert.ok(completed.operativeState[patient].hp>=15);assert.equal(completed.operativeState[patient].bleeding,0);}
 for(const id of settled.recruited.filter(id=>settled.operativeState[id].alive))assert.equal(completed.operativeState[id].alive,true,'Every actual survivor must remain alive through finite care and delivery.');
 assert.equal(defense.careSeconds,7);assert.equal(defense.careSeconds,care.reduce((sum,event)=>sum+event.elapsedSeconds,0));assert.equal(care.reduce((sum,event)=>sum+event.dressingsUsed,0),3);
 assert.equal(settled.operativeState[146].medkits,2);assert.equal(defense.campaign.operativeState[146].medkits,2);assert.equal(completed.operativeState[146].medkits,2,'The reserved physician keeps the unspent original dressings.');
 assert.equal(settled.operativeState[101].medkits,13);assert.equal(completed.operativeState[101].medkits,13,'The unused nearby stock remains finite and unchanged.');
 const collected=events.filter(event=>event.event==='stockCuyoBatteryDefenseDressingsCollected');assert.deepEqual(collected.map(row=>[row.sourceKey,row.count]),[['["body","130","medkits"]',1],['["body","137","medkits"]',2],['["body","134","medkits"]',1]]);assert.equal(collected.reduce((sum,row)=>sum+row.count,0),4);
 let recovered=events.find(event=>event.event==='stockCuyoBatteryDefenseMedicalSourceStarted').campaign;
 for(const entry of collected){const old=sectorInventoryModel(recovered,entry.sector,rosterFor(recovered),entry.doctor).entries.find(row=>row.key===entry.sourceKey);assert.ok(old?.reachable);assert.equal(old.expected,entry.action.expected);assert.equal(old.count,entry.beforeCount);recovered=dispatchCampaign(recovered,entry.action);assert.equal(recovered.lastError,null);assert.equal(sectorInventoryModel(recovered,entry.sector,rosterFor(recovered),entry.doctor).entries.find(row=>row.key===entry.sourceKey)?.count??0,entry.afterCount);}
 assert.deepEqual(decodeSave(encodeSave(recovered)).campaign,decodeSave(encodeSave(events.find(event=>event.event==='stockCuyoBatteryDefenseMedicalSourceReady').campaign)).campaign);assert.equal(completed.operativeState[104].medkits,1);
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

// This is the genuine full-route entry, stopped only after its real pre-trip
// preparation report. The complete earned trip above still proves native
// defense, acute aid and delivery; this control proves their caller placement.
test('the real stock Mendoza caller prepares its existing rear and books one specialist before the gun crew leaves',t=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/stock-cuyo-native-edge-battery-ready.save.json.gz',import.meta.url)));
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],stop=new Error('actual pre-battery checkpoint');let checkpoint;
 assert.throws(()=>prepareCreatedMendozaAssault(start,{routeKind:'stock',report:event=>{events.push(event);if(event.event==='stockCuyoPreBatteryReady'){checkpoint=event;throw stop;}}}),error=>error===stop);
 assert.ok(checkpoint);assert.deepEqual(start,before);const c=checkpoint.campaign,preparation=events.find(event=>event.event==='stockCuyoReserveReady');
 assert.ok(preparation);assert.deepEqual(checkpoint.posts,stockCuyoBatteryReservePosts(start));assert.equal(preparation.positions.length,13);assert.equal(preparation.elapsedSeconds,79);assert.deepEqual([c.hour,c.secondOfHour],[426,1435]);
 assert.deepEqual(c.squad,start.squad);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squads,start.squads);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(events.some(event=>event.event==='routeBatteryPrepared'),false);
 assert.deepEqual(checkpoint.specialistIds,[142]);const booked=c.hiringArrivals.find(arrival=>arrival.operativeId===142);assert.ok(booked);assert.deepEqual([booked.bookedAt,booked.bookedSecond,booked.dueAt,booked.dueSecond],[426,1435,432,1435]);assert.equal(booked.paid,7740);assert.equal(booked.serviceHours,24);assert.equal(c.resources.treasury,start.resources.treasury-7740);
 assert.equal(events.filter(event=>event.event==='createdMendozaSupport').length,1);assert.equal(c.hiringArrivals.filter(arrival=>arrival.operativeId===142).length,1);
 for(const [id,record]of Object.entries(start.operativeState))for(const key of ['alive','hp','bleeding','medkits','captured','morale'])assert.deepEqual(c.operativeState[id][key],record[key],id+'.'+key);
 assert.equal(c.operativeState[101].medkits,13);assert.equal(c.operativeState[146].medkits,2);assert.deepEqual(c.artilleryDepots,start.artilleryDepots);assert.deepEqual(c.artilleryTransfers,start.artilleryTransfers);assert.deepEqual(c.artilleryStores,start.artilleryStores);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);t.diagnostic(JSON.stringify({scope:'Actual stock full-route pre-trip caller only; native defense/delivery are covered by the complete preceding case.',clock:[c.hour,c.secondOfHour],rear:checkpoint.posts.map(post=>post.id),specialist:142,paid:7740,arrival:[432,1435],crew:c.squad}));
});
