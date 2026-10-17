import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,presentedActBattle,presentedEndTurn,medicalUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {openingRearFormation} from './opening-rear-medical-supply.mjs';
import {northernReunionEncounterOptions} from './fresh-northern-recovery.mjs';
import {saltaHospitalBattleOptions} from './salta-hospital-encounter.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {openingControlWindow} from './opening-driver.mjs';
import {replayPairedRouteOrders} from './paired-route-battle.mjs';

const sector='tucuman',clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};

function setup({roofCount=5,empty=false}={}){
 const d=scaffoldDocuments('declared-reunion-hospital');
 // Name the scaffold's second locality before compiling any Native input.
 // This updates only the authored map/world references, never a game state.
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0],rifle=defaultContentPackage().weapons.find(w=>w.template===1800);
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=8;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory[sector].owner='patriot';d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:6,axis:[sector]}}};
 d.world.expansion.buildingTargets[sector]=0;
 d.maps[sector].upperSurfaces=Array.from({length:20},(_,i)=>({id:'hospital-roof-'+i,x:8+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'hospital-access',kind:'climb',from:{x:8,y:9,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 d.content.weapons.push({...structuredClone(rifle),id:'hospital-rifle',art:base.portrait});
 d.content.characters=Array.from({length:6},(_,i)=>({...structuredClone(base),id:'hospital-'+i,name:'Guardia '+i,nickname:'Guardia '+i,monthlyPay:300,arrivalHours:0,weapon:'hospital-rifle',
  attributes:{...base.attributes,marksmanship:i===0?45:95,medical:i===0?95:0},startingSupplies:{rations:0,torches:0,medkits:i===0?3:0,boleadoras:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const ids=rosterFor(c).map(op=>op.id),hires=[];
 for(const id of empty?[ids[5]]:ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:id===ids[5]?'camp':sector});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 if(!empty)c=order(c,{type:'createSquad',ids:ids.slice(0,5),sector,name:'Reserva hospitalaria'});
 const beforeCover=saved(c),events=[];
 if(!empty&&roofCount)c=stageRouteRoofDefenders(c,ids.slice(0,roofCount),{report:e=>events.push(e)});
 assert.deepEqual(d,declaration);return {campaign:saved(c),beforeCover,ids,events,hires};
}

function respond(start){
 let c=start;
 for(let n=0;!c.pendingEncounter&&n<10;n++)c=order(c,{type:'wait',hours:1});
 assert.equal(c.pendingEncounter?.sector,sector,'An ordinary wait must release the declared raid.');
 c=order(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 const battle=enterSector(c.pendingBattle,c.sectorStates[sector]),loaded=decodeSave(encodeSave(c,battle));assert.deepEqual(loaded,{campaign:c,battle});return loaded.campaign;
}

function presentedPair(campaign,request,previous,orders){
 let battle=enterSector(request,previous),pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;
 for(const [index,action]of orders.entries()){
  const shown=action.type==='endTurn'?presentedEndTurn(battle):presentedActBattle(battle,action);battle=validateBattleSnapshot(JSON.parse(JSON.stringify(shown.state)));assert.equal(battle.lastError,null);
  pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;
  if(index===Math.floor(orders.length/2)){const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved,{campaign,battle});campaign=saved.campaign;battle=saved.battle;}
 }
 return {campaign,battle};
}

test('the actual paid roof-stage and real raid select one hospital policy per execution, hold the roof and preserve the complete paired replay',()=>{
 const {campaign:staged,beforeCover,ids,events,hires}=setup(),before=structuredClone(staged);
 assert.equal(northernReunionEncounterOptions(beforeCover,sector).executeBattle,undefined);
 assert.equal(openingRearFormation(staged,sector).allCovered,true);assert.ok(clock(staged)>clock(beforeCover));assert.ok(events.some(e=>e.actions?.some(a=>a.type==='move'&&a.tacticalLevel===1)));
 for(const {id,quote}of hires){assert.equal(staged.contracts[id].paid,quote.price);assert.ok(staged.operativeState[id].alive);}
 const prepared=respond(staged),request=prepared.pendingBattle,previous=prepared.sectorStates[sector],initial=enterSector(request,previous),options=northernReunionEncounterOptions(prepared,sector);
 assert.equal(typeof options.executeBattle,'function');assert.equal(options.controller,tucumanCombatOrder);
 const old=openingControlWindow(initial,{controller:tucumanCombatOrder});assert.ok(old.orders.some(a=>a.type==='move'&&(a.tacticalLevel??0)===0),'The former caller sends an actual roof defender to the ground.');
 const result=options.executeBattle(request,previous,options),again=options.executeBattle(request,previous,options);
 assert.equal(result.battle.status,'victory');assert.ok(result.actions>0);assert.deepEqual(again,result,'Replay initializes new roles instead of reusing the first policy closure.');
 assert.equal(result.pair.battle,result.battle);assert.equal(result.pair.battle.syncedSeconds,result.pair.battle.elapsedSeconds);
 assert.ok(result.orders.some(a=>a.type==='fire'));assert.ok(result.orders.filter(a=>a.type==='move').every(a=>a.tacticalLevel===1),'An admitted roof guard keeps the actual paid roof surface.');
 for(const id of ids.slice(0,5))assert.equal(result.battle.units.find(u=>u.id===String(id)).tacticalLevel,1);
 assert.deepEqual(replayPairedRouteOrders(prepared,request,previous,result.orders),result.pair);assert.deepEqual(presentedPair(prepared,request,previous,result.orders),result.pair);
 assert.deepEqual(decodeSave(encodeSave(result.pair.campaign,result.pair.battle)),result.pair);assert.deepEqual(staged,before);
});

test('actual mixed cover, an empty local reserve, other sectors and an explicit controller keep the ordinary caller path',()=>{
 const {campaign:mixed}=setup({roofCount:4}),{campaign:empty}=setup({empty:true}),{campaign:covered}=setup(),explicit=()=>null;
 assert.equal(openingRearFormation(mixed,sector).allCovered,false);
 for(const [c,at]of [[mixed,sector],[empty,sector],[covered,'camp']])assert.deepEqual(northernReunionEncounterOptions(c,at),{controller:tucumanCombatOrder});
 assert.deepEqual(northernReunionEncounterOptions(covered,sector,{encounterController:explicit}),{controller:explicit});
});

test('the reused actual-entry factory keeps adjacent finite aid ahead of the roof hold and pays its real hand and treatment',()=>{
 const surfaces=Array.from({length:9},(_,i)=>({id:'roof-'+i,x:4+i%3,y:4+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 const initial=createBattle([{id:'doctor',x:5,y:5,tacticalLevel:1,weapon:1800,medical:95,medkits:2,activeSlot:'primary'},
  {id:'patient',x:5,y:4,tacticalLevel:1,weapon:1800,hp:55,maxHp:100,bleeding:3,bandaged:0,medical:0,medkits:0}],
 {id:'declared-reunion-roof-aid',width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),upperSurfaces:surfaces,hour:12,seed:42,enemies:[{id:'remote',x:19,y:15,weapon:0,blade:0,patrol:false}]});
 const before=structuredClone(initial),policy=saltaHospitalBattleOptions();assert.equal(policy.admitBattle(initial),initial);
 const hand=policy.controller(initial,initial.units.find(u=>u.id==='doctor'));assert.deepEqual(hand,{type:'weapon',unitId:'doctor',slot:'medical'});
 const held=actBattle(initial,hand);assert.equal(held.lastError,null);const doctor=held.units.find(u=>u.id==='doctor'),patient=held.units.find(u=>u.id==='patient'),quote=medicalUsePreview(held,doctor,patient),aid=policy.controller(held,doctor);assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const treated=actBattle(held,aid);assert.equal(treated.lastError,null);assert.equal(treated.units.find(u=>u.id==='doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(treated.units.find(u=>u.id==='doctor').ap,doctor.ap-quote.cost);assert.equal(treated.units.find(u=>u.id==='patient').bleeding,0);
 const shown=presentedActBattle(presentedActBattle(initial,hand).state,aid).state;assert.deepEqual(shown,treated);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(treated))),treated);assert.deepEqual(initial,before);
});
