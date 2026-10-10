import {tucumanCombatOrder} from './tucuman-driver.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,artilleryContact} from '../game/tactical.js';
import {santaFeBatteryOrder,humahuacaBatteryOrder,coastalBatteryController} from './coastal-command-driver.mjs';
import {mountainBatteryOrder,mendozaBatteryOrder} from './mountain-battery-driver.mjs';

test('a battery order moves its assigned cannon when two guns are within reach',()=>{
 const battle=createBattle([{id:'105',x:6,y:2},{id:'128',x:6,y:1}],{
  width:20,height:12,tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),
  exploration:true,enemies:[],artillery:[
   {id:'rear',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6},
   {id:'front',type:'bronze4',side:'player',x:5,y:2,loaded:true,ammo:6},
  ],
 });
 const action=mountainBatteryOrder(battle,battle.units[0],{leaderId:'105',helperId:'128',artilleryId:'front'});
 assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'front');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.deepEqual(next.artillery[0],battle.artillery[0],'the other cannon does not move');
 assert.notDeepEqual(next.artillery[1],battle.artillery[1]);
 assert.equal(next.artillery[1].loaded,true);assert.equal(next.artillery[1].ammo,6);
});

test('an assigned helper joins its distant cannon instead of scouting ahead alone',()=>{
 const battle=createBattle([{id:'2',x:4,y:3},{id:'147',x:4,y:1},{id:'57',x:4,y:2}],{
  width:24,height:12,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  exploration:true,enemies:[],artillery:[{id:'second-gun',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6}],
 });
 const helper=battle.units.find(u=>u.id==='147');
 const action=mountainBatteryOrder(battle,helper,{leaderId:'2',helperId:'147',artilleryId:'second-gun',screenDistance:3,keepCrewTogether:true});
 assert.equal(action?.type,'move');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 const joined=next.units.find(u=>u.id===helper.id),gun=next.artillery[0];
 assert.ok(Math.hypot(joined.x-gun.x,joined.y-gun.y)<=1.5);
 assert.notEqual(`${joined.x},${joined.y}`,'4,2','the living commander blocks his cell');
 assert.deepEqual(next.artillery,battle.artillery,'joining does not move or spend the cannon');
 assert.equal(mountainBatteryOrder(next,joined,{leaderId:'2',helperId:'147',artilleryId:gun.id,screenDistance:3,keepCrewTogether:true}),null,'the helper stays with the crew');
});

test('an assigned helper walks around a blocked corner before operating the gun',()=>{
 const battle=createBattle([{id:'2',x:6,y:3},{id:'147',x:4,y:2}],{
  width:24,height:12,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false})),
  wallEdges:[{x:4,y:3,axis:'x'},{x:4,y:4,axis:'x'},{x:4,y:3,axis:'y'},{x:5,y:3,axis:'y'}].map((edge,i)=>({...edge,id:`corner:${i}`,type:'wall',blocked:true,blocksSight:true,cover:100})),
  exploration:true,enemies:[],artillery:[{id:'corner-gun',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6}],
 });
 const helper=battle.units.find(u=>u.id==='147'),gun=battle.artillery[0];
 assert.equal(artilleryContact(battle,helper,gun),false);
 const action=mountainBatteryOrder(battle,helper,{leaderId:'2',helperId:'147',artilleryId:gun.id,screenDistance:3,keepCrewTogether:true});
 assert.equal(action?.type,'move');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.equal(artilleryContact(next,next.units.find(u=>u.id===helper.id),next.artillery[0]),true);
 assert.deepEqual(next.artillery,battle.artillery);
});

test('a trapped infantry screen clears the gun even without a forward scouting order',()=>{
 const walls=new Set(['12,10','11,9','11,11']);
 let battle=createBattle([{id:'101',x:9,y:9},{id:'102',x:9,y:11},{id:'125',x:11,y:10}],{
  width:20,height:20,tiles:Array.from({length:400},(_,i)=>{const x=i%20,y=Math.floor(i/20),blocked=walls.has(`${x},${y}`);return {x,y,type:blocked?'wall':'grass',blocked};}),
  exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:10,y:10,loaded:true,ammo:6}],
 });
 const advance={type:'artilleryMove',unitId:'101',artilleryId:'heavy',x:11,y:10};
 assert.ok(actBattle(battle,advance).lastError,'the living infantryman blocks the cannon');
 assert.equal(tucumanCombatOrder(battle,battle.units[2]),null,'the forward reconnaissance route is blocked');
 const action=mendozaBatteryOrder(battle,battle.units[2]);assert.equal(action?.type,'move');
 battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 battle=actBattle(battle,advance);assert.equal(battle.lastError,null);
 assert.equal(battle.artillery[0].x,11);assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
});

test('a bound assistant changes position when a cart blocks the crew translation',()=>{
 let battle=createBattle([{id:'11',x:4,y:3},{id:'0',x:5,y:2}],{
  width:20,height:6,tiles:Array.from({length:120},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'road'})),
  exploration:true,enemies:[],props:[{id:'cart',type:'cart',x:6,y:2,footprint:{width:2,height:1},blocksMovement:true}],
  artillery:[{id:'road-gun',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6}],
 });
 const advance={type:'artilleryMove',unitId:'11',artilleryId:'road-gun',x:6,y:3};
 assert.ok(actBattle(battle,advance).lastError,'the helper would hit the cart');
 const action=mountainBatteryOrder(battle,battle.units[1],{leaderId:'11',helperId:'0',artilleryId:'road-gun',screenDistance:3,keepCrewTogether:true});
 assert.equal(action?.type,'move');
 const elapsed=battle.elapsedSeconds;
 battle=actBattle(battle,action);assert.equal(battle.lastError,null);assert.ok(battle.elapsedSeconds>elapsed);
 battle=actBattle(battle,advance);assert.equal(battle.lastError,null);
 assert.equal(battle.artillery[0].x,6);assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
 assert.equal(battle.props[0].x,6,'the cart remains in place');
});

test('a routed cannon and its living crew take a paid detour around a cart without oscillating',()=>{
 let battle=createBattle([{id:'11',x:4,y:3},{id:'0',x:5,y:2}],{
  width:20,height:6,tiles:Array.from({length:120},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'road'})),
  exploration:true,enemies:[],props:[{id:'cart',type:'cart',x:6,y:3,footprint:{width:2,height:1},blocksMovement:true}],
  artillery:[{id:'road-gun',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6}],
 });
 const initial=structuredClone(battle),positions=new Set(['5,3']);let detoured=false;
 for(let step=0;step<20&&(battle.artillery[0].x!==13||battle.artillery[0].y!==3);step++){
  const action=mountainBatteryOrder(battle,battle.units[0],{leaderId:'11',helperId:'0',artilleryId:'road-gun',routeAroundObstacles:true});
  assert.equal(action?.type,'artilleryMove');
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
  const gun=battle.artillery[0],position=`${gun.x},${gun.y}`;
  assert.ok(!positions.has(position),'the route must not step back into a loop');positions.add(position);
  detoured||=gun.y!==3;
  for(const unit of battle.units){assert.equal(artilleryContact(battle,unit,gun),true);assert.equal(unit.hp,initial.units.find(u=>u.id===unit.id).hp);}
 }
 assert.ok(detoured);assert.equal(battle.artillery[0].x,13);assert.equal(battle.artillery[0].y,3);
 assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
 assert.deepEqual(battle.props,initial.props);assert.ok(battle.elapsedSeconds>initial.elapsedSeconds);
});

test('a flanking infantry screen scouts beside the cannon without blocking its crew',()=>{
 let battle=createBattle([{id:'11',x:9,y:10},{id:'0',x:10,y:9},{id:'125',x:10,y:11}],{
  width:20,height:20,tiles:Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),
  exploration:true,enemies:[],artillery:[{id:'gun',type:'bronze4',side:'player',x:10,y:10,loaded:true,ammo:6}],
 });
 const action=mountainBatteryOrder(battle,battle.units[2],{leaderId:'11',helperId:'0',artilleryId:'gun',screenDistance:4,clearCrewLane:true,flankScreen:true});
 assert.equal(action?.type,'move');battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 const scout=battle.units[2];assert.ok(scout.x>=10);assert.ok(Math.abs(scout.y-10)>=2.5);assert.ok(Math.hypot(scout.x-10,scout.y-10)<=4);
 battle=actBattle(battle,{type:'artilleryMove',unitId:'11',artilleryId:'gun',x:11,y:10});assert.equal(battle.lastError,null);
 assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
});

test('living replacements crew a coastal gun after casualties without changing the next replay',()=>{
 const units=[{id:'11',x:4,y:6},{id:'0',x:5,y:5},{id:'2',x:4,y:8},{id:'147',x:5,y:9},{id:'138',x:2,y:5},{id:'57',x:1,y:4}];
 const options={width:20,height:12,tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),exploration:true,enemies:[],artillery:[
  {id:'front',type:'bronze4',side:'player',x:5,y:6,loaded:true,ammo:6},
  {id:'rear',type:'bronze4',side:'player',x:5,y:8,loaded:true,ammo:6},
 ]};
 const initial=createBattle(units,options),controller=coastalBatteryController(initial);
 // A prepared casualty scene isolates replacement planning. Campaign-route
 // victories still obtain every casualty through actual enemy actions.
 let battle=createBattle(units.map(u=>['0','11'].includes(u.id)?{...u,hp:0}:u),options),advanced=false;
 for(let step=0;step<6&&!advanced;step++)for(const id of ['138','2']){
  const action=controller(battle,battle.units.find(u=>u.id===id));if(!action)continue;
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
  if(action.type==='artilleryMove'){advanced=true;break;}
 }
 assert.ok(advanced,'living replacements must be able to move the remaining loaded cannon');
 for(const id of ['0','11'])assert.equal(battle.units.find(u=>u.id===id).hp,0);
 assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
 const originalGunner=initial.units.find(u=>u.id==='0');
 assert.deepEqual(controller(initial,originalGunner),coastalBatteryController(initial)(initial,originalGunner),'a later casualty must not change the initial replay order');
});

test('two light guns use their actual one-person crews without reserving an extra helper',()=>{
 let battle=createBattle([{id:'11',x:4,y:3},{id:'5',x:4,y:11},{id:'57',x:1,y:6}],{
  width:24,height:16,tiles:Array.from({length:384},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),exploration:true,enemies:[],artillery:[
   {id:'front',type:'swivel',side:'player',x:5,y:3,loaded:true,ammo:6},
   {id:'rear',type:'swivel',side:'player',x:5,y:11,loaded:true,ammo:6},
  ],
 });
 const controller=coastalBatteryController(battle);
 for(const [id,artilleryId]of [['11','front'],['5','rear']]){
  const action=controller(battle,battle.units.find(u=>u.id===id));
  assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,artilleryId);
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
  const gun=battle.artillery.find(g=>g.id===artilleryId);
  assert.equal(artilleryContact(battle,battle.units.find(u=>u.id===id),gun),true);
  assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);
 }
});

test('a light gun ahead of a heavy gun clears the approach regardless of purchase order',()=>{
 const battle=createBattle([{id:'11',x:4,y:3},{id:'5',x:5,y:4},{id:'125',x:7,y:3},{id:'57',x:1,y:1}],{
  width:24,height:16,tiles:Array.from({length:384},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),exploration:true,enemies:[],artillery:[
   {id:'bought-first',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:6},
   {id:'physically-ahead',type:'swivel',side:'player',x:8,y:3,loaded:true,ammo:6},
  ],
 });
 const action=coastalBatteryController(battle)(battle,battle.units.find(u=>u.id==='125'));
 assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'physically-ahead');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.deepEqual(next.artillery[0],battle.artillery[0]);
 assert.equal(next.artillery[1].loaded,true);assert.equal(next.artillery[1].ammo,6);
});

test('the Mendoza screen clears the heavy gun crew and keeps a legal advance open',()=>{
 let battle=createBattle([{id:'101',x:10,y:3},{id:'102',x:11,y:3},{id:'125',x:10,y:4}],{
  width:20,height:20,tiles:Array.from({length:400},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),
  exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:10,y:4,loaded:true,ammo:6}],
 });
 const blocked=actBattle(battle,{type:'artilleryMove',unitId:'101',artilleryId:'heavy',x:10,y:5});
 assert.ok(blocked.lastError,'the infantryman must block the actual crew destination');
 const action=mendozaBatteryOrder(battle,battle.units.find(u=>u.id==='125'));
 assert.equal(action?.type,'move');
 battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 for(let step=0;step<3;step++){
  const action=mendozaBatteryOrder(battle,battle.units.find(u=>u.id==='101'));
  assert.equal(action?.type,'artilleryMove');
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 }
 assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,6);
 assert.ok(battle.units.every(u=>u.hp>0));
});

test('returning battery uses its living replacement and own cannon among persisted bodies and enemy guns',()=>{
 const battle=createBattle([{id:'1000',x:2,y:3},{id:'2',x:0,y:0,hp:0}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[
   {id:'captured',type:'swivel',side:'enemy',x:12,y:8,loaded:true,ammo:6},
   {id:'field-piece',type:'swivel',side:'player',x:3,y:3,loaded:true,ammo:6},
  ],
 });
 const officer=battle.units.find(u=>u.id==='1000');
 const action=santaFeBatteryOrder(battle,officer);
 assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'field-piece');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.notDeepEqual(next.artillery.find(g=>g.id==='field-piece'),battle.artillery.find(g=>g.id==='field-piece'));
 assert.deepEqual(next.artillery.find(g=>g.id==='captured'),battle.artillery.find(g=>g.id==='captured'));
 assert.equal(next.units.find(u=>u.id==='2').hp,0);
});

test('a surviving hired gunner replaces both fallen named officers without using the commander',()=>{
 const battle=createBattle([{id:'2',x:0,y:0,hp:0},{id:'1000',x:1,y:0,hp:0},{id:'125',x:2,y:3,marksmanship:68},{id:'57',x:1,y:3,marksmanship:92}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[{id:'field-piece',type:'swivel',side:'player',x:3,y:3,loaded:true,ammo:6}],
 });
 const before=structuredClone(battle),gunner=battle.units.find(u=>u.id==='125');
 const action=santaFeBatteryOrder(battle,gunner);
 assert.equal(action?.type,'artilleryMove');assert.equal(action.unitId,'125');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 for(const id of ['2','1000'])assert.equal(next.units.find(u=>u.id===id).hp,0);
 assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,6);
 assert.deepEqual(battle,before);
});

test('heavy battery assistant stays with the gun through consecutive exploration steps',()=>{
 let battle=createBattle([{id:'1000',x:2,y:3},{id:'139',x:3,y:4},{id:'144',x:1,y:3}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:6}],
 });
 for(let step=0;step<2;step++){
  assert.equal(humahuacaBatteryOrder(battle,battle.units.find(u=>u.id==='139')),null);
  const action=humahuacaBatteryOrder(battle,battle.units.find(u=>u.id==='1000'));
  assert.equal(action?.type,'artilleryMove');
  const next=actBattle(battle,action);assert.equal(next.lastError,null);battle=next;
  const gun=battle.artillery[0],helper=battle.units.find(u=>u.id==='139');
  assert.ok(Math.hypot(helper.x-gun.x,helper.y-gun.y)<=1.5);
 }
});

test('a knocked-down gunner stands before the battery can issue gun orders',()=>{
 const battle=createBattle([{id:'1000',x:2,y:3,stance:'prone',knockedDown:true},{id:'139',x:3,y:4}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:6}],
 });
 const action=humahuacaBatteryOrder(battle,battle.units[0]);
 assert.equal(action?.type,'stance');assert.equal(action.stance,'standing');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);assert.equal(Boolean(next.units[0].knockedDown),false);
});
