import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,interruptAvailable,artilleryCrewPlan,artilleryCosts,artilleryContact} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {sameCell} from '../game/tactical-space.js';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {mendozaBatteryController,mountainPassBatteryController} from './fresh-cuyo-fixture.mjs';
import {openingControlWindow} from './opening-driver.mjs';

for(const type of ['swivel','field8'])test(`packed ${type} staging pays the native full crew and preserves finite charges`,()=>{
 const initial=createBattle([
  {id:'a',x:9,y:0},{id:'b',x:10,y:0},{id:'c',x:11,y:0},
  {id:'d',x:12,y:0},{id:'e',x:13,y:0},{id:'f',x:14,y:0},
 ],{width:24,height:20,exploration:true,enemies:[],tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'checked',type,side:'player',x:10,y:1,loaded:true,ammo:6},{id:'other',type:'bronze4',side:'player',x:11,y:1,loaded:true,ammo:6}]});
 const before=structuredClone(initial),controller=stagedBatteryController(),action=initial.units.map(unit=>controller(initial,unit)).find(Boolean);
 assert.ok(actBattle(initial,{type:'artilleryMove',unitId:'a',artilleryId:'checked',x:11,y:1}).lastError,'the next approach cell is occupied by the other physical carriage');
 assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'checked');
 const actor=initial.units.find(unit=>unit.id===action.unitId),gun=initial.artillery.find(gun=>gun.id===action.artilleryId),cost=artilleryCosts(initial,actor,gun).move;
 const plan=artilleryCrewPlan(initial,actor,gun,cost);assert.equal(plan.reason,null);assert.equal(plan.crew.length,artilleryProfile(initial,gun).crew);assert.equal(plan.crew.length,type==='field8'?3:1);
 assert.ok(cost>0&&plan.crew.every(id=>artilleryContact(initial,initial.units.find(unit=>unit.id===id),gun)));
 const moved=actBattle(initial,action);assert.equal(moved.lastError,null);
 const translated=moved.artillery.find(piece=>piece.id===gun.id),dx=translated.x-gun.x,dy=translated.y-gun.y;assert.equal(Math.abs(dx)+Math.abs(dy),1);
 for(const unit of initial.units){
  const after=moved.units.find(other=>other.id===unit.id);
  if(plan.crew.includes(unit.id)){
   assert.equal(after.x,unit.x+dx);assert.equal(after.y,unit.y+dy);assert.ok(artilleryContact(moved,after,translated));
  }else{assert.equal(after.x,unit.x);assert.equal(after.y,unit.y);assert.equal(after.energy,unit.energy);}
  assert.equal(after.ap,unit.ap,'ordinary exploration charges native elapsed time, without a fabricated AP debit');assert.equal(after.energy,unit.energy,'artillery dragging does not impose an extra energy charge');
  for(const key of ['hp','bleeding','loaded','ammo','medkits','inventory'])assert.deepEqual(after[key],unit[key]);
  assert.equal(moved.artillery.some(piece=>sameCell(piece,after)),false);
 }
 assert.ok(moved.elapsedSeconds>initial.elapsedSeconds);assert.deepEqual(moved.artillery.map(({id,type,loaded,ammo})=>({id,type,loaded,ammo})),initial.artillery.map(({id,type,loaded,ammo})=>({id,type,loaded,ammo})));
 const replayController=stagedBatteryController(),replayAction=initial.units.map(unit=>replayController(initial,unit)).find(Boolean);assert.deepEqual(replayAction,action);assert.deepEqual(actBattle(initial,replayAction),moved);assert.deepEqual(initial,before);
 const combat=createBattle(initial.units,{width:24,height:20,enemies:[{id:'distant',x:23,y:19}],tiles:initial.tiles,artillery:initial.artillery}),combatActor=combat.units.find(unit=>unit.id===actor.id),combatGun=combat.artillery.find(piece=>piece.id===gun.id),combatCost=artilleryCosts(combat,combatActor,combatGun).move;
 const combatPlan=artilleryCrewPlan(combat,combatActor,combatGun,combatCost);assert.equal(combatPlan.reason,null);assert.equal(combatPlan.crew.length,type==='field8'?3:1);
 const paid=actBattle(combat,action);assert.equal(paid.lastError,null);for(const unit of combat.units){const after=paid.units.find(other=>other.id===unit.id);assert.equal(after.ap,unit.ap-(combatPlan.crew.includes(unit.id)?combatCost:0));assert.equal(after.energy,unit.energy);}
 const missing=createBattle(initial.units.map(unit=>plan.crew.includes(unit.id)&&unit.id!==actor.id?{...unit,hp:0}:type==='swivel'&&unit.id===actor.id?{...unit,hp:0}:unit),{width:24,height:20,exploration:true,enemies:[],tiles:initial.tiles,artillery:initial.artillery});
 if(type==='field8'){
  const remaining=missing.units.find(unit=>unit.id===actor.id);assert.ok(artilleryCrewPlan(missing,remaining,missing.artillery.find(piece=>piece.id===gun.id),cost).reason,'two missing real members cannot provide the three-person field crew');
 }
});

test('Mendoza keeps the coastal policy with only one supplied player gun',()=>{
 const units=[{id:'11',x:11,y:19},{id:'0',x:12,y:19},{id:'2',x:5,y:19},{id:'147',x:18,y:19}];
 const gun={id:'arrival-gun',type:'bronze4',side:'player',x:11,y:18,loaded:true,ammo:6};
 for(const extra of [[],[{id:'empty',type:'bronze4',side:'player',x:5,y:10,loaded:false,ammo:0}],[{id:'empty-heavy',type:'field8',side:'player',x:5,y:10,loaded:false,ammo:0}],[{id:'enemy-gun',type:'field8',side:'enemy',x:20,y:2,loaded:true,ammo:6}]]){
  const initial=createBattle(units,{width:24,height:20,exploration:true,enemies:[],
   tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),artillery:[gun,...extra]});
  const before=structuredClone(initial),controller=mendozaBatteryController(initial),expected=coastalBatteryController(initial,{sharedArtillerySight:true});
  for(const order of [initial.units,[...initial.units].reverse()])for(const unit of order)assert.deepEqual(controller(initial,unit),expected(initial,unit));
  const mountain=mountainPassBatteryController(initial),staged=stagedBatteryController();for(const unit of initial.units)assert.deepEqual(mountain(initial,unit),staged(initial,unit),'an opposing or depleted heavy piece cannot change the light-only mountain doctrine');
  assert.deepEqual(initial,before);
 }
});

test('Mendoza stages two crowded supplied guns with an admitted real crew order',()=>{
 const initial=createBattle([
  {id:'104',x:12,y:0},{id:'140',x:11,y:0},{id:'134',x:13,y:0},
  {id:'125',x:10,y:0},{id:'133',x:14,y:0},{id:'100',x:9,y:0},
 ],{width:24,height:20,exploration:true,enemies:[],
  tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'arsenal:cordoba:2',type:'bronze4',side:'player',x:12,y:1,loaded:true,ammo:6},
   {id:'arsenal:buenos_aires:1',type:'bronze4',side:'player',x:11,y:1,loaded:true,ammo:6}],
 });
 const before=structuredClone(initial),controller=mendozaBatteryController(initial);
 const blocked=actBattle(initial,{type:'artilleryMove',unitId:'104',artilleryId:'arsenal:cordoba:2',x:12,y:2});
 assert.ok(blocked.lastError,'the real translated crew overlaps the other arrival carriage');
 assert.deepEqual(blocked.artillery,initial.artillery,'the rejected preview cannot move either gun');
 const actions=initial.units.map(unit=>controller(initial,unit)).filter(Boolean);
 assert.equal(actions.length,1,'the arrival stage selects one physically legal crew translation');
 assert.equal(actions[0].type,'artilleryMove');
 const moved=actBattle(initial,actions[0]);assert.equal(moved.lastError,null);
 assert.ok(moved.artillery.some(gun=>gun.y>1),'the actual factory must clear the packed arrival row');
 assert.deepEqual(moved.artillery.map(({id,loaded,ammo})=>({id,loaded,ammo})),initial.artillery.map(({id,loaded,ammo})=>({id,loaded,ammo})),'staging preserves both canonical guns and all finite shots');
 const living=moved.units.filter(unit=>unit.hp>0).map(unit=>`${unit.x},${unit.y},${unit.tacticalLevel??0}`);
 assert.equal(new Set(living).size,living.length,'translated crew cannot overlap living bodies');
 const replayController=mendozaBatteryController(initial),replayAction=initial.units.map(unit=>replayController(initial,unit)).find(Boolean);
 assert.deepEqual(replayAction,actions[0]);assert.deepEqual(actBattle(initial,replayAction),moved);
 assert.deepEqual(initial,before);
});

test('two supplied uncrowded arrival guns admit paid infantry screening and preserve their finite custody',()=>{
 const initial=createBattle([
  {id:'front-a',x:17,y:0},{id:'front-b',x:18,y:0},
  {id:'rear-a',x:5,y:0},{id:'rear-b',x:6,y:0},
  {id:'screen',x:12,y:0,marksmanship:80},
 ],{width:24,height:20,exploration:true,enemies:[],tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'rear',type:'bronze4',side:'player',x:5,y:1,loaded:true,ammo:2},{id:'front',type:'bronze4',side:'player',x:18,y:1,loaded:true,ammo:6}]});
 const before=structuredClone(initial),unit=initial.units.find(u=>u.id==='screen'),controller=stagedBatteryController(),expected=coastalBatteryController(initial,{sharedArtillerySight:true});
 const action=controller(initial,unit);assert.equal(action?.type,'move');assert.equal(action.unitId,unit.id);assert.deepEqual(action,expected(initial,unit));
 const moved=actBattle(initial,action);assert.equal(moved.lastError,null);assert.ok(moved.elapsedSeconds>initial.elapsedSeconds);assert.deepEqual(moved.artillery,initial.artillery);
 assert.notDeepEqual({x:moved.units.find(u=>u.id===unit.id).x,y:moved.units.find(u=>u.id===unit.id).y},{x:unit.x,y:unit.y});
 assert.deepEqual(presentedActBattle(initial,action).state,moved);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(moved))),moved);assert.deepEqual(initial,before);
 const replay=stagedBatteryController();assert.deepEqual(replay(initial,unit),action);assert.deepEqual(actBattle(initial,replay(initial,unit)),moved);
});

test('nearby supplied guns beyond the arrival apron use ordinary current-position screening',()=>{
 const initial=createBattle([
  {id:'a',x:9,y:5},{id:'b',x:10,y:5},{id:'c',x:11,y:5},{id:'d',x:12,y:5},{id:'screen',x:3,y:5},
 ],{width:24,height:20,exploration:true,enemies:[],tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'left',type:'bronze4',side:'player',x:10,y:6,loaded:true,ammo:2},{id:'right',type:'bronze4',side:'player',x:11,y:6,loaded:true,ammo:6}]});
 const before=structuredClone(initial),controller=stagedBatteryController(),ordinary=coastalBatteryController(initial,{sharedArtillerySight:true});
 for(const unit of initial.units)assert.deepEqual(controller(initial,unit),ordinary(initial,unit));
 const unit=initial.units.find(u=>u.id==='screen'),action=controller(initial,unit);assert.equal(action?.type,'move');
 const next=actBattle(initial,action);assert.equal(next.lastError,null);assert.ok(next.elapsedSeconds>initial.elapsedSeconds);assert.deepEqual(next.artillery,initial.artillery);assert.deepEqual(initial,before);
});

test('adjacent finite aid remains available while a genuine arrival conflict is cleared',()=>{
 let battle=createBattle([
  {id:'left-a',x:10,y:0},{id:'left-b',x:11,y:0},{id:'right-a',x:12,y:0},{id:'right-b',x:13,y:0},
  {id:'doctor',x:15,y:0,medical:80,medkits:2},{id:'patient',x:16,y:0,hp:12,maxHp:80,bleeding:2},
 ],{width:24,height:20,exploration:true,enemies:[],tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'left',type:'bronze4',side:'player',x:11,y:1,loaded:true,ammo:2},{id:'right',type:'bronze4',side:'player',x:12,y:1,loaded:true,ammo:6}]});
 const initial=structuredClone(battle),controller=stagedBatteryController(),orders=[];
 for(let step=0;step<2;step++){
  const doctor=battle.units.find(u=>u.id==='doctor'),action=controller(battle,doctor);assert.ok(action);
  assert.equal(action.type,step===0?'weapon':'useItem');if(step===0)assert.equal(action.slot,'medical');else assert.equal(action.targetId,'patient');
  const next=actBattle(battle,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(battle,action).state,next);orders.push(action);battle=next;
 }
 const doctor=battle.units.find(u=>u.id==='doctor'),patient=battle.units.find(u=>u.id==='patient');
 assert.equal(doctor.medkits,initial.units.find(u=>u.id==='doctor').medkits-1);assert.ok(patient.hp>12||patient.bleeding<2||patient.bandaged>0);assert.ok(battle.elapsedSeconds>initial.elapsedSeconds);assert.deepEqual(battle.artillery,initial.artillery);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(initial)));const replayController=stagedBatteryController();
 for(const action of orders){assert.deepEqual(replayController(replay,replay.units.find(u=>u.id==='doctor')),action);replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,action))));}
 assert.deepEqual(replay,battle);assert.deepEqual(initial,validateBattleSnapshot(JSON.parse(JSON.stringify(initial))));
});

test('the staged fallback uses current crew positions without retaining assignments from another battle state',()=>{
 const units=[{id:'11',x:4,y:6},{id:'0',x:5,y:5},{id:'2',x:4,y:8},{id:'147',x:5,y:9},{id:'138',x:2,y:5},{id:'57',x:1,y:4}];
 for(const exploration of [true,false]){
  const options={width:20,height:12,tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),exploration,enemies:[],artillery:[
   {id:'front',type:'bronze4',side:'player',x:5,y:6,loaded:!exploration,ammo:exploration?0:6},
   {id:'rear',type:'bronze4',side:'player',x:5,y:8,loaded:!exploration,ammo:exploration?0:6},
  ]};
  const initial=createBattle(units,options),casualty=createBattle(units.map(u=>u.id==='11'?{...u,hp:0}:u),options),controller=stagedBatteryController();
  for(const battle of [initial,casualty,initial]){
   const before=structuredClone(battle),expected=coastalBatteryController(battle,{sharedArtillerySight:true});
   for(const order of [battle.units,[...battle.units].reverse()])for(const unit of order)assert.deepEqual(controller(battle,unit),expected(battle,unit));
   assert.deepEqual(battle,before);
  }
 }
});

test('three crowded arrival guns advance with real crews without overlapping living bodies',()=>{
 const initial=createBattle([
  {id:'5',x:12,y:0},{id:'120',x:11,y:0},{id:'123',x:13,y:0},
  {id:'111',x:10,y:0},{id:'133',x:14,y:0},{id:'3',x:9,y:0},
 ],{
  width:24,height:20,exploration:true,enemies:[],
  tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[12,11,13].map((x,i)=>({id:`piece-${i}`,type:'bronze4',side:'player',x,y:1,loaded:true,ammo:6})),
 });
 const before=structuredClone(initial),controller=stagedBatteryController();
 // Use the actual round-robin native window. Always choosing the first
 // available actor would spend one crew's whole approach before the others.
 const window=openingControlWindow(initial,{controller});let battle=initial;const actions=window.orders;
 assert.ok(actions.length>0&&actions.length<=16*initial.units.length);
 for(const action of actions){
  const next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);
  const cells=next.units.filter(u=>u.hp>0).map(u=>`${u.x},${u.y}`);
  assert.equal(new Set(cells).size,cells.length,'living crew members cannot occupy the same cell');
  battle=next;
 }
 assert.deepEqual(battle,window.battle);
 assert.ok(battle.artillery.every(g=>g.y>1),'all three guns leave the arrival row');
 assert.ok(battle.artillery.every(g=>g.loaded&&g.ammo===6),'movement does not invent or spend shells');
 let replay=initial;const replayController=stagedBatteryController();
 for(const action of actions){
  assert.deepEqual(replayController(replay,replay.units.find(unit=>unit.id===action.unitId)),action);
  replay=actBattle(replay,action);
 }
 assert.deepEqual(replay,battle);assert.deepEqual(initial,before);
});

test('a gun crew keeps a usable stance while waiting instead of spending AP in a stance loop',()=>{
 let battle=createBattle([{id:'3',x:4,y:5},{id:'5',x:5,y:5}],{
  width:40,height:16,enemies:[{id:'distant',x:37,y:8}],
  tiles:Array.from({length:640},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass'})),
  artillery:[{id:'gun',type:'bronze4',side:'player',x:4,y:4,loaded:true,ammo:6}],
 });
 const controller=stableCrewController();
 for(const id of ['3','5']){
  const unit=battle.units.find(u=>u.id===id),action=controller(battle,unit);
  assert.deepEqual(action,{type:'stance',unitId:id,stance:'crouched'});
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 }
 const before=structuredClone(battle);
 for(const unit of battle.units.filter(u=>u.side==='player'))assert.equal(controller(battle,unit),null);
 assert.deepEqual(battle,before);
});

test('a single arriving gun advances with its infantry screen before contact',()=>{
 const initial=createBattle([
  {id:'11',x:11,y:19},{id:'0',x:12,y:19},
  {id:'2',x:5,y:19},{id:'147',x:18,y:19},
 ],{width:24,height:20,exploration:true,night:true,enemies:[{id:'sentry',x:15,y:4}],
  tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[{id:'arrival-gun',type:'bronze4',side:'player',x:11,y:18,loaded:true,ammo:6}],
 });
 const before=structuredClone(initial),controller=stagedBatteryController(),scout=initial.units.find(u=>u.id==='2');
 const first=controller(initial,scout);
 assert.equal(first?.type,'move','infantry must receive an ordinary screen move while a single gun can advance');
 assert.equal(first.unitId,scout.id);
 const preview=actBattle(initial,first);assert.equal(preview.lastError,null);
 const moved=preview.units.find(u=>u.id===scout.id),gun=preview.artillery[0];
 assert.ok(Math.hypot(moved.x-gun.x,moved.y-gun.y)<=4,'the first infantry bound stays within gun support');
 let battle=initial;const actions=[];
 for(let window=0;window<20&&battle.mode==='exploration';window++){
  const ids=battle.units.filter(u=>u.side==='player').sort((a,b)=>b.marksmanship-a.marksmanship).map(u=>u.id);
  for(let attempt=0;attempt<16&&battle.mode==='exploration';attempt++){
   let acted=false;
   for(const id of ids){
    if(battle.mode!=='exploration')break;
    const unit=battle.units.find(u=>u.id===id);if(!interruptAvailable(battle,unit)||unit.ap<3)continue;
    const action=controller(battle,unit);if(!action)continue;
    const next=actBattle(battle,action);assert.equal(next.lastError,null);
    battle=next;actions.push(action);acted=true;
   }
   if(!acted)break;
  }
  if(battle.mode==='exploration'){battle=endTurn(battle);actions.push({type:'endTurn'});}
 }
 assert.equal(battle.mode,'combat','ordinary screened exploration must find the sentry');
 for(const id of ['2','147']){
  const unit=battle.units.find(u=>u.id===id),arrival=initial.units.find(u=>u.id===id),gun=battle.artillery[0];
  assert.notDeepEqual({x:unit.x,y:unit.y},{x:arrival.x,y:arrival.y},'infantry must leave the arrival row before contact');
  assert.ok(Math.hypot(unit.x-gun.x,unit.y-gun.y)<=6,'infantry must be within the native night sight range of the gun at first contact');
 }
 assert.ok(battle.artillery[0].loaded&&battle.artillery[0].ammo===6,'the approach must preserve finite shells');
 let replay=initial;for(const action of actions)replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);
 assert.deepEqual(replay,battle);assert.deepEqual(initial,before);
});
