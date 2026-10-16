import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD,DEFAULT_MAPS} from '../campaigns/default.js';
import {blankMap} from '../game/map-schema.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {guaranteeRecord} from '../game/service-guarantees.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';

const actor=110,optional={optionalHistoricalContacts:true};
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const sync=pair=>{const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null);return next;};
const saved=pair=>{const next=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(next,{campaign:pair.campaign,battle:pair.battle??null});return next;};
const deadRecord=campaign=>campaign.civilianState.people['person-0'];
const property=(campaign,id)=>Object.fromEntries(['hp','alive','weapon','condition','weaponInstanceId','weaponFittings','blade','bladeCondition','bladeInstanceId','loaded','ammo','carriedLoaded','carriedAmmo','ammunition','inventory','medkits','rations','torches','boleadoras'].map(key=>[key,structuredClone(campaign.operativeState[id][key])]));

// This authored control declares its territory, flat map, paid hire, contact
// placement and optional preexisting bandaged wound before the fresh factory.
// Its short story keeps legacy contact IDs but does not claim a shipping route.
function setup({casualty=false,absent=false}={}){
 const content=defaultContentPackage();content.world=structuredClone(DEFAULT_WORLD);content.maps=structuredClone(DEFAULT_MAPS);
 content.campaignStory={introduction:'Control de contactos supervivientes.',victory:'Control terminado.',defeat:'Control perdido.',chapters:[{id:'hold',name:'Contacto local',objective:'Reuní a los supervivientes.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 content.includeOriginalResidents=false;content.errands=[];content.quests=[];delete content.roadsideDiscoveries;
 content.headquarters='salta';content.world.defaultHeadquarters='salta';content.rules.startingTreasury=3200;
 for(const id of ['salta','tucuman','cordoba','jujuy','humahuaca'])content.startingTerritory[id]={...content.startingTerritory[id],owner:'patriot'};
 content.world.arrivalFacilities.salta=['barracks'];content.arrivalSites=content.arrivalSites.filter(site=>site.sector!=='salta');content.arrivalSites.push({sector:'salta',facilities:['barracks']});
 content.world.expansion.buildingTargets.salta=0;content.world.physical.caches={};content.world.physical.arsenals={};content.world.physical.environment={};
 const map=blankMap({id:'salta',title:'Contactos de Salta',width:20,height:16});map.spawns=[{id:'player-entry',side:'player',x:3,y:9},{id:'enemy-entry',side:'enemy',x:16,y:8}];content.maps.salta=map;
 for(const id of ['person-0','person-8']){const placement=content.placements.find(row=>row.character===id);Object.assign(placement,{mode:'fixed',sectors:[absent&&id==='person-0'?'tucuman':'salta'],afterDeath:null,delayMin:0,delayMax:0});}
 const hire=content.characters.find(row=>row.id==='person-110');hire.arrivalHours=0;Object.assign(hire.attributes,{leadership:95,strength:95,dexterity:95,agility:95});hire.startingSupplies={rations:2,torches:2,medkits:3,boleadoras:0};
 if(casualty){const target=content.characters.find(row=>row.id==='person-0');target.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:target.attributes.maxHp-1};}
 const declaration=structuredClone(content);assert.deepEqual(validateContentPackage(content),[]);let campaign=initialCampaign(8,content);
 const cash=campaign.resources.treasury,quote=contractQuote(campaign,rosterFor(campaign).find(row=>row.id===actor),'day');assert.equal(quote.available,true);
 campaign=order(campaign,{type:'recruitCivic',id:actor,term:'day',destination:'salta'});assert.equal(campaign.resources.treasury,cash-quote.total);assert.deepEqual(campaign.squad,[actor]);
 if(casualty){
  const departure=campaign.hour*3600+(campaign.secondOfHour??0);campaign=order(campaign,{type:'visitSector'});let pair={campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.salta)};
  pair=sync({...pair,battle:approachNPC(pair.battle,String(actor),'guemes')});
  for(let i=0;i<12&&pair.battle.npcs.find(row=>row.id==='guemes').hp>0;i++){
   const battle=actBattle(pair.battle,{type:'melee',unitId:String(actor),targetId:'guemes'});assert.equal(battle.lastError,null);pair=sync({...pair,battle});
  }
  assert.equal(pair.battle.npcs.find(row=>row.id==='guemes').hp,0);assert.ok(pair.campaign.hour*3600+(pair.campaign.secondOfHour??0)>departure);
  campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(row=>row.side==='player')});
  assert.equal(campaign.operativeState[0].alive,false);assert.ok(deadRecord(campaign).health.civilianHarm.incidents.some(row=>row.kind==='death'));
 }
 assert.deepEqual(content,declaration);campaign=saved({campaign}).campaign;
 return {campaign,content,declaration,quote};
}

test('strict default recruitment still refuses a real dead historical contact',()=>{
 const {campaign}=setup({casualty:true}),before=structuredClone(campaign);
 assert.throws(()=>meetRecruits(campaign,['guemes','macacha'],actor),/El interlocutor no está disponible/);
 // The stopped invocation is terminal; only plain input comparisons follow.
 assert.deepEqual(campaign,before);
});

test('explicit optional Salta admission preserves a Native casualty and recruits the surviving contact',()=>{
 const {campaign,content,declaration}=setup({casualty:true}),before=structuredClone(campaign),death=structuredClone(deadRecord(campaign)),events=structuredClone(campaign.cityLoyaltyEvents),stock=property(campaign,0),carried=property(campaign,actor),cash=campaign.resources.treasury,recruit=contractQuote(campaign,rosterFor(campaign).find(row=>row.id===8));
 assert.equal(recruit.available,true);assert.ok(recruit.total>0&&cash>=recruit.total);
 const result=meetRecruits(campaign,['guemes','macacha'],actor,optional);
 assert.deepEqual(campaign,before);assert.equal(result.recruited.includes(0),false);assert.equal(result.recruited.includes(8),true);
 assert.equal(result.operativeState[0].alive,false);assert.deepEqual(deadRecord(result),death);assert.deepEqual(result.cityLoyaltyEvents,events);assert.deepEqual(property(result,0),stock);assert.deepEqual(property(result,actor),carried);
 assert.equal(result.resources.treasury,cash-recruit.total);
 const contract=result.contracts[8],started=contract.started*3600+(contract.startedSecond??0),guarantee=guaranteeRecord(result,contract);
 assert.equal(contract.paid,recruit.price);assert.equal(contract.term,recruit.term);assert.equal(contract.kind,recruit.permanent?'patriot':'paid');
 assert.equal(guarantee?.amount??0,recruit.guarantee);if(recruit.guarantee)assert.equal(guarantee.state,'held');else assert.equal(contract.guaranteeId,undefined);
 assert.ok(started>=campaign.hour*3600+(campaign.secondOfHour??0)&&started<=result.hour*3600+(result.secondOfHour??0));
 assert.equal(contractExpiresSeconds(contract),recruit.permanent?null:started+recruit.hours*3600);
 assert.equal(result.pendingBattle,null);assert.equal(result.sectorStates.salta.npcs.find(row=>row.id==='guemes').hp,0);assert.equal(result.sectorStates.salta.npcs.some(row=>row.id==='macacha'),false);
 assert.deepEqual(saved({campaign:result}).campaign,result);assert.deepEqual(content,declaration);
});

test('living optional contacts retain the exact successful strict recruitment result',()=>{
 const {campaign}=setup(),before=structuredClone(campaign),strict=meetRecruits(campaign,['guemes','macacha'],actor),result=meetRecruits(campaign,['guemes','macacha'],actor,optional);
 assert.deepEqual(campaign,before);assert.deepEqual(result,strict);assert.ok(result.recruited.includes(0)&&result.recruited.includes(8));assert.deepEqual(saved({campaign:result}).campaign,result);
});

test('explicit optional Salta admission leaves an actually absent contact at its authored location',()=>{
 const {campaign}=setup({absent:true}),before=structuredClone(campaign),record=property(campaign,0),presence=structuredClone(campaign.contentPresence.people['person-0']);
 const result=meetRecruits(campaign,['guemes','macacha'],actor,optional);
 assert.deepEqual(campaign,before);assert.equal(result.recruited.includes(0),false);assert.equal(result.recruited.includes(8),true);assert.deepEqual(property(result,0),record);assert.deepEqual(result.contentPresence.people['person-0'],presence);assert.deepEqual(saved({campaign:result}).campaign,result);
});
