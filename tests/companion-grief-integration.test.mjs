import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,shotChance,teamCanSee} from '../game/tactical.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {travelLegHours} from '../game/squad-travel.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const actor=b=>b.units.find(unit=>unit.id==='107');
const buddy=b=>b.units.find(unit=>unit.id==='116');
const target=b=>b.units.find(unit=>unit.side==='enemy');
const rounds=u=>u.loaded+totalReserveAmmunition(u);

function preparedArena({legacy=false}={}){
 let campaign=initialCampaign(42,defaultContentPackage());const prices=[];
 for(const id of [107,116]){
  const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'week'),cash=campaign.resources.treasury;
  campaign=order(campaign,{type:'recruitCivic',id,term:'week'});assert.equal(campaign.resources.treasury,cash-quote.price);prices.push({id,price:quote.price});
 }
 for(let i=0;i<6;i++)campaign=order(campaign,{type:'advanceStrategicTime',seconds:3600});
 assert.deepEqual(campaign.recruited,[107,116]);
 const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===107),'day'),cash=campaign.resources.treasury;
 campaign=order(campaign,{type:'renewContract',id:107,term:'day'});assert.equal(campaign.resources.treasury,cash-quote.price);
 // Preserve the authored daylight observation, including its real clock cost.
 campaign=order(campaign,{type:'wait',hours:18-campaign.hour-travelLegHours('retiro','buenos_aires')});
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const request=campaign.pendingBattle,width=48,height=16;
 // Declared initial arena, not an earned opening victory. The real hostile
 // force, two paid hires, health, skills, contracts and finite gear are retained.
 // Only geometry, passive posts, dry weather and representative seed42 differ.
 let battle=createBattle(request.squad.map(unit=>({...unit,x:1,y:unit.id===107?0:1,facing:2})),{
  ...request,width,height,seed:42,exploration:true,weather:{rain:0,humidity:0},
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),props:[],
  enemies:request.enemies.map((unit,i)=>({...unit,x:i?44:31,y:i?9+i:0,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:47-i,y:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 assert.equal(actor(battle).morale,85);assert.equal(actor(battle).companionBonus,3);assert.equal(actor(battle).companionId,116);
 if(legacy){
  // Compatibility control: an older pending issue has no grief metadata.
  // Strip only the new fields before its FIRST official save admission;
  // retain the same original support, force, money, gear, health and seed.
  for(const value of [request,battle,...request.squad,...battle.units])for(const key of ['griefCompanionIds','griefParticipantIds','companionGrief'])delete value[key];
 }
 return {start:saved({campaign,battle}),prices,renewal:quote.price};
}

function issue(pair,action,history){
 const before=structuredClone(pair),actual=actBattle(pair.battle,action),shown=presentedActBattle(pair.battle,action);
 assert.equal(actual.lastError,null,actual.lastError);assert.deepEqual(shown.state,actual);assert.deepEqual(pair,before,'execution and presentation do not change the submitted state');
 const campaign=order(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:actual.elapsedSeconds,sectorState:actual});
 history?.push(structuredClone(action));return saved({campaign,battle:{...actual,syncedSeconds:actual.elapsedSeconds}});
}

function execute(start){
 let pair=saved(start);const history=[],initialActor=structuredClone(actor(pair.battle)),originalContracts=structuredClone(pair.campaign.contracts),cash=pair.campaign.resources.treasury;
 const point={type:'firePoint',unitId:'107',x:buddy(pair.battle).x,y:buddy(pair.battle).y,aim:4};
 pair=issue(pair,point,history);assert.equal(buddy(pair.battle).hp,32);assert.equal(actor(pair.battle).companionGrief,undefined);
 pair=issue(pair,{type:'reload',unitId:'107'},history);pair=issue(pair,point,history);assert.equal(buddy(pair.battle).hp,0);
 const deathMorale=actor(pair.battle).morale,grief=structuredClone(actor(pair.battle).companionGrief);
 pair=issue(pair,{type:'reload',unitId:'107'},history);
 for(let i=0;i<25&&pair.battle.mode==='exploration';i++)pair=issue(pair,{type:'move',unitId:'107',x:actor(pair.battle).x+1,y:0},history);
 assert.equal(pair.battle.mode,'combat');assert.equal(pair.battle.phase,'player');
 pair=issue(pair,{type:'move',unitId:'107',x:23,y:0},history);
 const before=structuredClone(pair),shooter=actor(pair.battle),enemy=target(pair.battle),chance=shotChance(pair.battle,shooter,enemy,1);
 assert.ok(teamCanSee(pair.battle,'player',enemy));assert.deepEqual(pair,before,'the public forecast spends no time, random draws or items');
 const action={type:'fire',unitId:'107',targetId:enemy.id,aim:1},cost=actionCosts(pair.battle,shooter,enemy),shotsBefore=rounds(shooter);
 pair=issue(pair,action,history);assert.equal(actor(pair.battle).ap,shooter.ap-cost.fire-cost.aim);assert.equal(rounds(actor(pair.battle)),shotsBefore-1);assert.equal(actor(pair.battle).condition,shooter.condition-1);
 assert.equal(actor(pair.battle).hp,initialActor.hp);assert.equal(rounds(actor(pair.battle)),rounds(initialActor)-3);assert.equal(actor(pair.battle).condition,initialActor.condition-3);assert.equal(buddy(pair.battle).hp,0);
 const exit=pair.battle.exits.find(exit=>exit.destination==='retiro');assert.ok(exit);pair=issue(pair,{type:'exit',unitIds:['107'],exitId:exit.id},history);assert.equal(pair.battle.status,'retreat');assert.equal(actor(pair.battle).departure.destination,'retiro');
 let replay=saved(start);for(const action of history)replay=issue(replay,action);assert.deepEqual(replay,pair,'every fatal shot, normal shot and paid crossing replays through official saves');
 const battle=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 let campaign=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});campaign=saved({campaign}).campaign;
 assert.equal(campaign.location,'retiro');assert.equal(campaign.operativeState[116].alive,false);assert.equal(campaign.operativeState[116].hp,0);assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,originalContracts);
 for(const enemy of battle.units.filter(unit=>unit.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===enemy.id).hp,enemy.hp);
 assert.deepEqual(request.squad.filter(unit=>!campaign.operativeState[unit.id].alive).map(unit=>String(unit.id)),battle.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>unit.id),'persistent service deaths equal every actual player casualty');
 campaign=order(campaign,{type:'visitSector'});const returned=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 assert.equal(actor(returned.battle).hp,actor(battle).hp);assert.equal(rounds(actor(returned.battle)),rounds(actor(battle)));assert.equal(actor(returned.battle).condition,actor(battle).condition);assert.deepEqual(actor(returned.battle).inventory,actor(battle).inventory);assert.deepEqual(returned.campaign.operativeState[107].companionGrief,grief);
 return {pair,returned,history,chance,deathMorale,grief,normalShot:{pa:cost.fire+cost.aim,seed:pair.battle.seed,condition:actor(battle).condition,rounds:rounds(actor(battle)),hp:actor(battle).hp,elapsed:pair.battle.elapsedSeconds}};
}

test('paid observed grief lowers an ordinary shot forecast and preserves physical costs against an older pending issue',t=>{
 const current=preparedArena(),legacy=preparedArena({legacy:true}),currentBefore=structuredClone(current.start),legacyBefore=structuredClone(legacy.start);
 const actual=execute(current.start),control=execute(legacy.start);assert.deepEqual(current.start,currentBefore);assert.deepEqual(legacy.start,legacyBefore);
 assert.equal(actual.deathMorale,61);assert.equal(control.deathMorale,67);assert.deepEqual(actual.grief,[{companionId:116,loss:6}]);assert.equal(control.grief,undefined);
 assert.equal(actual.chance,36);assert.equal(control.chance,37);assert.deepEqual(actual.history,control.history);assert.deepEqual(actual.normalShot,control.normalShot,'grief adds no shot cost, physical effect or random draw');
 assert.equal(actual.returned.campaign.operativeState[107].morale,47);assert.equal(control.returned.campaign.operativeState[107].morale,53);assert.equal(actual.pair.battle.units.find(unit=>unit.side==='enemy').hp,100,'the real missed shot does not invent an enemy wound');
 assert.equal(actual.pair.battle.log.filter(line=>line==='Inés Aguirre lamenta la muerte de Petrona Lagos. Moral −6.').length,1);assert.equal(control.pair.battle.log.some(line=>line.includes('lamenta la muerte')),false);
 t.diagnostic(JSON.stringify({scenario:'Declared flat BA arena; actual paid issue and hostile force, not an opening victory',legacyControl:'Only new grief metadata absent before initial official save; original +3 support retained',hirePrices:current.prices,renewal:current.renewal,treasury:actual.returned.campaign.resources.treasury,orders:actual.history.length,tacticalMorale:actual.deathMorale,returnedMorale:actual.returned.campaign.operativeState[107].morale,forecasts:{current:actual.chance,olderPending:control.chance},normalShot:actual.normalShot,actualDeadIds:actual.pair.battle.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>unit.id)}));
});
