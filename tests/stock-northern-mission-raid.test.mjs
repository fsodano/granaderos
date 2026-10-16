import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeInTransit,operativeLocation} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,presentedActBattle,presentedEndTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {TRANSPORT_NETWORKS} from '../game/transport-network.js';
import {advanceStockNorthernMissionHour} from './fresh-northern-command.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const canonical=c=>{const result=structuredClone(c);for(const key of ['sectorStates','sceneStates'])for(const id of Object.keys(result[key]??{}))result[key][id]=expandCellScene(result[key][id]);return result;};
const saved=pair=>{const restored=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(canonical(restored.campaign),canonical(pair.campaign));assert.deepEqual(restored.battle,pair.battle??null);return restored;};
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};

// This safe finite encounter exercises the actual mission-hour seam. It does
// not represent the installed cohort's morale or its thirteen-person raid.
// All people, wounds, ammunition, map and scheduled invasion precede factory.
function setup({raid=true}={}){
 const d=scaffoldDocuments('declared-stock-mission-raid');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','salta').replaceAll('"camp"','"tucuman"').replaceAll('camp:','tucuman:'));
 d.content.rules.startingTreasury=1000;d.content.rules.deploymentCartridges=12;
 d.content.startingTerritory.salta={owner:'patriot',loyalty:65};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.arrivalFacilities.salta=['barracks'];d.content.arrivalSites.push({sector:'salta',facilities:['barracks']});
 d.world.expansion.buildingTargets={tucuman:0,salta:0};
 d.world.exitLinks=[['tucuman','E',19,8,'salta','W',0,8]];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:12,axis:['salta']}}};
 d.content.weapons.push(structuredClone(defaultContentPackage().weapons.find(weapon=>weapon.id==='firearm-1800')));
 const base=d.content.characters[0];
 d.content.characters=Array.from({length:5},(_,i)=>({...structuredClone(base),id:'mission-'+i,name:'Misión '+i,nickname:'Misión '+i,monthlyPay:30,arrivalHours:0,serviceGuarantee:0,weapon:'firearm-1800',
  attributes:{...base.attributes,maxHp:80,strength:80,leadership:i===0?90:60,marksmanship:90,medical:i===4?90:20},
  startingSupplies:{rations:0,torches:0,medkits:2,boleadoras:0},
  startingCondition:{hp:i===4?70:80,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id),envoyId=ids[0],localIds=ids.slice(1);let hireCost=0;
 for(const id of ids){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
  c=order(c,{type:'recruitCivic',id,term:'day',destination:'salta'});assert.equal(cash-c.resources.treasury,quote.total);hireCost+=quote.total;
 }
 c=order(c,{type:'createSquad',sector:'salta',name:'Puesto del norte',ids});const home=c.activeSquadId;
 c=order(c,{type:'visitSector'});const initial=enterSector(c.pendingBattle,c.sectorStates.salta),pair=syncBattleTime(c,initial);assert.equal(pair.error,null);
 c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 c=order(c,{type:'createSquad',sector:'salta',name:'Enlace de Yatasto',ids:[envoyId]});const envoySquad=c.activeSquadId;
 const network=TRANSPORT_NETWORKS.find(row=>row.id==='posta'),cash=c.resources.treasury;c=order(c,{type:'transport',mode:'posta'});assert.equal(cash-c.resources.treasury,network.cost);
 assert.equal(c.resources.treasury,1000-hireCost-network.cost);
 c=order(c,{type:'wait',hours:11});assert.equal(c.hour,11);assert.equal(c.pendingEncounter,null);assert.equal(c.enemyGroups.length,0);
 c=order(c,{type:'travel',sector:'tucuman',queue:true,mode:'posta'});const journey=c.squads.find(q=>q.id===envoySquad).journey;
 assert.equal(journey.status,'moving');assert.equal(journey.legHours,4);assert.deepEqual(journey.path,['salta','tucuman']);
 assert.ok(ids.every(id=>contractExpiresSeconds(c.contracts[id])>clock(c)+8*3600),'Actual paid terms cover the bounded journey and defense.');
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,ids,localIds,envoyId,envoySquad,home};
}

function replayDefense(input,completion,active){
 const initial=syncBattleTime(input.campaign,input.battle);assert.equal(initial.error,null);
 let pair=saved({campaign:initial.campaign,battle:initial.battle});
 for(const [index,action]of completion.orders.entries()){
  const original=structuredClone(pair.battle),finish=action.type==='endTurn';
  const direct=finish?endTurn(pair.battle):actBattle(pair.battle,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  const shown=finish?presentedEndTurn(pair.battle).state:presentedActBattle(pair.battle,action).state;assert.deepEqual(shown,direct);
  const validated=validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),validatedNext=finish?endTurn(validated):actBattle(validated,action);assert.deepEqual(validatedNext,direct);assert.deepEqual(pair.battle,original);
  const synchronized=syncBattleTime(pair.campaign,direct);assert.equal(synchronized.error,null);pair={campaign:synchronized.campaign,battle:synchronized.battle};
  if(index===Math.floor(completion.orders.length/2))pair=saved(pair);
 }
 const request=pair.campaign.pendingBattle;
 let c=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 c=order(c,{type:'selectSquad',id:active});assert.deepEqual(canonical(saved({campaign:c}).campaign),canonical(completion.campaign));
}

test('a real Salta raid during the paid envoy journey earns Native victory, finite aid and paired replay before that same envoy arrives',()=>{
 const prepared=setup(),start=prepared.campaign,before=structuredClone(start),events=[],report=event=>events.push(structuredClone(event));
 let c=advanceStockNorthernMissionHour(start,{report});assert.equal(c.hour,12);assert.equal(c.pendingEncounter,null);
 const marching=c.enemyGroups[0];assert.equal(marching.status,'marching');assert.equal(marching.units.length,3);assert.equal(marching.nextArrivalAt,13);
 assert.equal(operativeInTransit(c,prepared.envoyId),true);assert.deepEqual(c.squads.find(q=>q.id===prepared.envoySquad).journey.path,['salta','tucuman']);
 const beforeRaid=c;c=advanceStockNorthernMissionHour(c,{report});
 const accepted=events.find(event=>event.event==='northernMissionRaid'),input=events.find(event=>event.event==='northernHandoverDefenseInput'),complete=events.find(event=>event.event==='northernHandoverDefenseReplay');
 assert.ok(accepted&&input&&complete);assert.equal(accepted.campaign.pendingEncounter.sector,'salta');assert.equal(accepted.campaign.pendingEncounter.groupId,marching.id);assert.equal(accepted.campaign.hour,13);
 assert.equal(operativeInTransit(accepted.campaign,prepared.envoyId),true);assert.equal(accepted.campaign.activeSquadId,prepared.envoySquad);
 const request=input.campaign.pendingBattle;assert.equal(request.defenseGroupId,marching.id);assert.equal(request.sector,'salta');assert.deepEqual(request.enemies,marching.units);
 assert.deepEqual(request.squad.map(op=>op.id).sort((a,b)=>a-b),[...prepared.localIds].sort((a,b)=>a-b));assert.ok(!request.squad.some(op=>op.id===prepared.envoyId));
 assert.equal(complete.status,'victory');assert.equal(complete.exactSavedReplay,true);assert.ok(complete.orders.some(action=>action.type==='fire'));assert.ok(complete.orders.some(action=>action.type==='useItem'),'Real finite care must occur in the issued defense or its ordinary post-victory aid.');
 const initialKits=request.squad.reduce((n,op)=>n+op.medkits,0),remainingKits=prepared.localIds.reduce((n,id)=>n+complete.campaign.operativeState[id].medkits,0);
 assert.equal(initialKits-remainingKits,complete.orders.filter(action=>action.type==='useItem').length);assert.ok(remainingKits>=0);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.enemyGroups.find(group=>group.id===marching.id).status,'defeated');assert.equal(c.activeSquadId,prepared.envoySquad);assert.deepEqual(c.squad,[prepared.envoyId]);
 assert.equal(c.operativeState[prepared.envoyId].hp,start.operativeState[prepared.envoyId].hp);assert.equal(c.operativeState[prepared.envoyId].medkits,start.operativeState[prepared.envoyId].medkits);
 assert.deepEqual(c.squads.find(q=>q.id===prepared.home).members,prepared.localIds);assert.equal(c.sectors.salta.owner,'patriot');assert.equal(c.defeated,false);
 replayDefense(input,complete,prepared.envoySquad);
 for(let h=0;h<48&&c.squads.find(q=>q.id===prepared.envoySquad).journey;h++)c=advanceStockNorthernMissionHour(c,{report});
 assert.equal(c.squads.find(q=>q.id===prepared.envoySquad).journey,undefined);assert.equal(c.location,'tucuman');assert.equal(operativeLocation(c,prepared.envoyId),'tucuman');
 for(const id of prepared.localIds)assert.equal(operativeLocation(c,id),'salta');
 assert.ok(clock(c)>clock(beforeRaid));assert.ok(clock(c)-clock(start)<=8*3600);assert.ok(prepared.ids.every(id=>contractExpiresSeconds(c.contracts[id])>clock(c)));
 assert.deepEqual(c.contracts,start.contracts);assert.equal(events.filter(event=>event.event==='northernMissionRaid').length,1);assert.deepEqual(start,before);saved({campaign:c});
});

test('without a raid the mission-hour seam is exactly the ordinary paid Native wait and preserves the queued envoy',()=>{
 const prepared=setup({raid:false}),before=structuredClone(prepared.campaign),events=[],expected=order(prepared.campaign,{type:'wait',hours:1}),actual=advanceStockNorthernMissionHour(prepared.campaign,{report:event=>events.push(event)});
 assert.deepEqual(actual,expected);assert.deepEqual(events,[]);assert.deepEqual(prepared.campaign,before);assert.equal(clock(actual)-clock(before),3600);assert.equal(actual.activeSquadId,prepared.envoySquad);assert.equal(operativeInTransit(actual,prepared.envoyId),true);saved({campaign:actual});
});

test('an already pending encounter cannot be skipped by another mission hour',()=>{
 const prepared=setup();let c=order(prepared.campaign,{type:'wait',hours:1});c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'salta');const before=structuredClone(c);
 assert.throws(()=>advanceStockNorthernMissionHour(c));assert.deepEqual(c,before);
});
