import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,weaponFor,firearmFlightPreview,firearmVolleyPreview,teamCanSee} from '../game/tactical.js';
import {projectileTrajectory,projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
import {ammoCount} from '../game/ammo-types.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const actor=(battle,id='107')=>battle.units.find(unit=>unit.id===id);
const enemy=battle=>battle.units.find(unit=>unit.side==='enemy');
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);

function paidAssault(){
 let campaign=initialCampaign(45);const initialCash=campaign.resources.treasury,quotes=[];
 for(const id of [107,110]){
  const quote=contractQuote(campaign,rosterFor(campaign).find(unit=>unit.id===id),'week');
  assert.ok(quote.available&&quote.price>0);quotes.push({id,price:quote.price});
  campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 }
 campaign=order(campaign,{type:'wait',hours:6});
 for(const {id,price} of quotes){assert.ok(campaign.recruited.includes(id));assert.equal(campaign.contracts[id].paid,price);}
 campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 assert.equal(campaign.resources.treasury,initialCash-quotes.reduce((sum,quote)=>sum+quote.price,0));
 return {campaign,quotes};
}

// Prepared flat firing arena, not a fresh-campaign victory or balance proof.
// Positions, passive enemy posts, dry weather and representative seed 8 are
// declared before save admission. Both paid hires, the hostile force and NPC
// identities retain their actual issued health, skills and finite equipment.
// No execution step assigns position, health, ammunition or random state.
function arena(campaign,{hiddenBody=false}={}){
 const request=campaign.pendingBattle,width=48,height=16;
 const battle=createBattle(request.squad.map(unit=>({...unit,x:unit.id===107?1:30,y:unit.id===107?3:4,facing:2})),{
  ...request,width,height,seed:8,weather:{rain:0,humidity:0},
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0})),
  props:[],enemies:request.enemies.map((unit,i)=>({...unit,x:i?44:32,y:i?10+i:3,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:hiddenBody&&!i?25:47-i,y:hiddenBody&&!i?3:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 return saved({campaign:structuredClone(campaign),battle});
}

function issue(pair,action,history){
 const before=structuredClone(pair),ordinary=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presented.state,ordinary);
 assert.deepEqual(pair,before,'neither execution mode may mutate the submitted source');
 const next=syncBattleTime(pair.campaign,ordinary);assert.equal(next.error,null,next.error);
 history?.push(structuredClone(action));return saved(next);
}

const shot=battle=>({type:'fire',unitId:'107',targetId:enemy(battle).id,aim:4,hitLocation:'torso'});

test('a paid native pistol shot drops into the legs and preserves finite costs through official replay, boundary return and reentry',t=>{
 const preparation=paidAssault(),start=arena(preparation.campaign),before=structuredClone(start),shooter=actor(start.battle),target=enemy(start.battle),weapon=weaponFor(shooter);
 const cash=start.campaign.resources.treasury,contracts=structuredClone(start.campaign.contracts),initialRounds=shooter.loaded+ammoCount(shooter);
 assert.equal(weapon.id,1805);assert.equal(weapon.loadPattern,'single');assert.equal(initialRounds,10);assert.equal(shooter.loaded,1);
 assert.equal(teamCanSee(start.battle,'player',target),true);
 const forecast=firearmFlightPreview(start.battle,shooter,target,'torso'),contact=forecast.bodyImpacts.find(hit=>hit.victimKind==='unit'&&hit.victimId===target.id);
 assert.ok(contact);assert.equal(contact.hitLocation,'legs');assert.ok(contact.fraction>forecast.trajectoryModel.dropStart);
 const model=forecast.trajectoryModel,straight=projectileTrajectory(model.source,model.destination),straightPoint=projectileTrajectoryPoint(straight,contact.fraction);
 const distance=contact.fraction*model.horizontalDistance,beyond=distance-2*weapon.range;
 const expectedDrop=COMBAT_BALANCE.firearmFarDropIncrement/(4*weapon.range)*beyond*beyond;
 assert.ok(straightPoint.height>.6&&straightPoint.height<1.3,'the controlled straight aim enters the standing torso');
 assert.ok(Math.abs(straightPoint.height-contact.impact.height-expectedDrop)<1e-9);
 assert.ok(contact.impact.height<.6,'the actual curved contact is below the standing torso');
 assert.equal(firearmVolleyPreview(start.battle,shooter,target,4,'torso').shots[0].physicalHitLocation,'legs');
 assert.deepEqual(start,before,'public forecasts may not spend RNG, time or equipment');

 const action=shot(start.battle),costs=actionCosts(start.battle,shooter,target),history=[];
 const shown=presentedActBattle(start.battle,action);let pair=issue(start,action,history),fired=actor(pair.battle),injured=enemy(pair.battle);
 assert.ok(injured.hp<target.hp);assert.equal(injured.lastHitLocation,'legs');assert.ok(injured.bleeding>0);
 assert.equal(fired.ap,shooter.ap-costs.fire-4*costs.aim);assert.equal(fired.loaded,0);assert.equal(ammoCount(fired),ammoCount(shooter));
 assert.equal(fired.condition,shooter.condition-1);assert.equal(fired.energy,shooter.energy);
 assert.equal(pair.battle.elapsedSeconds-start.battle.elapsedSeconds,6);assert.equal(stamp(pair.campaign)-stamp(start.campaign),6);
 assert.equal(shown.frames.filter(frame=>frame.type==='projectile').length,1,'one load has one discharge');
 const impact=shown.frames.find(frame=>frame.impacts.some(hit=>hit.unitId===target.id));assert.ok(impact);
 assert.equal(impact.impacts.find(hit=>hit.unitId===target.id).damage,target.hp-injured.hp);
 assert.equal(shown.frames.find(frame=>frame.type==='projectile').state.units.find(unit=>unit.id===target.id).hp,target.hp,'flight precedes the real injury');
 assert.notEqual(pair.battle.seed,start.battle.seed);assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.contracts,contracts);
 const shotReceipt={health:injured.hp,region:injured.lastHitLocation,ap:shooter.ap-fired.ap,seconds:pair.battle.elapsedSeconds-start.battle.elapsedSeconds,seed:pair.battle.seed};

 pair=issue(pair,{type:'move',unitId:'107',x:1,y:0},history);
 pair=issue(pair,{type:'move',unitId:'110',x:30,y:0},history);
 const north=pair.battle.exits.find(exit=>exit.destination==='retiro');assert.ok(north);
 pair=issue(pair,{type:'exit',unitIds:['107','110'],exitId:north.id},history);assert.equal(pair.battle.status,'retreat');
 assert.ok(actor(pair.battle).departure);assert.ok(actor(pair.battle,'110').departure);
 let replay=saved(start);for(const action of history)replay=issue(replay,action);assert.deepEqual(replay,pair,'all four ordinary orders replay through the full save boundary');
 const final=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 let campaign=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:final,survivors:final.units.filter(unit=>unit.side==='player')});
 campaign=saved({campaign}).campaign;assert.equal(campaign.location,'retiro');assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,contracts);
 for(const hostile of final.units.filter(unit=>unit.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===hostile.id).hp,hostile.hp);
 const fallen=final.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>Number(unit.id));
 assert.deepEqual(request.squad.filter(unit=>!campaign.operativeState[unit.id].alive).map(unit=>unit.id),fallen,'persistent service deaths equal the actual battle deaths');
 campaign=order(campaign,{type:'visitSector'});const returned=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 for(const unit of final.units.filter(unit=>unit.side==='player')){
  const actual=actor(returned.battle,unit.id);assert.equal(actual.hp,unit.hp);assert.equal(actual.loaded,unit.loaded);assert.equal(ammoCount(actual),ammoCount(unit));
  assert.equal(actual.condition,unit.condition);assert.deepEqual(actual.inventory,unit.inventory);
 }
 assert.equal(actor(returned.battle).loaded+ammoCount(actor(returned.battle)),initialRounds-1);assert.equal(returned.campaign.resources.treasury,cash);
 assert.equal('trajectoryModel' in returned.battle,false,'transient geometry does not enter the official save');
 t.diagnostic(JSON.stringify({fixture:'prepared flat 48×16 arena; native paid kit; representative seed 8',quotes:preparation.quotes,treasury:cash,shot:shotReceipt,selectedRegion:'torso',physicalHeight:contact.impact.height,straightHeight:straightPoint.height,initialRounds,returnedRounds:actor(returned.battle).loaded+ammoCount(actor(returned.battle)),condition:[shooter.condition,actor(returned.battle).condition],orders:history.length,totalActionSeconds:final.elapsedSeconds-start.battle.elapsedSeconds,fallen}));
});

test('a real unseen intervening NPC cannot change the public drop forecast or admitted flight endpoint, and its actual harm saves and replays',()=>{
 const {campaign}=paidAssault(),clear=arena(campaign),privatePair=arena(campaign,{hiddenBody:true}),privateBody=privatePair.battle.npcs[0],source=actor(privatePair.battle),target=enemy(privatePair.battle);
 assert.equal(teamCanSee(privatePair.battle,'player',privateBody),false);assert.equal(teamCanSee(privatePair.battle,'player',target),true);
 assert.deepEqual(firearmFlightPreview(privatePair.battle,source,target),firearmFlightPreview(clear.battle,actor(clear.battle),enemy(clear.battle)));
 assert.deepEqual(firearmVolleyPreview(privatePair.battle,source,target,4),firearmVolleyPreview(clear.battle,actor(clear.battle),enemy(clear.battle),4));
 const action=shot(privatePair.battle),clearShown=presentedActBattle(clear.battle,action),privateShown=presentedActBattle(privatePair.battle,action);
 const publicEvent=frame=>({type:frame.type,action:frame.action,unitId:frame.unitId,visibleIds:frame.visibleIds,impacts:frame.impacts,targetPoint:frame.targetPoint,shotVisual:frame.shotVisual,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)});
 assert.deepEqual(publicEvent(privateShown.frames.find(frame=>frame.type==='projectile')),publicEvent(clearShown.frames.find(frame=>frame.type==='projectile')),'hidden physical interception cannot move, retime or refocus the observed flight');
 const actual=issue(privatePair,action);
 assert.ok(actual.battle.npcs.find(npc=>npc.id===privateBody.id).hp<privateBody.hp);assert.equal(enemy(actual.battle).hp,target.hp,'presentation cannot invent downstream injury');
 assert.equal(actor(actual.battle).loaded,0);assert.equal(ammoCount(actor(actual.battle)),ammoCount(source));assert.equal(actual.battle.elapsedSeconds-privatePair.battle.elapsedSeconds,6);
 for(const frame of privateShown.frames){
  assert.ok(!frame.impacts.some(impact=>impact.victimKind==='npc'&&impact.unitId===privateBody.id));
  assert.ok(!JSON.stringify({visual:frame.shotVisual,target:frame.targetPoint,impacts:frame.impacts}).includes(privateBody.id));
  assert.ok(!JSON.stringify(frame.shotVisual??{}).includes('trajectoryModel'));
  assert.ok(!JSON.stringify(frame.shotVisual??{}).includes('trajectory'));
 }
 assert.ok(!actual.battle.log.some(line=>line.includes(privateBody.name)));
 assert.deepEqual(issue(saved(privatePair),action),actual,'the true hidden consequence survives official saved replay');
});
