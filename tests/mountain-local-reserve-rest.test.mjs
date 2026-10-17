import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,exitPreview} from '../game/tactical.js';
import {boundaryPassable} from '../game/tactical-exits.js';
import {spacePoint} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {mountainReplacementCensus,prepareNativeMountainReserve,NATIVE_MOUNTAIN_RESERVE_BOUNDS} from './fresh-mountain-route.mjs';

const localId=102,remoteId=100,leaderId=118,physicianId=116,exclude=[leaderId,physicianId],replacements=[100,101,102,103,104,108],all=[...exclude,...replacements];
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=(campaign,battle=null)=>{const pair=decodeSave(encodeSave(campaign,battle));assert.deepEqual(pair,{campaign,battle});return pair;};
const physicallyReady=(c,id)=>{const r=c.operativeState[id];return r.hp===r.maxHp&&!r.bleeding&&!r.fatigue&&r.energy===100&&!r.asleep;};
function retainedOrder(c,action){
 const seconds=action.type==='wait'?action.hours*3600:0;
 for(const id of c.recruited){if(!c.operativeState[id].alive)continue;let expiry=contractExpiresSeconds(c.contracts[id]);
  for(let n=0;expiry!==null&&expiry<=clock(c)+Math.max(3600,seconds+1);n++){assert.ok(n<4);const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.pendingEncounter,null);expiry=contractExpiresSeconds(c.contracts[id]);}
 }
 return order(c,action);
}

// A low morale value is not a supported startingCondition. The profile's
// finite equipment, wages and scenario are declared before factory; seven
// actual paid retreats below earn the low morale without a body patch.
function setup({remote=false,nearExpiry=false,raid=false,treasury=50000}={}){
 const content=defaultContentPackage(),kept=new Set(content.characters.filter(p=>Number(p.id.slice(7))<100||all.includes(Number(p.id.slice(7)))).map(p=>p.id));
 content.characters=content.characters.filter(p=>kept.has(p.id));content.placements=content.placements.filter(p=>kept.has(p.character));
 content.headquarters='cordoba';content.startingTerritory=defaultStartingTerritory('cordoba');content.startingTerritory.mendoza={owner:'patriot',loyalty:65};content.rules.startingTreasury=treasury;content.rules.enemyCartridges=0;content.rules.deploymentCartridges=0;
 content.includeOriginalResidents=false;content.errands=[];content.campaignStory={introduction:'Preparación local declarada.',victory:'Objetivo posterior.',defeat:'La campaña termina.',chapters:[{id:'later-goal',name:'Objetivo posterior',objective:'Continuar después de la prueba.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 content.world=structuredClone(DEFAULT_WORLD);content.world.enemyStrategy={version:1,theaters:raid?{cuyo:{legHours:1,reserve:3,raidEveryHours:240,axis:['mendoza']}}:{}};
 const party=remote?[localId,remoteId]:[localId];
 for(const id of all){const person=content.characters.find(p=>p.id===`person-${id}`);person.arrivalHours=0;person.monthlyPay=300;}
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content);const retreats=[];
 for(const id of party){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'month',destination:'mendoza'});assert.equal(cash-c.resources.treasury,quote.total);}
 assert.ok(party.every(id=>c.operativeState[id].morale===80),'The actual Native personal baseline is 80; personality prose does not set morale.');
 c=order(c,{type:'createSquad',sector:'mendoza',ids:party,name:'Retirada física declarada'});c=order(c,{type:'transport',mode:'posta'});
 for(let pass=0;pass<7;pass++){
  for(const id of party)c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});
  const recoveryMorale=Object.fromEntries(party.map(id=>[id,c.operativeState[id].morale]));
  for(let n=0;party.some(id=>!physicallyReady(c,id))&&n<72;n++)c=retainedOrder(c,{type:'wait',hours:1});
  assert.ok(party.every(id=>physicallyReady(c,id)&&c.operativeState[id].assignment==='active'&&c.operativeState[id].morale===recoveryMorale[id]),'Ordinary active recovery pays its real clock without resting morale before another assault.');
  const previousMorale=Object.fromEntries(party.map(id=>[id,c.operativeState[id].morale]));c=retainedOrder(c,{type:'attack',sector:'uspallata',mode:'posta'});
  for(let n=0;!c.pendingBattle&&n<48;n++){assert.equal(c.pendingEncounter,null);const q=c.squads.find(q=>q.id===c.activeSquadId);assert.ok(q.journey);c=retainedOrder(c,q.journey.status==='ready'?{type:'beginAssault',sector:'uspallata'}:{type:'wait',hours:1});}
  assert.ok(c.pendingBattle&&!c.pendingBattle.exploration);let battle=enterSector(c.pendingBattle,c.sectorStates.uspallata),pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;const initial=structuredClone(battle),actions=[];
  const act=action=>{const direct=actBattle(battle,action),shown=presentedActBattle(battle,action).state,validated=validateBattleSnapshot(JSON.parse(JSON.stringify(direct)));assert.equal(direct.lastError,null);assert.deepEqual(shown,direct);assert.deepEqual(validated,direct);pair=syncBattleTime(c,direct);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;actions.push(structuredClone(action));saved(c,battle);};
  const exit=battle.exits.find(e=>e.destination==='mendoza');assert.ok(exit);
  for(const id of party){const actor=battle.units.find(u=>u.id===String(id));if(!boundaryPassable(battle,actor,exit.edge)){const goal=getReachable(battle,actor).filter(p=>boundaryPassable(battle,p,exit.edge)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(goal);act({type:'move',unitId:String(id),...spacePoint(goal)});}}
  const action={type:'exit',unitIds:party.map(String),exitId:exit.id},quote=exitPreview(battle,action);assert.equal(quote.available,true,quote.reason);act(action);assert.equal(battle.status,'retreat');assert.ok(party.every(id=>battle.units.find(u=>u.id===String(id)).hp===c.operativeState[id].maxHp));
  const report={type:'battleResult',battleId:c.pendingBattle.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};c=order(c,report);assert.equal(c.pendingBattle,null);for(const id of party){assert.equal(c.operativeState[id].morale,previousMorale[id]-5);assert.equal(operativeLocation(c,id),'mendoza');assert.equal(c.operativeState[id].alive,true);}
  retreats.push({initial,actions,report});c=saved(c).campaign;
 }
 assert.ok(party.every(id=>c.operativeState[id].morale<50));
 for(const id of party)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 for(let n=0;party.some(id=>!physicallyReady(c,id))&&n<72;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.ok(party.every(id=>physicallyReady(c,id)&&c.operativeState[id].morale<50));
 for(const id of party)c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});
 if(remote){c=order(c,{type:'squad',ids:[remoteId]});c=retainedOrder(c,{type:'travel',sector:'cordoba',mode:'posta',queue:true});for(let n=0;c.squads.find(q=>q.id===c.activeSquadId).journey&&n<24;n++)c=retainedOrder(c,{type:'wait',hours:1});assert.equal(operativeLocation(c,remoteId),'cordoba');}
 for(const id of all.filter(id=>!party.includes(id))){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(cash-c.resources.treasury,quote.total);}
 const local=all.filter(id=>!remote||id!==remoteId);for(let offset=0;offset<local.length;offset+=6)c=order(c,{type:'createSquad',sector:'mendoza',ids:local.slice(offset,offset+6),name:'Reserva local '+offset});
 if(nearExpiry){const until=Math.min(...c.recruited.map(id=>contractExpiresSeconds(c.contracts[id])))-1800;for(let n=0;clock(c)<until&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,until-clock(c))});assert.equal(clock(c),until);}
 assert.ok(c.operativeState[localId].morale<50&&physicallyReady(c,localId));assert.deepEqual(content,declaration);return {campaign:saved(c).campaign,retreats,party};
}
function replay(start,events){let c=saved(start).campaign;for(const event of events)if(['freshRouteOrder','freshRouteRenewal'].includes(event.event))c=order(c,event.action);return saved(c).campaign;}
function observer(events){return event=>{const {campaign,...rest}=event;events.push(structuredClone(rest));};}

test('actual local paid rest earns the missing sixth replacement after real retreats, with exact Native renewal and saved repetition',()=>{
 const {campaign:start,retreats}=setup({nearExpiry:true}),before=structuredClone(start),events=[],initial=mountainReplacementCensus(start,{exclude});assert.equal(retreats.length,7);assert.equal(initial.ready.length,5);assert.equal(initial.rows.find(row=>row.op.id===localId).reason,'morale');
 const returned=prepareNativeMountainReserve(start,{exclude,report:observer(events)}),local=events.find(e=>e.event==='mountainNativeLocalReserveRest'),paid=events.filter(e=>e.event==='freshRouteRenewal');
 assert.equal(mountainReplacementCensus(returned,{exclude}).ready.length,6);assert.ok(returned.operativeState[localId].morale>=50);assert.ok(local.readinessSeconds>0&&local.readinessSeconds<=600*3600);assert.equal(clock(returned)-clock(start),local.readinessSeconds);assert.ok(paid.length);assert.ok(!paid.some(e=>e.id===localId));assert.equal(returned.operativeState[localId].morale-start.operativeState[localId].morale,Math.floor((start.operativeState[localId].moraleRestHours+local.readinessSeconds/3600)/6));assert.equal(returned.resources.treasury,start.resources.treasury-paid.reduce((n,e)=>n+e.price,0));assert.ok(!events.some(e=>e.event==='freshRouteOrder'&&['travel','createSquad','recruitCivic'].includes(e.action.type)));
 for(const id of start.recruited){assert.equal(returned.operativeState[id].alive,start.operativeState[id].alive);assert.equal(returned.operativeState[id].hp,start.operativeState[id].hp);for(const key of ['inventory','ammoStock','medkits','weaponDropped'])assert.deepEqual(returned.operativeState[id][key],start.operativeState[id][key]);assert.ok(contractExpiresSeconds(returned.contracts[id])>clock(returned));}
 assert.deepEqual(returned.squads,start.squads);assert.equal(returned.activeSquadId,start.activeSquadId);assert.deepEqual(replay(start,events),returned);assert.deepEqual(prepareNativeMountainReserve(saved(start).campaign,{exclude}),returned);assert.deepEqual(start,before);
 const noOp=[];assert.strictEqual(prepareNativeMountainReserve(returned,{exclude,report:observer(noOp)}),returned);assert.deepEqual(noOp,[]);assert.deepEqual(NATIVE_MOUNTAIN_RESERVE_BOUNDS,{count:6,preMarchRestHours:72,travelHours:168,readinessRestHours:600});
});

test('local and later actual remote readiness rest consume one shared existing allowance',()=>{
 const {campaign:start}=setup({remote:true}),before=structuredClone(start),events=[],returned=prepareNativeMountainReserve(start,{exclude,report:observer(events)}),local=events.find(e=>e.event==='mountainNativeLocalReserveRest'),ready=events.find(e=>e.event==='mountainNativeReserveReady');
 assert.ok(local.needed>0&&local.readinessSeconds>0);assert.ok(ready.readinessSeconds>local.readinessSeconds&&ready.readinessSeconds<=600*3600);assert.equal(ready.readinessLimit,600*3600);assert.equal(operativeLocation(returned,remoteId),'mendoza');assert.ok([localId,remoteId].every(id=>physicallyReady(returned,id)&&returned.operativeState[id].morale>=50));assert.equal(mountainReplacementCensus(returned,{exclude}).ready.length,6);assert.deepEqual(replay(start,events),returned);assert.deepEqual(start,before);
});

test('a selected serving role or actual working duty cannot become a local morale reserve',()=>{
 for(const work of [false,true]){let {campaign:start}=setup();if(work)start=order(start,{type:'assignWork',operativeId:localId,assignment:'practice',skill:'marksmanship'});const before=structuredClone(start),events=[],excluded=work?exclude:[...exclude,localId];assert.throws(()=>prepareNativeMountainReserve(start,{exclude:excluded,report:observer(events)}),/Enough actual healthy serving reserves/);assert.deepEqual(events,[]);assert.deepEqual(start,before);}
});

test('a genuine announced raid stops the actual local rest at its paid interruption and preserves the exact accepted prefix',()=>{
 let {campaign:start}=setup({raid:true});for(let n=0;!start.enemyGroups.some(group=>group.target==='mendoza'&&group.status==='marching')&&!start.pendingEncounter&&n<300;n++)start=retainedOrder(start,{type:'wait',hours:1});assert.equal(start.pendingEncounter,null);const group=start.enemyGroups.find(group=>group.target==='mendoza'&&group.status==='marching');assert.ok(group);const before=structuredClone(start),events=[];let error;
 try{prepareNativeMountainReserve(start,{exclude,report:observer(events)});}catch(e){error=e;}
 assert.ok(error?.campaign?.pendingEncounter);assert.equal(error.campaign.pendingEncounter.groupId,group.id);assert.ok(error.mountainReserveReadiness.readinessSeconds<=600*3600);assert.equal(events.filter(e=>e.event==='freshRouteOrder').at(-1).action.type,'wait');assert.deepEqual(replay(start,events),error.campaign);saved(error.campaign);assert.deepEqual(start,before);
});
