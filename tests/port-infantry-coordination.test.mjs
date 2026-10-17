import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,teamCanSee,getReachable,stanceCost,actionCosts,medicalUsePreview,firearmShotOptions,hasLineOfSight} from '../game/tactical.js';
import {sameCell,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {directionTo,turnAPCost} from '../game/tactical-awareness.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {openingControlWindow} from './opening-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';

const flat=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass'}));
// Declared controller scenes isolate ordinary movement and finite kit. They
// are not an earned Ensenada force, native victory or campaign continuation.
function shared({observerFacing=2,medical=0,medkits=0,enemyHp=100}={}){
 return createBattle([
  {id:'idle',x:3,y:8,facing:6,stance:'prone',medical,medkits,marksmanship:50},
  {id:'observer',x:8,y:8,facing:observerFacing,medical:0,medkits:0,marksmanship:70},
 ],{width:24,height:16,tiles:flat(24,16),enemies:[{id:'contact',x:14,y:8,facing:6,hp:enemyHp,maxHp:enemyHp}],artillery:[]});
}

test('port infantry coordination is opt-in and preserves the ordinary gun-free policy by default',()=>{
 const battle=shared(),before=structuredClone(battle),legacy=recoveryPortSearchController(battle),battery=coastalBatteryController(battle,{sharedArtillerySight:true});
 for(const unit of battle.units.filter(unit=>unit.side==='player')){
  assert.deepEqual(legacy(battle,unit),battery(battle,unit));
  assert.deepEqual(recoveryPortSearchController(battle,{coordinateInfantry:true})(battle,unit),battery(battle,unit),'The inherited shared-contact option does not enable the new paid shot/cover doctrine.');
 }
 assert.deepEqual(battle,before);
});

test('an idle loaded rifleman pays for personal sight of a squad-known contact without controller memory mutation',()=>{
 const battle=shared(),before=structuredClone(battle),unit=battle.units.find(unit=>unit.id==='idle'),target=battle.units.find(unit=>unit.id==='contact');
 assert.equal(canSee(battle,unit,target),false);assert.equal(teamCanSee(battle,unit.side,target),true);
 assert.equal(recoveryPortSearchController(battle)(battle,unit),null,'the original explicit hold stays a hold');
 const controller=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true});
 assert.equal(controller(battle,unit),null,'shared investigation cannot replace the ordinary per-unit hold');
 const action=controller.sharedFallback(battle,unit);
 assert.equal(action?.type,'look');assert.equal(action.unitId,unit.id);
 const turnCost=turnAPCost(unit,directionTo(unit,action));assert.ok(turnCost>0,'a shared look must change facing and pay AP');
 assert.deepEqual(battle,before,'the controller cannot write remembered contact before its actual order');
 const after=actBattle(battle,action);assert.equal(after.lastError,null,JSON.stringify(action));
 const moved=after.units.find(actor=>actor.id===unit.id);
 assert.equal(moved.ap,unit.ap-turnCost,'the native look spends its exact positive turning cost');
 for(const key of ['weapon','ammo','loaded','medkits','inventory','lastHeardNoise'])assert.deepEqual(moved[key],unit[key],key);
 assert.equal(canSee(after,moved,after.units.find(actor=>actor.id===target.id)),true);
 assert.deepEqual(moved.lastKnownEnemy,{x:target.x,y:target.y,turn:after.turn},'only the paid native action and new personal sight acquire this memory');
 const next=controller.sharedFallback(after,moved);
 assert.ok(next?.type!=='look'||turnAPCost(moved,directionTo(moved,next))>0,'the acquired facing cannot cause repeated zero-cost look orders');
 assert.deepEqual(actBattle(structuredClone(battle),action),after);assert.deepEqual(battle,before);
 const hidden=shared({observerFacing:6}),hiddenUnit=hidden.units.find(unit=>unit.id==='idle'),hiddenTarget=hidden.units.find(unit=>unit.id==='contact');
 assert.equal(teamCanSee(hidden,hiddenUnit.side,hiddenTarget),false);
 assert.deepEqual(recoveryPortSearchController(hidden,{coordinateInfantry:true,coordinateRifleCover:true})(hidden,hiddenUnit),recoveryPortSearchController(hidden)(hidden,hiddenUnit),'without a known contact, the ordinary reconnaissance policy stays unchanged');
 assert.equal(recoveryPortSearchController(hidden,{coordinateInfantry:true,coordinateRifleCover:true}).sharedFallback(hidden,hiddenUnit),null);
});

test('port shared investigation waits until every actual ordinary squad decision has run',()=>{
 let battle=shared({enemyHp:300});const setupPolicy=recoveryPortSearchController(battle),setupOrders=[];
 // Pay the observer's actual ordinary firing work before declaring the idle
 // squad-pass boundary. No AP, ammunition or enemy health is assigned here.
 for(let step=0;step<4;step++){
  const observer=battle.units.find(unit=>unit.id==='observer'),action=setupPolicy(battle,observer);assert.ok(action);setupOrders.push(action);
  battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action));
 }
 assert.ok(battle.units.find(unit=>unit.id==='observer').ap>=3,'the ordinary pass must still consult this real observer');
 const before=structuredClone(battle),controller=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true}),consulted=[];let callbacks=0;
 assert.equal(controller(battle,battle.units.find(unit=>unit.id==='observer')),null,'the actual observer work is exhausted before the idle shared bound');
 let setupReplay=shared({enemyHp:300});for(const action of setupOrders)setupReplay=actBattle(setupReplay,action);assert.deepEqual(setupReplay,battle);
 const result=openingControlWindow(battle,{controller:(state,unit)=>{consulted.push(unit.id);return controller(state,unit);},sharedFallback:(state,unit)=>{
  assert.ok(consulted.includes('idle')&&consulted.includes('observer'),'both ordinary decisions precede shared work');
  callbacks++;
  return controller.sharedFallback(state,unit);
 }});
 assert.equal(result.battle.lastError,null);assert.ok(result.actions>0);assert.ok(callbacks>0);assert.deepEqual(battle,before);
 assert.equal(result.sharedInvestigation?.type,'look');assert.deepEqual(result.orders.at(-1),result.sharedInvestigation,'one actual shared bound ends the control window');
 const legacy=recoveryPortSearchController(battle);assert.equal(legacy.sharedFallback,undefined,'the default doctrine does not opt into shared bounds');
});

test('an explicit supplied physician reserve retains the existing foundry reserve policy',()=>{
 const battle=createBattle([
  {id:'reserve',x:3,y:2,medical:93,medkits:8,marksmanship:40},
  {id:'front',x:12,y:7,medical:0,medkits:0,marksmanship:80},
  {id:'screen',x:11,y:8,medical:0,medkits:0,marksmanship:75},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery:[]});
 const before=structuredClone(battle),unit=battle.units.find(actor=>actor.id==='reserve');
 const legacy=recoveryPortSearchController(battle,{reserveIds:['reserve']})(battle,unit);
 assert.equal(legacy?.type,'move','the declared scene exercises the existing reserve movement branch');
 const action=recoveryPortSearchController(battle,{reserveIds:['reserve'],coordinateInfantry:true,coordinateRifleCover:true})(battle,unit);
 assert.deepEqual(action,legacy,'explicit reserve duties take precedence over physician following');
 const after=actBattle(battle,action);assert.equal(after.lastError,null);
 assert.deepEqual(after,actBattle(structuredClone(battle),legacy));
 assert.equal(after.units.find(actor=>actor.id==='reserve').medkits,8);
 assert.deepEqual(battle,before);
});

for(const kind of ['gun','civilian'])test(`a required founder reserve cannot discover a hidden ${kind} through its public route plan`,()=>{
 const make=blocker=>createBattle([
  {id:'reserve',x:3,y:2,facing:6,medical:93,medkits:8,marksmanship:40},
  {id:'front',x:12,y:7,facing:2,medical:0,medkits:0,marksmanship:80},
  {id:'screen',x:11,y:8,facing:2,medical:0,medkits:0,marksmanship:75},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery:kind==='gun'&&blocker?[{id:'unknown-gun',type:'bronze4',side:'enemy',...blocker,loaded:true,ammo:4}]:[],npcs:kind==='civilian'&&blocker?[{id:'unknown-person',name:'Vecino',mission:'declared-static-speaker',...blocker}]:[]});
 const clear=make(),before=structuredClone(clear),unit=clear.units.find(actor=>actor.id==='reserve'),options={reserveIds:['reserve'],coordinateInfantry:true,coordinateRifleCover:true},action=recoveryPortSearchController(clear,options)(clear,unit);assert.equal(action?.type,'move');
 const hidden=make(spacePoint(action)),hiddenBefore=structuredClone(hidden),actor=hidden.units.find(unit=>unit.id==='reserve'),blocker=kind==='gun'?hidden.artillery[0]:hidden.npcs[0];assert.equal(teamCanSee(hidden,'player',blocker),false);
 assert.deepEqual(recoveryPortSearchController(hidden,options)(hidden,actor),action,'only public occupants can change a founder route proposal');
 const actual=actBattle(hidden,action);assert.equal(actual.lastError,null);assert.equal(sameCell(actual.units.find(unit=>unit.id==='reserve'),blocker),false,'the authoritative move still stops at the real physical blocker');
 assert.deepEqual(actual.artillery,hidden.artillery);for(const key of ['hp','medkits','ammo','loaded','inventory'])assert.deepEqual(actual.units.find(unit=>unit.id==='reserve')[key],actor[key]);assert.deepEqual(clear,before);assert.deepEqual(hidden,hiddenBefore);
});

test('a supplied physician follows the real infantry through an affordable same-level route instead of investigating an enemy',()=>{
 const battle=createBattle([
  {id:'medic',x:3,y:2,medical:93,medkits:8,marksmanship:40},
  {id:'front',x:12,y:7,medical:0,medkits:0,marksmanship:80},
  {id:'screen',x:11,y:8,medical:0,medkits:0,marksmanship:75},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery:[]});
 const before=structuredClone(battle),unit=battle.units.find(unit=>unit.id==='medic'),screen=battle.units.find(unit=>unit.id==='screen');
 const action=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true})(battle,unit);
 assert.equal(action?.type,'move');
 const path=getReachable(battle,unit).find(point=>sameCell(point,action));
 assert.ok(path&&path.cost>0&&path.cost<=16);assert.ok(path.path.every(point=>(point.tacticalLevel??0)===0));
 assert.ok(Math.hypot(action.x-screen.x,action.y-screen.y)<Math.hypot(unit.x-screen.x,unit.y-screen.y));
 assert.ok(action.x<=screen.x,'the physician does not pass the actual rifle screen');
 const after=actBattle(battle,action);assert.equal(after.lastError,null,JSON.stringify(action));
 const medic=after.units.find(actor=>actor.id===unit.id);assert.deepEqual(spacePoint(medic),spacePoint(path));assert.equal(medic.ap,unit.ap-path.cost);
 for(const key of ['hp','bleeding','medkits','loaded','ammo','inventory'])assert.deepEqual(medic[key],unit[key],key);
 assert.deepEqual(actBattle(structuredClone(battle),action),after);assert.deepEqual(battle,before);
});

test('physician route planning does not disclose an unseen opposing gun on its ordinary route',()=>{
 const arena=artillery=>createBattle([
  {id:'medic',x:3,y:2,facing:6,movementMode:'run',medical:93,medkits:8,marksmanship:40},
  {id:'front',x:12,y:7,facing:2,medical:0,medkits:0,marksmanship:80},
  {id:'screen',x:11,y:8,facing:2,medical:0,medkits:0,marksmanship:75},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery});
 const baseline=arena([]),medic=baseline.units.find(actor=>actor.id==='medic');
 const action=recoveryPortSearchController(baseline,{coordinateInfantry:true,coordinateRifleCover:true})(baseline,medic);assert.equal(action?.type,'move');
 const route=getReachable(baseline,medic).find(point=>sameCell(point,action));assert.ok(route?.path.length);
 const cell=route.path.find(point=>point.x>medic.x&&Math.hypot(point.x-medic.x,point.y-medic.y)>2);assert.ok(cell,'the declared route has a cell beyond peripheral sight and behind every current observer');
 const hidden=arena([{id:'unseen',type:'swivel',side:'enemy',loaded:true,ammo:3,...spacePoint(cell)}]),before=structuredClone(hidden);
 assert.equal(teamCanSee(hidden,'player',hidden.artillery[0]),false);
 const proposed=recoveryPortSearchController(hidden,{coordinateInfantry:true,coordinateRifleCover:true})(hidden,hidden.units.find(actor=>actor.id==='medic'));
 assert.deepEqual(proposed,action,'an unknown physical gun cannot change the physician route proposal');
 assert.ok(sameCell(proposed,hidden.artillery[0]),'the proposal keeps the unknown landing cell for authoritative physical execution to check');
 assert.deepEqual(hidden,before,'read-only planning preserves actual gun identity, position, rounds and all unit state');
});

test('ordinary adjacent first aid precedes physician cover and consumes one real dressing',()=>{
 const battle=createBattle([
  {id:'medic',x:3,y:8,medical:93,medkits:2,marksmanship:40},
  {id:'patient',x:4,y:8,hp:10,bleeding:3,medical:0,medkits:0},
  {id:'front',x:12,y:7,medical:0,medkits:0,marksmanship:80},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery:[]});
 const before=structuredClone(battle),controller=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true}),medic=battle.units.find(unit=>unit.id==='medic');
 const activation=controller(battle,medic);assert.deepEqual(activation,{type:'weapon',unitId:'medic',slot:'medical'});
 const equipped=actBattle(battle,activation);assert.equal(equipped.lastError,null);
 const aid=controller(equipped,equipped.units.find(unit=>unit.id==='medic'));assert.deepEqual(aid,{type:'useItem',unitId:'medic',targetId:'patient'});
 const after=actBattle(equipped,aid);assert.equal(after.lastError,null);
 assert.equal(after.units.find(unit=>unit.id==='medic').medkits,1);
 assert.ok(after.units.find(unit=>unit.id==='patient').bleeding<before.units.find(unit=>unit.id==='patient').bleeding);
 assert.ok(after.units.find(unit=>unit.id==='medic').ap<medic.ap);
 assert.deepEqual(actBattle(actBattle(structuredClone(battle),activation),aid),after);assert.deepEqual(battle,before);
});

function blockedRifleLane({cover=true,artillery=[]}={}){
 const tiles=flat(24,16);if(cover)tiles[6*24+4].cover=30;
 return createBattle([
  {id:'rifle',x:3,y:8,facing:2,weapon:1800,marksmanship:60,medkits:0},
  {id:'friend',x:4,y:8,facing:2,weapon:1800,marksmanship:60,medkits:0},
 ],{width:24,height:16,tiles,artillery,enemies:[{id:'observed',x:12,y:8,patrol:false,overwatch:false}],deferContact:false});
}

test('a known friendly blocked rifle lane earns a real cover position before paying useful posture and fire',()=>{
 let battle=blockedRifleLane();const initial=structuredClone(battle),unit=battle.units.find(actor=>actor.id==='rifle'),target=battle.units.find(actor=>actor.id==='observed');
 const legacy=recoveryPortSearchController(battle);assert.deepEqual(legacy(battle,unit),{type:'stance',unitId:unit.id,stance:'crouched'});
 const hypothetical={...unit,stance:'crouched',movementMode:'crouch',weaponReady:false,ap:unit.ap-stanceCost(unit,'crouched')},posed={...battle,units:battle.units.map(actor=>actor.id===unit.id?hypothetical:actor)};
 const safe=knownRouteShotSafety(posed,hypothetical,target);
 assert.ok(!firearmShotOptions(posed,hypothetical,target,4).some(option=>option.chance>=25&&option.damageFactor>0&&safe(option)),'the old first posture has no safe useful native shot');
 const controller=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true}),move=controller(battle,unit);assert.equal(move?.type,'move');
 const route=getReachable(battle,unit).find(point=>sameCell(point,move));assert.ok(route&&route.cost>0&&route.cost<=unit.ap-actionCosts(battle,unit).fire);
 assert.equal(surfaceAt(battle,move).cover,30);assert.ok(route.path.every(point=>(point.tacticalLevel??0)===0));
 const orders=[move];battle=actBattle(battle,move);assert.equal(battle.lastError,null);let actor=battle.units.find(actor=>actor.id===unit.id);
 assert.equal(actor.ap,unit.ap-route.cost);assert.equal(actor.stance,'standing');assert.deepEqual(battle.units.find(actor=>actor.id==='friend'),initial.units.find(actor=>actor.id==='friend'));
 const stance=controller(battle,actor);assert.deepEqual(stance,{type:'stance',unitId:unit.id,stance:'crouched'});const postureCost=stanceCost(actor,'crouched');orders.push(stance);
 battle=actBattle(battle,stance);assert.equal(battle.lastError,null);assert.equal(battle.units.find(actor=>actor.id===unit.id).ap,actor.ap-postureCost);
 actor=battle.units.find(actor=>actor.id===unit.id);const fire=controller(battle,actor);assert.equal(fire?.type,'fire');assert.equal(fire.targetId,target.id);
 const option=firearmShotOptions(battle,actor,battle.units.find(other=>other.id===target.id),fire.aim).find(option=>option.aim===fire.aim&&option.hitLocation===fire.hitLocation);
 assert.ok(option.chance>=25&&knownRouteShotSafety(battle,actor,battle.units.find(other=>other.id===target.id))(option));
 const costs=actionCosts(battle,actor,battle.units.find(other=>other.id===target.id));orders.push(fire);const loaded=actor.loaded,reserve=actor.ammo;
 battle=actBattle(battle,fire);assert.equal(battle.lastError,null);const fired=battle.units.find(other=>other.id===unit.id);
 assert.equal(fired.loaded,loaded-1);assert.equal(fired.ammo,reserve);assert.equal(fired.ap,actor.ap-costs.fire-fire.aim*costs.aim);
 assert.equal(battle.units.find(other=>other.id==='friend').hp,initial.units.find(other=>other.id==='friend').hp);
 let replay=structuredClone(initial);for(const action of orders){replay=actBattle(replay,action);assert.equal(replay.lastError,null);}assert.deepEqual(replay,battle);assert.deepEqual(JSON.parse(JSON.stringify(replay)),battle);
 assert.deepEqual(initial,blockedRifleLane(),'the declared input has no controller memory or preparation mutation');
});

test('an admitted useful firing posture retains its exact ordinary paid order and finite gun state',()=>{
 const battle=createBattle([{id:'rifle',x:3,y:8,facing:2,weapon:1800,marksmanship:60,medkits:0}],{width:24,height:16,tiles:flat(24,16),enemies:[{id:'observed',x:12,y:8,patrol:false,overwatch:false}],deferContact:false});
 const before=structuredClone(battle),unit=battle.units[0],legacy=recoveryPortSearchController(battle)(battle,unit),action=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true})(battle,unit);
 assert.deepEqual(action,legacy);assert.equal(action.type,'stance');assert.equal(action.stance,'crouched');
 const after=actBattle(battle,action);assert.equal(after.lastError,null);assert.equal(after.units[0].ap,unit.ap-stanceCost(unit,action.stance));
 for(const key of ['hp','medkits','loaded','ammo','inventory'])assert.deepEqual(after.units[0][key],unit[key]);assert.deepEqual(after.artillery,battle.artillery);assert.deepEqual(battle,before);
 assert.deepEqual(actBattle(structuredClone(battle),JSON.parse(JSON.stringify(action))),after);
});

test('a supplied qualified physician reaches a real critical patient before following the forward screen',()=>{
 let battle=createBattle([
  {id:'medic',x:3,y:8,medical:93,medkits:8,marksmanship:40},
  {id:'patient',x:6,y:8,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0},
  {id:'screen',x:10,y:8,medical:0,medkits:0},
 ],{width:40,height:16,tiles:flat(40,16),enemies:[{id:'distant',x:39,y:15}],artillery:[]});
 const initial=structuredClone(battle),controller=recoveryPortSearchController(battle,{coordinateInfantry:true,coordinateRifleCover:true}),unit=battle.units[0],patient=battle.units.find(actor=>actor.id==='patient');
 const move=controller(battle,unit);assert.equal(move?.type,'move');assert.ok(Math.hypot(move.x-patient.x,move.y-patient.y)<=1.5);assert.ok(hasLineOfSight(battle,{...unit,...move},patient));
 const route=getReachable(battle,unit).find(point=>sameCell(point,move));assert.ok(route&&route.cost>0&&route.cost<=16);const costs=actionCosts(battle,unit);assert.ok(route.cost+costs.weapon+costs.heal<=unit.ap);
 const orders=[move];battle=actBattle(battle,move);assert.equal(battle.lastError,null);let medic=battle.units.find(actor=>actor.id===unit.id);assert.equal(medic.ap,unit.ap-route.cost);assert.equal(medic.medkits,8);
 const activation=controller(battle,medic);assert.deepEqual(activation,{type:'weapon',unitId:unit.id,slot:'medical'});orders.push(activation);const switchCost=actionCosts(battle,medic).weapon;
 battle=actBattle(battle,activation);assert.equal(battle.lastError,null);assert.equal(battle.units.find(actor=>actor.id===unit.id).ap,medic.ap-switchCost);medic=battle.units.find(actor=>actor.id===unit.id);
 const aid=controller(battle,medic);assert.deepEqual(aid,{type:'useItem',unitId:unit.id,targetId:patient.id});const preview=medicalUsePreview(battle,medic,battle.units.find(actor=>actor.id===patient.id));assert.equal(preview.allowed,true,preview.reason);orders.push(aid);
 battle=actBattle(battle,aid);assert.equal(battle.lastError,null);assert.equal(battle.units.find(actor=>actor.id===unit.id).medkits,7);assert.equal(battle.units.find(actor=>actor.id===unit.id).ap,medic.ap-preview.cost);
 assert.ok(battle.units.find(actor=>actor.id===patient.id).hp>patient.hp);assert.ok(battle.units.find(actor=>actor.id===patient.id).bleeding<patient.bleeding);
 let replay=structuredClone(initial);for(const action of orders)replay=actBattle(replay,action);assert.deepEqual(replay,battle);assert.deepEqual(JSON.parse(JSON.stringify(replay)),battle);assert.deepEqual(initial.units.find(actor=>actor.id==='screen'),battle.units.find(actor=>actor.id==='screen'));
});

test('a blocked reserve firing posture cannot bypass its actual rear movement duty',()=>{
 const battle=blockedRifleLane(),before=structuredClone(battle),unit=battle.units[0],controller=recoveryPortSearchController(battle,{reserveIds:[unit.id],coordinateInfantry:true,coordinateRifleCover:true});
 const action=controller(battle,unit);assert.ok(action?.type!=='stance','a useless firing posture does not restart the paid stance cycle');
 if(action){assert.equal(action.type,'move');assert.ok(action.x<=Math.max(0,battle.units.find(actor=>actor.id==='friend').x-4));const after=actBattle(battle,action);assert.equal(after.lastError,null);for(const key of ['hp','loaded','ammo','medkits'])assert.equal(after.units.find(actor=>actor.id===unit.id)[key],unit[key]);}
 assert.deepEqual(battle,before);
});


// Independent declared interrupt: a normal melee advance earns the callback.
// Low hard cover blocks the torso; a teammate observes the exposed head. No
// captured state or post-factory body, AP, phase, equipment or map edit is used.
import {endTurn,presentedActBattle,presentedEndTurn,interruptAvailable,shotChance,artilleryContact} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';

const interruptMember=(battle,id)=>battle.units.find(unit=>unit.id===id);
function sharedInterruptField({eligible=true,visible=true,loaded=1,clinical=false,reserve=false,gun=false,aid=false}={}){
 const common={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,shock:0,morale:90,
  weapon:1800,blade:0,loaded:1,ammo:5,condition:100,jammed:false,medical:0,medkits:0,
  activeSlot:'primary',stance:'standing',movementMode:'walk',mounted:false,horse:false,
  inventory:{},rations:0,torches:0,boleadoras:0,patrol:false,overwatch:false};
 const players=[
  {...common,id:'reactor',name:'Fusilero interrumpido',x:3,y:3,facing:6,marksmanship:100,loaded,
   agility:eligible?100:1,wisdom:eligible?100:1,experienceLevel:eligible?10:1,
   medical:clinical?80:aid?30:0,medkits:clinical||aid?2:0,activeSlot:clinical||aid?'medical':'primary'},
  {...common,id:'observer',name:'Observador',x:3,y:8,facing:visible?2:6,marksmanship:80,
   agility:eligible?1:100,wisdom:eligible?1:100,experienceLevel:eligible?1:10},
  ...(aid?[{...common,id:'patient',name:'Paciente adyacente',x:3,y:4,hp:10,bleeding:3,bandaged:0,weapon:0,loaded:0,ammo:0,agility:1,wisdom:1,experienceLevel:1}]:[]),
 ];
 const tiles=flat(16,10).map(tile=>({...tile,blocked:false,cover:0}));
 for(const y of [2,3,4])Object.assign(tiles[y*16+6],{type:'stone',material:'stone',blocked:true,blocksSight:false,obstacleHeight:1.3,cover:40});
 const options={id:'declared-port-shared-interrupt-rifle',width:16,height:10,tiles,hour:12,seed:45,firstSide:'player',exploration:false,
  enemies:[{...common,id:'advance',name:'Avance realista',x:8,y:3,facing:6,weapon:1809,loaded:0,ammo:0,
   agility:75,wisdom:50,experienceLevel:4,movementMode:'run'}],
  artillery:gun?[{id:'held-gun',type:'bronze4',side:'player',x:3,y:2,facing:0,loaded:true,ammo:1}]:[],npcs:[],props:[],groundItems:[],buildings:[]};
 const declared=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declared);
 // Stone is cell-wide cover; authored wall cells would migrate to thin edges.
 assert.deepEqual(battle.tiles.filter(tile=>tile.blocked),tiles.filter(tile=>tile.blocked));assert.deepEqual(battle.wallEdges,[]);
 return {battle,options:{reserveIds:reserve?['reactor']:[],fieldPhysicianIds:clinical?['reactor']:[],coordinateInfantry:true,coordinateRifleCover:true}};
}
function sharedInterruptReplay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=(action.type==='endTurn'?presentedEndTurn(shown):presentedActBattle(shown,JSON.parse(JSON.stringify(action)))).state;assert.deepEqual(shown,direct);
  stored=action.type==='endTurn'?endTurn(stored):actBattle(stored,JSON.parse(JSON.stringify(action)));assert.equal(stored.lastError,null);stored=validateBattleSnapshot(JSON.parse(JSON.stringify(stored)));assert.deepEqual(stored,direct);
 }
 return direct;
}

test('an earned infantry interrupt pays for a safe currently observed head shot before ordinary noise investigation',()=>{
 const {battle:start,options}=sharedInterruptField(),before=structuredClone(start),end={type:'endTurn'},orders=[];let ready=start;
 const {ap:initialAP,facing:initialFacing,...initialBody}=interruptMember(start,'reactor');assert.equal(initialAP,100);assert.equal(initialFacing,6);assert.equal(interruptMember(start,'reactor').lastKnownEnemy,undefined);
 // Every paid turn faces away from the eastern enemy; the full prefix must
 // leave only a real shot budget, without creating personal contact memory.
 for(let pass=0;pass<16&&interruptMember(ready,'reactor').ap>20;pass++)for(const [x,y,facing,expected] of [[0,0,7,2],[0,6,5,4],[0,3,6,2]]){
  const prior=interruptMember(ready,'reactor'),action={type:'look',unitId:prior.id,x,y},pa=turnAPCost(prior,directionTo(prior,action));assert.equal(directionTo(prior,action),facing);assert.equal(pa,expected);assert.ok(prior.ap-pa>=20);
  orders.push(action);ready=sharedInterruptReplay(ready,[action]);const turned=interruptMember(ready,prior.id);assert.equal(turned.ap,prior.ap-pa);assert.equal(turned.facing,facing);assert.equal(turned.lastKnownEnemy,undefined);assert.equal(ready.phase,'player');
 }
 const {ap:preparedAP,facing:preparedFacing,...preparedBody}=interruptMember(ready,'reactor');assert.equal(preparedAP,20);assert.equal(initialAP-preparedAP,80);assert.equal(preparedFacing,initialFacing);assert.equal(orders.length,30);assert.ok(orders.length<=16*3);assert.deepEqual(preparedBody,initialBody);
 for(const member of start.units.filter(member=>member.id!=='reactor'))assert.deepEqual(interruptMember(ready,member.id),member);
 assert.deepEqual(ready.tiles,start.tiles);assert.deepEqual(ready.wallEdges,start.wallEdges);assert.deepEqual(ready.artillery,start.artillery);assert.equal(ready.seed,start.seed);assert.equal(ready.elapsedSeconds,start.elapsedSeconds+6);assert.equal(ready.turn,start.turn);assert.deepEqual(sharedInterruptReplay(start,orders),ready);assert.deepEqual(start,before);
 orders.push(end);const paused=sharedInterruptReplay(start,orders);
 const actor=interruptMember(paused,'reactor'),target=interruptMember(paused,'advance'),observer=interruptMember(paused,'observer');
 assert.equal(paused.phase,'interrupt');assert.equal(paused.turn,start.turn);assert.deepEqual(paused.interrupt.unitIds,['reactor']);assert.equal(interruptAvailable(paused,actor),true);
 assert.equal(actor.ap,preparedAP);assert.equal(actor.lastKnownEnemy,undefined);assert.equal(actor.hp,100);assert.equal(observer.hp,100);assert.ok(!sameCell(target,interruptMember(start,target.id)));assert.ok(target.ap<interruptMember(start,target.id).ap);assert.equal(paused.elapsedSeconds,ready.elapsedSeconds);
 const blockers=paused.tiles.filter(tile=>tile.blocked);assert.equal(blockers.length,3);assert.deepEqual(blockers,start.tiles.filter(tile=>tile.blocked));for(const blocker of blockers)assert.equal(teamCanSee(paused,actor.side,blocker),true,'The current cell-wide stone blocker must be public before its shot forecast.');
 assert.equal(canSee(paused,actor,target),false);assert.equal(teamCanSee(paused,actor.side,target),true);assert.ok(actor.lastHeardNoise);assert.equal(shotChance(paused,actor,target,4,'torso'),0,JSON.stringify({scope:'Actual returned endTurn before ordinary or opt-in policy consultation; no reconstructed scene.',orders,status:paused.status,mode:paused.mode,phase:paused.phase,turn:paused.turn,elapsedSeconds:paused.elapsedSeconds,roundTimeCharged:paused.roundTimeCharged,interrupt:paused.interrupt,enemyTurn:paused.enemyTurn,reactionStack:paused.reactionStack,actor,target,observer,tiles:paused.tiles,wallEdges:paused.wallEdges,upperSurfaces:paused.upperSurfaces,props:paused.props,artillery:paused.artillery,smoke:paused.smoke,log:paused.log.slice(-12)}));
 const normalCosts=actionCosts(paused,actor,target);assert.ok(normalCosts.fire>0&&normalCosts.fire<=actor.ap);assert.ok(actor.ap<normalCosts.fire+normalCosts.aim*2+6,'The actual paid prefix must exclude the ordinary optional firing posture.');
 const ordinary=coastalBatteryController(start,{sharedArtillerySight:true})(paused,actor);assert.ok(['move','look'].includes(ordinary?.type),JSON.stringify(ordinary));
 const disabled=recoveryPortSearchController(start,{...options,coordinateRifleCover:false});assert.deepEqual(disabled(paused,actor),ordinary);
 const controller=recoveryPortSearchController(start,options),action=controller(paused,actor),view=publicRouteView(paused,actor);assert.equal(action?.type,'fire');assert.equal(action.targetId,target.id);assert.equal(action.hitLocation,'head');assert.deepEqual(action,usefulRouteRifleShot(view,actor));
 const option=firearmShotOptions(paused,actor,target,action.aim).find(option=>option.aim===action.aim&&option.hitLocation===action.hitLocation),costs=actionCosts(paused,actor,target),paid=costs.fire+action.aim*costs.aim;
 assert.ok(option.chance>=25&&option.damageFactor>0&&knownRouteShotSafety(paused,actor,target)(option));assert.ok(costs.turn>0&&paid>0&&paid<=actor.ap);
 const result=sharedInterruptReplay(start,[...orders,action]),fired=interruptMember(result,actor.id);assert.equal(fired.ap,actor.ap-paid);assert.equal(fired.loaded,actor.loaded-1);assert.equal(fired.ammo,actor.ammo);assert.equal(fired.condition,actor.condition-1);
 assert.equal(result.elapsedSeconds,paused.elapsedSeconds);assert.equal(result.turn,paused.turn);assert.notEqual(result.seed,paused.seed);assert.deepEqual(result.tiles,paused.tiles);assert.deepEqual(result.artillery,paused.artillery);
 for(const member of paused.units){assert.deepEqual(spacePoint(interruptMember(result,member.id)),spacePoint(member));assert.equal(interruptMember(result,member.id).medkits,member.medkits);assert.deepEqual(interruptMember(result,member.id).inventory,member.inventory);}
 assert.deepEqual(interruptMember(result,'observer'),observer);const repeated=sharedInterruptField();assert.deepEqual(repeated.battle,start);assert.deepEqual(sharedInterruptReplay(repeated.battle,[...orders,action]),result);assert.deepEqual(start,before);
});

test('interrupt shot priority preserves Native eligibility finite care held roles and unpayable or unseen ordinary work',()=>{
 for(const profile of [{eligible:false},{visible:false},{loaded:0},{clinical:true},{reserve:true},{gun:true},{aid:true},{spent:true}]){
  const {battle:start,options}=sharedInterruptField(profile),before=structuredClone(start),orders=[];let ready=start;
  if(profile.spent){
   // Earn the low remainder with real turns, ending at the declared west facing.
   for(let pass=0;pass<16&&interruptMember(ready,'reactor').ap>=11;pass++)for(const point of [{x:3,y:0},{x:0,y:3}]){
    const action={type:'look',unitId:'reactor',...point},prior=interruptMember(ready,'reactor'),pa=turnAPCost(prior,directionTo(prior,point));assert.ok(pa>0&&prior.ap>=pa);orders.push(action);ready=sharedInterruptReplay(start,orders);assert.equal(interruptMember(ready,'reactor').ap,prior.ap-pa);
   }
  }
  orders.push({type:'endTurn'});const paused=sharedInterruptReplay(start,orders),actor=interruptMember(paused,'reactor'),legacy=recoveryPortSearchController(start,{...options,coordinateRifleCover:false}),current=recoveryPortSearchController(start,options);
  assert.equal(paused.phase,'interrupt');assert.equal(actor.ap,interruptMember(ready,'reactor').ap);assert.deepEqual(current(paused,actor),legacy(paused,actor),JSON.stringify(profile));
  if(profile.eligible===false)assert.equal(interruptAvailable(paused,actor),false);else assert.equal(interruptAvailable(paused,actor),true);
  if(profile.visible===false)assert.equal(teamCanSee(paused,actor.side,interruptMember(paused,'advance')),false);
  if(profile.loaded===0)assert.equal(actor.loaded,0);
  if(profile.gun)assert.equal(artilleryContact(paused,actor,paused.artillery[0]),true);
  if(profile.spent){assert.ok(actor.ap>=3);assert.ok(actor.ap<actionCosts(paused,actor,interruptMember(paused,'advance')).fire);}
  if(profile.aid){
   const patient=interruptMember(paused,'patient'),action=current(paused,actor),quote=medicalUsePreview(paused,actor,patient);assert.equal(quote.allowed,true,quote.reason);assert.deepEqual(action,{type:'useItem',unitId:actor.id,targetId:patient.id});
   const result=sharedInterruptReplay(start,[...orders,action]),treated=interruptMember(result,actor.id);assert.equal(treated.ap,actor.ap-quote.cost);assert.equal(treated.medkits,actor.medkits-quote.treatment.dressingsUsed);assert.equal(interruptMember(result,patient.id).bleeding,quote.treatment.bleedingAfter);
  }
  assert.deepEqual(start,before);
 }
});
