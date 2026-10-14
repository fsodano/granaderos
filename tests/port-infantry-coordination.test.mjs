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
