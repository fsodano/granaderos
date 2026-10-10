import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,contractQuote} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,weaponFor} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

export const physicalNearMissActor=(battle,id='110')=>battle.units.find(unit=>unit.id===id);
export const physicalNearMissSaved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const campaignOrder=(pair,action)=>{
 const before=structuredClone(pair),campaign=dispatchCampaign(pair.campaign,action);
 assert.equal(campaign.lastError,null,campaign.lastError);
 assert.deepEqual(pair,before,'a paid campaign order must not change its input');
 return physicalNearMissSaved({campaign});
};

// Paid native actors and current authored weapons enter through the ordinary
// campaign handoff. This is a declared firing boundary, not a conquest proof:
// only flat terrain, positions/facing, weather, AP and the representative seeds
// are prepared before its first official admission. No health, skill, finite
// item, charge, condition, outcome or learning credit is assigned.
export function preparedPhysicalNearMiss({control='near',omittedSpeech=false}={}){
 assert.ok(['near','stop','misfire','hit'].includes(control));
 const content=defaultContentPackage();
 if(omittedSpeech)for(const character of content.characters){delete character.speech.near;delete character.speech.interrupt;}
 const paidInitial=physicalNearMissSaved({campaign:initialCampaign(8,content)}),paidHistory=[],quotes=[];
 let pair=paidInitial;
 for(const id of [110,107]){
  const quote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(unit=>unit.id===id),'week');
  assert.ok(quote.available&&quote.price>0);quotes.push({id,price:quote.price});
  const action={type:'recruitCivic',id,term:'week'};pair=campaignOrder(pair,action);paidHistory.push(action);
 }
 for(const action of [{type:'wait',hours:6},{type:'attack',sector:'buenos_aires'}]){
  if(action.type==='attack'){
   const campaign=dispatchCampaign(pair.campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
   const handed=prepareCampaignBattle(campaign);assert.equal(handed.error,null,handed.error);
   pair=physicalNearMissSaved(handed);
  }else pair=campaignOrder(pair,action);
  paidHistory.push(action);
 }
 assert.equal(pair.campaign.resources.treasury,3200-quotes.reduce((sum,quote)=>sum+quote.price,0));
 const handoff=physicalNearMissSaved(pair),request=pair.campaign.pendingBattle,issued=structuredClone({squad:request.squad,enemies:request.enemies});
 const width=32,height=16,tiles=Array.from({length:width*height},(_,index)=>({x:index%width,y:Math.floor(index/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
 const wallEdges=control==='stop'?[{id:'early-stop',x:6,y:4,axis:'x',type:'wall',material:'stone',blocked:true,blocksSight:false,cover:100}]:[];
 const clinical={width,height,seed:control==='hit'?8:3,weather:control==='misfire'?{rain:100,humidity:100}:{rain:0,humidity:0},
  positions:{110:{x:9,y:3,facing:6},107:{x:12,y:7,facing:6}},sourceId:'enemy-1',source:{x:1,y:3,facing:2},
  ap:{source:12,other:0},control};
 const battle=createBattle(request.squad.map(unit=>({...unit,...clinical.positions[unit.id]})),{
  ...request,width,height,seed:clinical.seed,weather:clinical.weather,regionalWeather:false,tiles,wallEdges,props:[],
  enemies:request.enemies.map((unit,index)=>({...unit,...(unit.id===clinical.sourceId?clinical.source:{x:27+index%3,y:10+Math.floor(index/3),facing:2}),patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,index)=>({...npc,x:31-index,y:15})),
 });
 for(const unit of battle.units)unit.ap=unit.id===clinical.sourceId?clinical.ap.source:clinical.ap.other;
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 pair=physicalNearMissSaved({campaign:pair.campaign,battle});
 const source=physicalNearMissActor(pair.battle,clinical.sourceId),weapon=weaponFor(source);
 assert.equal(weapon.id,1800);assert.deepEqual(weapon.projectileEnergy,{model:'kinetic-energy-v1',massGrams:32,muzzleVelocityMps:265});
 assert.deepEqual(weapon.projectileAirDrag,{model:'range-energy-retention-v1',retentionAtRange:.8});
 for(const unit of pair.battle.units){
  const original=(unit.side==='player'?issued.squad:issued.enemies).find(body=>String(body.id)===unit.id);assert.ok(original);
  const handed=handoff.battle.units.find(body=>body.id===unit.id);assert.ok(handed);
  for(const key of ['hp','maxHp','energy','bleeding','bandaged','agility','dexterity','wisdom','marksmanship','medical','mechanical','loaded','ammo','condition','medkits','inventory','weaponMetadata','bladeMetadata'])
   assert.deepEqual(unit[key],handed[key],`the firing boundary preserves the actual handed-off ${unit.id}.${key}`);
  for(const key of ['hp','loaded','ammo','condition','medkits','inventory','weaponMetadata','bladeMetadata'])
   if(original[key]!==undefined)assert.deepEqual(unit[key],original[key],`the declared boundary preserves issued ${unit.id}.${key}`);
 }
 return {pair,paidInitial,paidHistory,handoff,quotes,issued,clinical};
}

export function replayPhysicalNearMissPaidPrefix(preparation){
 let pair=physicalNearMissSaved(preparation.paidInitial);
 for(const action of preparation.paidHistory){
  if(action.type==='attack'){
   const campaign=dispatchCampaign(pair.campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
   const handed=prepareCampaignBattle(campaign);assert.equal(handed.error,null,handed.error);pair=physicalNearMissSaved(handed);
  }else pair=campaignOrder(pair,action);
 }
 return pair;
}

export function issuePhysicalNearMiss(pair,action,history){
 const before=pair,input=structuredClone(pair),ending=action.type==='endTurn';
 const ordinary=ending?endTurn(pair.battle):actBattle(pair.battle,action),shown=ending?presentedEndTurn(pair.battle):presentedActBattle(pair.battle,action);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(shown.state,ordinary);
 assert.deepEqual(pair,input,'ordinary execution and presentation preserve the official input');
 const synced=syncBattleTime(pair.campaign,ordinary);assert.equal(synced.error,null,synced.error);
 const next=physicalNearMissSaved(synced);history?.push(structuredClone(action));
 return {before,ordinary,shown,pair:next};
}

export function performPhysicalNearMiss(preparation){return issuePhysicalNearMiss(preparation.pair,{type:'endTurn'});}
