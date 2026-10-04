import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle,pointFirePreview,weaponFor,teamCanSee} from '../game/tactical.js';
import {shotLoadFlight} from '../game/shot-load.js';
import {projectileTrajectory,projectileTrajectoryPoint} from '../game/projectile-trajectory.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {ammoCount} from '../game/ammo-types.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const actor=(battle,id='100')=>battle.units.find(unit=>unit.id===id);
const enemy=battle=>battle.units.find(unit=>unit.side==='enemy');
const saved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const stamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
const point={x:11,y:3,tacticalLevel:0,stance:'standing'};

function paidAssault(){
 let campaign=initialCampaign(45);const initialCash=campaign.resources.treasury,quotes=[];
 for(const id of [100,110]){
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

// Prepared flat arena, not a fresh campaign victory or a balance proof.
// Positions, passive posts, dry weather and seed 8 are declared before the
// official save admits execution. Actual paid hires, hostile identities,
// health, skills, contracts and finite issued equipment remain unchanged.
function arena(campaign){
 const request=campaign.pendingBattle,width=48,height=16;
 const battle=createBattle(request.squad.map(unit=>({...unit,x:unit.id===100?1:30,y:unit.id===100?3:4,facing:unit.id===100?2:6})),{
  ...request,width,height,seed:8,weather:{rain:0,humidity:0},
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0})),
  props:[],enemies:request.enemies.map((unit,i)=>({...unit,x:i?44:28,y:i?10+i:3,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:47-i,y:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 return saved({campaign:structuredClone(campaign),battle});
}

function issue(pair,action,history){
 const before=structuredClone(pair),ordinary=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presented.state,ordinary);
 assert.deepEqual(pair,before,'ordinary execution, presentation and save must not mutate their submitted source');
 const next=syncBattleTime(pair.campaign,ordinary);assert.equal(next.error,null,next.error);
 history?.push(structuredClone(action));return saved(next);
}

test('a paid native shot load falls after an empty requested point and preserves its actual injury and finite kit through saved replay, boundary return and reentry',t=>{
 const preparation=paidAssault(),start=arena(preparation.campaign),before=structuredClone(start);
 const shooter=actor(start.battle),target=enemy(start.battle),weapon=weaponFor(shooter),cash=start.campaign.resources.treasury;
 const contracts=structuredClone(start.campaign.contracts),initialRounds=shooter.loaded+ammoCount(shooter);
 assert.equal(weapon.id,1804);assert.equal(weapon.loadPattern,'cone');assert.equal(weapon.range,10);assert.equal(weapon.damage,48);
 assert.equal(initialRounds,10);assert.equal(shooter.loaded,1);assert.equal(teamCanSee(start.battle,'player',target),true);
 assert.ok(start.battle.units.every(unit=>unit.x!==point.x||unit.y!==point.y));
 assert.ok(start.battle.npcs.every(npc=>npc.x!==point.x||npc.y!==point.y),'the requested point contains no intended body');

 const flight=shotLoadFlight(start.battle,shooter,point,weapon),center=flight.pellets.find(pellet=>pellet.index===0).flight;
 const contact=center.bodyImpacts.find(hit=>hit.victimKind==='unit'&&hit.victimId===target.id);
 assert.ok(contact,'the finite centre ray reaches the actual standing enemy behind the requested point');
 assert.equal(contact.hitLocation,'legs');assert.ok(contact.impact.x>point.x);
 const model=center.trajectoryModel,straight=projectileTrajectory(model.source,model.destination),straightPoint=projectileTrajectoryPoint(straight,contact.fraction);
 const distance=contact.fraction*model.horizontalDistance,beyond=distance-2*weapon.range;
 const expectedDrop=COMBAT_BALANCE.firearmFarDropIncrement/(4*weapon.range)*beyond*beyond;
 assert.ok(Math.abs(model.horizontalDistance-weapon.range*COMBAT_BALANCE.shotLoadFlightRangeMultiplier)<1e-10);
 assert.ok(distance>2*weapon.range&&distance<model.horizontalDistance,'drop occurs before the real finite cap');
 assert.ok(Math.abs(distance-26.5)<1e-10);assert.ok(Math.abs(straightPoint.height-.605)<1e-10);
 assert.ok(Math.abs(contact.impact.height-.499375)<1e-10);
 assert.ok(Math.abs(straightPoint.height-contact.impact.height-expectedDrop)<1e-10);
 assert.ok(straightPoint.height>.6&&contact.impact.height<.6,'the same intended slope changes a real standing-body region');
 assert.ok(flight.pellets.every(pellet=>Math.hypot(pellet.flight.terminal.impact.x-shooter.x,pellet.flight.terminal.impact.y-shooter.y)<=weapon.range*COMBAT_BALANCE.shotLoadFlightRangeMultiplier+1e-10));
 assert.deepEqual(start,before,'geometry and public preflight cannot spend RNG, time or equipment');

 const action={type:'firePoint',unitId:shooter.id,x:point.x,y:point.y,tacticalLevel:0,aim:4};
 const preview=pointFirePreview(start.battle,shooter,point,action.aim);assert.equal(preview.valid,true,preview.reason);
 const shown=presentedActBattle(start.battle,action),history=[];let pair=issue(start,action,history);
 const fired=actor(pair.battle),injured=enemy(pair.battle),projectiles=shown.frames.filter(frame=>frame.type==='projectile');
 assert.ok(injured.hp<target.hp,'the ordinary paid discharge actually injures the observed body behind its empty requested point');
 assert.equal(injured.lastHitLocation,'legs');assert.ok(injured.bleeding>0);
 assert.equal(fired.ap,shooter.ap-preview.pa);assert.equal(fired.loaded,0);assert.equal(ammoCount(fired),ammoCount(shooter));
 assert.equal(fired.condition,shooter.condition-1);assert.equal(fired.energy,shooter.energy);
 assert.equal(pair.battle.elapsedSeconds-start.battle.elapsedSeconds,6);assert.equal(stamp(pair.campaign)-stamp(start.campaign),6);
 assert.equal(projectiles.length,1,'nine pellets spend one discharge, not nine attacks');assert.equal(projectiles[0].shotVisual.spread,true);
 assert.equal(pair.battle.smoke.length-start.battle.smoke.length,1,'one spent powder load makes one discharge');
 const resolvedCenter=projectiles[0].shotVisual.impact;
 assert.deepEqual({x:resolvedCenter.x,y:resolvedCenter.y},{x:point.x,y:point.y},'the ordinary accuracy draw resolves this authored seed at the declared empty centre');
 const resolvedFlight=shotLoadFlight(start.battle,shooter,{...point,...resolvedCenter},weapon,'torso',{destinationHeight:resolvedCenter.height});
 const resolvedRay=resolvedFlight.pellets[0].flight,resolvedContact=resolvedRay.bodyImpacts.find(hit=>hit.victimKind==='unit'&&hit.victimId===target.id);
 assert.ok(resolvedContact);assert.equal(resolvedContact.hitLocation,injured.lastHitLocation);
 const resolvedStraight=projectileTrajectoryPoint(projectileTrajectory(resolvedRay.trajectoryModel.source,resolvedRay.trajectoryModel.destination),resolvedContact.fraction);
 assert.ok(resolvedStraight.height>.6&&resolvedContact.impact.height<.6,'the actual resolved centre, not only a hypothetical aim, falls into the real legs');
 assert.equal(projectiles[0].state.units.find(unit=>unit.id===target.id).hp,target.hp,'presentation shows the discharge before actual injury');
 assert.equal(shown.frames.flatMap(frame=>frame.impacts).filter(hit=>hit.unitId===target.id&&hit.victimKind!=='npc').reduce((sum,hit)=>sum+hit.damage,0),target.hp-injured.hp);
 assert.notEqual(pair.battle.seed,start.battle.seed);assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.contracts,contracts);
 const shotReceipt={health:injured.hp,region:injured.lastHitLocation,ap:shooter.ap-fired.ap,seconds:pair.battle.elapsedSeconds-start.battle.elapsedSeconds,seed:pair.battle.seed};

 pair=issue(pair,{type:'move',unitId:'100',x:1,y:0},history);
 pair=issue(pair,{type:'move',unitId:'110',x:30,y:0},history);
 const north=pair.battle.exits.find(exit=>exit.destination==='retiro');assert.ok(north);
 pair=issue(pair,{type:'exit',unitIds:['100','110'],exitId:north.id},history);assert.equal(pair.battle.status,'retreat');
 for(const id of ['100','110'])assert.ok(actor(pair.battle,id).departure);
 let replay=saved(start);for(const nextAction of history)replay=issue(replay,nextAction);assert.deepEqual(replay,pair,'every ordinary order replays across full campaign and tactical saves');
 const final=structuredClone(pair.battle),request=pair.campaign.pendingBattle;
 let campaign=order(pair.campaign,{type:'battleResult',battleId:request.id,outcome:final.status,sectorState:final,survivors:final.units.filter(unit=>unit.side==='player')});
 campaign=saved({campaign}).campaign;assert.equal(campaign.location,'retiro');assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,contracts);
 for(const hostile of final.units.filter(unit=>unit.side==='enemy'))assert.equal(campaign.sectorStates.buenos_aires.units.find(unit=>unit.id===hostile.id).hp,hostile.hp);
 const fallen=final.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>Number(unit.id));
 assert.deepEqual(request.squad.filter(unit=>!campaign.operativeState[unit.id].alive).map(unit=>unit.id),fallen,'persistent service deaths equal actual battle deaths');
 campaign=order(campaign,{type:'visitSector'});const returned=saved({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates.retiro)});
 for(const unit of final.units.filter(unit=>unit.side==='player')){
  const actual=actor(returned.battle,unit.id);assert.equal(actual.hp,unit.hp);assert.equal(actual.loaded,unit.loaded);assert.equal(ammoCount(actual),ammoCount(unit));
  assert.equal(actual.condition,unit.condition);assert.deepEqual(actual.inventory,unit.inventory);
 }
 assert.equal(actor(returned.battle).loaded+ammoCount(actor(returned.battle)),initialRounds-1);assert.equal(returned.campaign.resources.treasury,cash);
 for(const key of ['trajectoryModel','trajectory','pellets','shotLoad'])assert.equal(key in returned.battle,false,'transient discharge geometry does not enter the official save');
 t.diagnostic(JSON.stringify({fixture:'prepared flat 48×16 arena; paid native kit; authored representative seed 8',quotes:preparation.quotes,treasury:cash,requestedPoint:point,resolvedCenter,contactDistance:resolvedContact.fraction*resolvedRay.trajectoryModel.horizontalDistance,cap:model.horizontalDistance,straightHeight:resolvedStraight.height,physicalHeight:resolvedContact.impact.height,shot:shotReceipt,rounds:[initialRounds,actor(returned.battle).loaded+ammoCount(actor(returned.battle))],condition:[shooter.condition,actor(returned.battle).condition],orders:history.length,totalActionSeconds:final.elapsedSeconds-start.battle.elapsedSeconds,fallen}));
});
