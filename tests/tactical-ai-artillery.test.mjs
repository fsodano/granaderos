import test from 'node:test';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,getReachable,canSee,artilleryShotTrace,artilleryCrewPlan,artilleryReloadPreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseArtilleryAction,holdsArtilleryPost} from '../game/tactical-ai-artillery.js';
import {automaticOrder} from '../game/autonomous-orders.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const tileMap=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
function field({type='swivel',side='enemy',loaded=true,ammo=0,positions=[[2,3],[2,2],[3,2]],target={}}={}){
 const crew=positions.slice(0,{swivel:1,bronze4:2,field8:3}[type]).map(([x,y],i)=>({id:`crew-${i}`,x,y,facing:2,weapon:1813,blade:1813,loaded:0,ammo:0,medical:0,medkits:0,marksmanship:1,explosives:50,patrol:false,overwatch:false,...(side==='player'?{militia:true}:{})}));
 const victim={id:'target',x:10,y:3,facing:6,weapon:1813,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false,...target};
 const s=createBattle(side==='enemy'?[victim]:crew,{width:24,height:10,tiles:tileMap(),seed:45,enemies:side==='enemy'?crew:[victim],artillery:[{id:'piece',type,side,x:3,y:3,facing:0,loaded,ammo}]});s.phase=side==='enemy'?'enemy':'player';return s;
}
const actor=s=>s.units.find(u=>u.id==='crew-0');
const plan=s=>chooseArtilleryAction(s,actor(s),s.units.filter(v=>v.side!==actor(s).side&&v.hp>0&&!v.unconscious&&!v.surrendered&&canSee(s,actor(s),v)),()=>getReachable({...s,units:s.units.filter(v=>v.side===actor(s).side||canSee(s,actor(s),v))},actor(s)));

test('enemy and militia choosers use every cannon with the actual crew and finite loaded shot',()=>{
 for(const type of ['swivel','bronze4','field8'])for(const side of ['enemy','player']){
  const s=field({type,side}),before=structuredClone(s),order=chooseEnemyAction(s,actor(s));assert.equal(order.type,'artillery',`${side} ${type}`);assert.equal(order.mode,'solid');assert.equal(order.artilleryId,'piece');assert.deepEqual(s,before);
  const trace=artilleryShotTrace(s,actor(s),s.artillery[0],s.units.find(u=>u.id==='target'));assert.ok(trace.events.some(e=>e.unitId==='target'));
 }
});

test('a real enemy phase fires the held cannon and saved continuation is deterministic',()=>{
 const s=field();s.phase='player';const before=structuredClone(s),next=endTurn(s);
 assert.equal(next.lastError,null);assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,0);assert.ok(next.units.find(u=>u.id==='target').hp<100);assert.ok(next.log.some(l=>l.includes('bala rasa')));
 assert.deepEqual(next,endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));assert.deepEqual(s,before);validateBattleSnapshot(next);
});

test('partial loading chooses real crew work, keeps its reserve, and does not turn an empty gun into a shot',()=>{
 const s=field({type:'bronze4',loaded:false,ammo:1});actor(s).ap=12;s.units.find(u=>u.id==='crew-1').ap=8;assert.equal(plan(s).type,'artilleryReload');const p=artilleryReloadPreview(s,actor(s),s.artillery[0]);assert.equal(p.pa,8);assert.equal(p.partial,true);
 s.artillery[0].ammo=0;assert.equal(plan(s),null);assert.equal(holdsArtilleryPost(s,actor(s)),false);
});

test('an out-of-arc target gets a paid pivot only when pivot plus fire fits every crew budget',()=>{
 const s=field({type:'bronze4'});s.artillery[0].facing=Math.PI;assert.equal(plan(s).type,'artilleryPivot');assert.equal(plan(s).x,10);s.units.find(u=>u.id==='crew-1').ap=39;assert.equal(plan(s),null);
});

test('canister is selected for a visible group and the full cone protects known bystanders',()=>{
 const s=field({target:{x:7}});s.units.push({...structuredClone(s.units[0]),id:'second',x:7,y:4});assert.equal(plan(s).mode,'canister');
 const ally={...structuredClone(actor(s)),id:'friend',x:6,y:2};s.units.push(ally);const order=plan(s);if(order)assert.ok(!artilleryShotTrace(s,actor(s),s.artillery[0],order,order.mode).events.some(e=>e.unitId==='friend'));
 s.npcs=[{id:'civilian',name:'Vecino',x:5,y:3}];assert.equal(canSee(s,actor(s),s.npcs[0]),true);assert.equal(plan(s),null);
});

test('penetration scoring protects allies and downed people along the complete solid line',()=>{
 const s=field();s.units.push({...structuredClone(actor(s)),id:'friend',x:7,y:3});assert.equal(plan(s),null);
 s.units.at(-1).side='player';s.units.at(-1).unconscious=true;assert.equal(plan(s),null);
});

test('blocked light-cannon shots, roof targets, unseen targets and private enemy state cannot generate an order',()=>{
 const s=field();Object.assign(s.tiles.find(t=>t.x===6&&t.y===3),{type:'wall',material:'stone',blocked:true,blocksSight:false});assert.equal(plan(s),null);
 const clean=field(),hidden=structuredClone(clean);hidden.units.push({...structuredClone(hidden.units[0]),id:'hidden',x:23,y:9});Object.assign(hidden.units[0],{energy:1,inventory:{secret:{count:1,weight:1}}});setTestAmmunition(hidden.units[0],999);assert.equal(canSee(hidden,actor(hidden),hidden.units.at(-1)),false);assert.deepEqual(plan(clean),plan(hidden));
 clean.units[0].tacticalLevel=1;assert.equal(plan(clean),null);const dark=field({target:{x:23,y:9}});assert.equal(plan(dark),null);
});

test('the local crew approaches using paid bounded movement and defenders keep a loaded emplacement without contact',()=>{
 const s=field({positions:[[6,3]]}),before=structuredClone(s);const order=plan(s);assert.equal(order.type,'move');const reach=getReachable(s,actor(s)).find(p=>p.x===order.x&&p.y===order.y);assert.ok(reach.cost>0&&reach.cost<=24&&reach.path.length<=3);assert.deepEqual(s,before);
 const quiet=field({target:{x:23,y:9}});assert.equal(holdsArtilleryPost(quiet,actor(quiet)),true);assert.equal(automaticOrder(quiet,actor(quiet)),null);
});

test('actual exploration updates keep enemy and militia crews at loaded guns but release depleted posts',()=>{
 for(const side of ['enemy','player'])for(const loaded of [true,false]){
  const crew={id:'crew-0',x:2,y:3,facing:2,medical:0,medkits:0,...(side==='player'?{militia:true}:{})};
  const observer={id:'observer',x:37,y:7,facing:6,patrol:false};
  const before=createBattle(side==='enemy'?[observer]:[crew],{width:40,height:10,exploration:true,seed:45,
   tiles:Array.from({length:400},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),
   enemies:side==='enemy'?[crew]:[observer],artillery:[{id:'piece',type:'swivel',side,x:3,y:3,loaded,ammo:0}]});
  const original=structuredClone(before),operator=actor(before);
  assert.equal(before.mode,'exploration');assert.equal(holdsArtilleryPost(before,operator),loaded);
  assert.equal(canSee(before,operator,before.units.find(u=>u.id==='observer')),false);
  let next=before,moved=false;
  for(let tick=0;tick<4;tick++){
   next=actBattle(next,{type:'ambient'});const current=actor(next);
   assert.equal(next.lastError,null);assert.equal(next.mode,'exploration');assert.equal(next.status,'active');
   moved||=current.x!==operator.x||current.y!==operator.y;
   if(loaded)assert.deepEqual([current.x,current.y],[operator.x,operator.y],`${side} must guard its loaded piece`);
   assert.equal(current.ap,operator.ap,'exploration updates must not spend AP');
   assert.deepEqual(next.artillery,before.artillery,'patrolling cannot create ammunition or fire without contact');
  }
  assert.equal(moved,!loaded,`${side} releases an exhausted emplacement`);
  if(loaded)assert.equal(actor(next).energy,operator.energy);else assert.ok(actor(next).energy<operator.energy);
  assert.equal(next.elapsedSeconds,24);assert.deepEqual(before,original);validateBattleSnapshot(next);
 }
});

test('incapable crews and mixed control groups cannot operate or reserve a piece',()=>{
 for(const change of [s=>actor(s).mounted=true,s=>actor(s).knockedDown=true,s=>actor(s).entangled=true,s=>actor(s).unconscious=true,s=>actor(s).tacticalLevel=1,s=>s.units.find(u=>u.id==='crew-1').militia=true]){
  const s=field({type:'bronze4'});change(s);assert.equal(plan(s),null);assert.equal(holdsArtilleryPost(s,actor(s)),false);
 }
});

test('enemy reaction crews cannot borrow an unqualified bystander and never approach during the window',()=>{
 const s=field({type:'bronze4'});s.reactionStack=[{unitIds:['crew-0'],unitIndex:0,actionsTaken:0,resumePhase:'player'}];assert.ok(artilleryCrewPlan(s,actor(s),s.artillery[0],30).reason);assert.equal(plan(s),null);
 s.reactionStack[0].unitIds.push('crew-1');assert.equal(plan(s).type,'artillery');actor(s).x=6;assert.equal(plan(s),null);
});

test('the actual allied phase uses a militia cannon without granting direct hired control',()=>{
 const s=field({type:'bronze4',side:'player'});const target=s.units.find(u=>u.id==='target');target.ap=0;
 const illegal=actBattle(s,{type:'artillery',unitId:'crew-0',artilleryId:'piece',x:target.x,y:target.y});assert.ok(illegal.lastError);assert.equal(illegal.artillery[0].loaded,true);
 const next=endTurn(s);assert.equal(next.lastError,null);assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,0);assert.ok(next.units.find(u=>u.id==='target').hp<target.hp);validateBattleSnapshot(next);
});


test('a hired auto-resolve scout does not oscillate back to a loaded gun while searching for contact',()=>{
 const s=field({side:'player',positions:[[6,3]],target:{x:23,y:9}});actor(s).militia=false;
 assert.equal(plan(s),null);assert.equal(holdsArtilleryPost(s,actor(s)),false);
 const order=automaticOrder(s,actor(s));assert.ok(order);assert.notEqual(order.artilleryId,'piece');
 s.artillery[0].loaded=false;s.artillery[0].ammo=1;actor(s).x=2;assert.equal(plan(s).type,'artilleryReload');
});


test('a prone autonomous gunner pays to crouch before operating the gun',()=>{
 const s=field({type:'swivel',side:'player'});actor(s).militia=false;actor(s).stance='prone';
 const action=plan(s);assert.deepEqual(action,{type:'stance',unitId:actor(s).id,stance:'crouched'});
 const next=actBattle(s,action);assert.equal(next.lastError,null);
 assert.equal(actor(next).stance,'crouched');assert.ok(actor(next).ap<actor(s).ap);
 assert.equal(next.artillery[0].loaded,true);assert.equal(plan(next).type,'artillery');
 actor(s).ap=0;assert.equal(plan(s),null);
});
