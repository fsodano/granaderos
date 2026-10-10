import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,interruptAvailable} from '../game/tactical.js';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {mendozaBatteryController} from './fresh-cuyo-fixture.mjs';

test('Mendoza keeps the coastal policy with only one supplied player gun',()=>{
 const units=[{id:'11',x:11,y:19},{id:'0',x:12,y:19},{id:'2',x:5,y:19},{id:'147',x:18,y:19}];
 const gun={id:'arrival-gun',type:'bronze4',side:'player',x:11,y:18,loaded:true,ammo:6};
 for(const extra of [[],[{id:'empty',type:'bronze4',side:'player',x:5,y:10,loaded:false,ammo:0}],[{id:'enemy-gun',type:'bronze4',side:'enemy',x:20,y:2,loaded:true,ammo:6}]]){
  const initial=createBattle(units,{width:24,height:20,exploration:true,enemies:[],
   tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),artillery:[gun,...extra]});
  const before=structuredClone(initial),controller=mendozaBatteryController(initial),expected=coastalBatteryController(initial,{sharedArtillerySight:true});
  for(const order of [initial.units,[...initial.units].reverse()])for(const unit of order)assert.deepEqual(controller(initial,unit),expected(initial,unit));
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
 let battle=initial;const actions=[];
 for(let step=0;step<12;step++){
  const action=battle.units.map(unit=>controller(battle,unit)).find(Boolean);
  assert.ok(action,'a legal crew must clear the crowded arrival lane');
  const next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);
  const cells=next.units.filter(u=>u.hp>0).map(u=>`${u.x},${u.y}`);
  assert.equal(new Set(cells).size,cells.length,'living crew members cannot occupy the same cell');
  actions.push(action);battle=next;
 }
 assert.ok(battle.artillery.every(g=>g.y>1),'all three guns leave the arrival row');
 assert.ok(battle.artillery.every(g=>g.loaded&&g.ammo===6),'movement does not invent or spend shells');
 let replay=initial;const replayController=stagedBatteryController();
 for(const action of actions){
  assert.deepEqual(replay.units.map(unit=>replayController(replay,unit)).find(Boolean),action);
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
