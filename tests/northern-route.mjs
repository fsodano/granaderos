import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';

// Continue the real opening result through ordinary recovery, contracts,
// finite sector equipment, and a new authored battle. Never synthesize victory.
export function prepareNorthernSquad(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.flags.sanLorenzo,true);assert.equal(campaign.phase,2);assert.equal(campaign.location,'san_nicolas');
 const events=[],dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive);
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const doctor=112,patients=[110,116];
 const hireCash=campaign.resources.treasury;
 order({type:'recruitCivic',id:doctor,term:'week'});
 assert.ok(campaign.resources.treasury<hireCash);
 const beforeSupplies=campaign.operativeState[doctor].medkits;
 const supplies=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').sort((a,b)=>b.count-a.count)[0];
 assert.ok(supplies?.count>=12,'the actual opening leaves twelve discovered, reachable dressings');
 order({type:'sectorInventory',sector:'san_nicolas',operativeId:doctor,direction:'take',sourceKey:supplies.key,expected:supplies.expected,count:12});
 assert.equal(campaign.operativeState[doctor].medkits,beforeSupplies+12);
 const remaining=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),doctor).entries.find(row=>row.key===supplies.key)?.count??0;
 assert.equal(remaining,supplies.count-12);
 const recoveryStart=campaign.hour,medicalStart=campaign.operativeState[doctor].medkits;
 order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<40;i++){
  assert.equal(campaign.pendingEncounter,null,'recovery must resolve a real encounter before continuing');
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 assert.ok(campaign.hour>recoveryStart);assert.equal(medicalStart-campaign.operativeState[doctor].medkits,12);
 for(const operativeId of [doctor,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;
 for(let i=0;campaign.hour<restUntil&&i<20;i++)order({type:'wait',hours:restUntil-campaign.hour});
 assert.equal(campaign.hour,restUntil);assert.equal(campaign.operativeState[doctor].energy,100);
 report({event:'recovered',hour:campaign.hour,doctor,usedDressings:12,patients:patients.map(id=>({id,hp:campaign.operativeState[id].hp,morale:campaign.operativeState[id].morale}))});
 // Short contracts are bought immediately before the march, at their real price.
 for(const id of [128,142,105])order({type:'recruitCivic',id,term:'day'});
 const ids=[1000,115,doctor,128,142,105];
 order({type:'squad',ids});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
 assert.deepEqual(campaign.squad,ids);
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of ids){assert.ok(campaign.operativeState[id].hp>=15);assert.equal(campaign.operativeState[id].bleeding,0);}
 const saved=decodeSave(encodeSave(campaign)).campaign;assert.deepEqual(saved,campaign);
 return {campaign:saved,events,dead,recovery:{startHour:recoveryStart,endHour:campaign.hour,doctor,usedDressings:12,sourceKey:supplies.key,sourceRemaining:remaining}};
}

export function fightNorthernSector(start,sector,{report=()=>{}}={}){
 const before=structuredClone(start),campaign=dispatchCampaign(start,{type:'attack',sector});assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(start,before);assert.ok(campaign.pendingBattle,'the real march produces a tactical deployment');
 const request=campaign.pendingBattle;
 report({event:'battleStarted',sector,hour:campaign.hour,units:request.squad.map(u=>u.id)});
 const result=fight(request,campaign.sectorStates[sector]);
 const summary={sector,status:result.battle.status,turns:result.battle.turn,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});
 assert.equal(result.battle.status,'victory',JSON.stringify(summary));
 const replay=fight(request,campaign.sectorStates[sector]);assert.deepEqual(replay.battle,result.battle);
 const pair=syncBattleTime(campaign,result.battle);assert.equal(pair.error,null);
 const restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 const returned=dispatchCampaign(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',survivors:restored.battle.units.filter(u=>u.side==='player'),sectorState:restored.battle});
 assert.equal(returned.lastError,null,returned.lastError);assert.equal(returned.sectors[sector].owner,'patriot');assert.equal(returned.pendingBattle,null);
 for(const u of result.battle.units.filter(u=>u.side==='player'&&u.hp<=0))assert.equal(returned.operativeState[Number(u.id)].alive,false);
 assert.deepEqual(decodeSave(encodeSave(returned)).campaign,returned);
 return {campaign:returned,summary};
}
