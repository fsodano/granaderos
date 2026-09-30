import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canSee,grenadeThrowPreview,planReadyMainHand} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseGrenadeThrow} from '../game/tactical-ai-grenades.js';
import {GRENADE_THROW,heldGrenade,grenadeThrowCosts} from '../game/grenade-throw.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {grenadeFlight,grenadeBlastExposure} from '../game/grenade-flight.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field({side='enemy',patch={},targets=[{id:'target',x:7,y:4}]}={}){
 const thrower={id:'thrower',name:'Lanzador',x:1,y:4,facing:2,weapon:1800,loaded:0,ammo:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,blade:0,
  marksmanship:100,dexterity:100,strength:100,medical:0,morale:100,patrol:false,overwatch:false,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)},...(side==='player'?{militia:true}:{}),...patch};
 const opponents=targets.map(target=>({facing:6,weapon:1813,blade:0,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false,...target}));
 const s=createBattle(side==='enemy'?opponents:[thrower],{width:24,height:12,seed:45,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:side==='enemy'?[thrower]:opponents});
 for(const u of s.units)u.ap=u.id==='thrower'?100:0;
 return s;
}
const actor=s=>s.units.find(u=>u.id==='thrower');
const opponents=s=>s.units.filter(u=>u.side!==actor(s).side);
const grenadeChoice=s=>chooseGrenadeThrow(s,actor(s),opponents(s));
const planning=s=>({...s,phase:actor(s).side==='enemy'?'enemy':'player'});
const count=u=>Object.values(u.inventory??{}).filter(record=>record.kind==='grenade').reduce((sum,record)=>sum+record.count,0);
const addPerson=(s,patch)=>{const u={...structuredClone(opponents(s)[0]),id:'other',...patch};s.units.push(u);return u;};

test('enemy and militia ordinary turns consume one owned grenade and the exact available throw budget',()=>{
 for(const side of ['enemy','player']){
  const s=field({side,patch:{inventory:{grenade:makeGrenadeStack('arsenal',2)}}}),u=actor(s),target=opponents(s)[0];u.ap=grenadeThrowCosts(u,target).total;
  const before=structuredClone(s),order=chooseEnemyAction(s,u);assert.equal(order.type,'throwGrenade');assert.equal(order.aim,undefined);
  const n=endTurn(s),next=actor(n);assert.equal(n.lastError,null);assert.equal(count(next),1);assert.ok(n.units.find(v=>v.id===target.id).hp<target.hp);
  if(side==='enemy')assert.equal(next.ap,0);else{assert.equal(next.carriedAP,0);assert.equal(next.ap,next.maxAP);}
  assert.equal(next.loaded,u.loaded);assert.equal(next.ammo,u.ammo);assert.equal(next.priming,u.priming);assert.equal(n.log.filter(line=>line.includes('explosión de granada')).length,1);
  assert.deepEqual(n,endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));assert.deepEqual(s,before);validateBattleSnapshot(n);
 }
});

test('a pocket grenade costs a real hand change before standing and throwing, while the stored loaded gun is retained',()=>{
 for(const side of ['enemy','player']){
  const s=field({side,patch:{activeSlot:'primary',activeItem:undefined,loaded:1,weaponInstanceId:'owned-musket',condition:67,stance:'crouched',movementMode:'crouch'},targets:[{id:'target',x:7,y:4},{id:'second',x:7,y:5}]}),u=actor(s);
  const ready=planReadyMainHand(u,'inventory:grenade'),costs=grenadeThrowCosts(ready,opponents(s)[0]);u.ap=4+costs.total;
  assert.deepEqual(grenadeChoice(s),{type:'weapon',unitId:u.id,slot:'item',item:'inventory:grenade'});
  const n=endTurn(s),next=actor(n);assert.equal(n.lastError,null);assert.equal(count(next),0);assert.equal(next.stance,'standing');assert.equal(next.activeSlot,'unarmed');
  assert.equal(next.weaponInstanceId,'owned-musket');assert.equal(next.loaded,1);assert.equal(next.condition,67);assert.equal(next.ammo,u.ammo);assert.equal(next.priming,u.priming);
  if(side==='enemy')assert.equal(next.ap,0);else assert.equal(next.carriedAP,0);
  assert.equal(n.log.filter(line=>line.includes('prepara Granada de arsenal')).length,1);assert.equal(n.log.filter(line=>line.includes('explosión de granada')).length,1);validateBattleSnapshot(n);
 }
});

test('a held crouched grenade uses a separate standing order and never adds aim or a free item switch',()=>{
 const s=field({patch:{stance:'crouched',movementMode:'crouch'}}),u=actor(s),before=structuredClone(s);
 assert.deepEqual(chooseEnemyAction(s,u),{type:'stance',unitId:u.id,stance:'standing'});assert.deepEqual(s,before);
 const upright=structuredClone(s);actor(upright).stance='standing';actor(upright).movementMode='walk';actor(upright).ap-=grenadeThrowCosts(u,opponents(s)[0]).stance;
 assert.equal(chooseEnemyAction(upright,actor(upright)).type,'throwGrenade');
});

test('grenades are never fabricated from an empty pack, another soldier, a corpse or ground loot',()=>{
 const s=field({patch:{inventory:{},activeSlot:'primary',activeItem:undefined}});
 addPerson(s,{id:'donor',side:actor(s).side,x:1,y:8,inventory:{grenade:makeGrenadeStack('arsenal',8)}});
 addPerson(s,{id:'body',hp:0,x:2,y:4,inventory:{grenade:makeGrenadeStack('arsenal',8)}});
 s.groundItems=[{id:'ground-grenade',type:'item',item:'inventory:grenade',x:1,y:4,...makeGrenadeStack('arsenal',8)}];
 const before=structuredClone(s);assert.equal(grenadeChoice(s),null);assert.notEqual(chooseEnemyAction(s,actor(s))?.type,'throwGrenade');assert.equal(count(actor(s)),0);assert.deepEqual(s,before);
});

test('unseen hostile people and NPCs do not change a legal grenade choice or its public preview',()=>{
 const s=field(),baseline=grenadeChoice(s),preview=grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]);assert.ok(baseline);
 const hidden=addPerson(s,{id:'hidden',x:22,y:11,hp:21,inventory:{grenade:makeGrenadeStack('arsenal',40)}});s.npcs=[{id:'hidden-npc',name:'Vecino',x:22,y:10}];
 assert.equal(canSee(s,actor(s),hidden),false);assert.equal(canSee(s,actor(s),s.npcs[0]),false);
 assert.deepEqual(grenadeChoice(s),baseline);assert.deepEqual(grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]),preview);
 Object.assign(hidden,{x:21,y:10,hp:100,inventory:{}});Object.assign(s.npcs[0],{x:23,y:11,hp:1});assert.deepEqual(grenadeChoice(s),baseline);
 const unseen=field({targets:[{id:'target',x:22,y:11}]});assert.equal(grenadeChoice(unseen),null);
});

test('known allies, civilians and downed opponents prevent a dangerous throw at the intended landing',()=>{
 for(const kind of ['ally','civilian','unconscious','surrendered']){
  const s=field();if(kind==='civilian')s.npcs=[{id:'civil',name:'Vecino',x:7,y:5}];
  else addPerson(s,{id:'protected',x:7,y:5,...(kind==='ally'?{side:actor(s).side}:kind==='unconscious'?{hp:10,unconscious:true}:{surrendered:true})});
  assert.equal(grenadeChoice(s),null,kind);
 }
 const close=field({targets:[{id:'target',x:3,y:4}]});assert.equal(grenadeChoice(close),null,'the thrower protects itself');
});

test('the safety check includes allies outside the intended blast but inside a possible scatter blast',()=>{
 const s=field();const ally=addPerson(s,{id:'ally',side:actor(s).side,x:10,y:4});ally.x=11;
 const intended=grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]);assert.equal(intended.friendlyRisk,false);
 assert.ok(grenadeBlastExposure(s,{x:8,y:4},ally,GRENADE_THROW.radius).multiplier>0);assert.equal(grenadeChoice(s),null);
});

test('early wall impacts during scatter protect the distant thrower and allies at the actual fallback landing',()=>{
 for(const protect of ['self','ally']){
  const s=field({targets:[{id:'target',x:9,y:4}]});Object.assign(s.tiles[3*s.width+2],{type:'wall',blocked:true,obstacleHeight:8});
  const protectedUnit=protect==='self'?actor(s):addPerson(s,{id:'ally',side:actor(s).side,x:1,y:5});
  const intended=grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]);assert.equal(intended.valid,true);assert.equal(intended.friendlyRisk,false);assert.equal(intended.flight.blocked,false);
  const scattered=grenadeFlight(s,actor(s),{x:7,y:2});assert.deepEqual(scattered.landing,{x:2,y:4,tacticalLevel:0});assert.ok(grenadeBlastExposure(s,scattered.landing,protectedUnit,GRENADE_THROW.radius).multiplier>0);
  assert.equal(grenadeChoice(s),null,protect);
 }
});

test('equip and throw must both fit the budget and a full pack cannot discard a held gun',()=>{
 const s=field({patch:{activeSlot:'primary',activeItem:undefined}}),u=actor(s),ready=planReadyMainHand(u,'inventory:grenade'),cost=4+grenadeThrowCosts(ready,opponents(s)[0]).total;
 u.ap=cost-1;assert.equal(grenadeChoice(s),null);u.ap=cost;assert.equal(grenadeChoice(s).slot,'item');
 const held=field();actor(held).ap=grenadeThrowCosts(actor(held),opponents(held)[0]).total-1;assert.equal(grenadeChoice(held),null);
 const full=field({patch:{activeSlot:'primary',activeItem:undefined,inventory:{grenade:makeGrenadeStack('arsenal',2),...Object.fromEntries(Array.from({length:11},(_,i)=>[`filler-${i}`,{count:1,weight:.1}]))}}});
 assert.equal(inventoryUsage(actor(full)).used,12);assert.equal(inventoryUsage(actor(full)).overloaded,false);assert.throws(()=>planReadyMainHand(actor(full),'inventory:grenade'));const before=structuredClone(full);assert.equal(grenadeChoice(full),null);assert.deepEqual(full,before);
});

test('depleted, unusable, mounted and knocked-down grenade states cannot produce a throw',()=>{
 for(const patch of [{inventory:{grenade:makeGrenadeStack('arsenal',0)},activeSlot:'primary',activeItem:undefined},{inventory:{grenade:makeGrenadeStack('arsenal',1,{condition:0})}},{inventory:{grenade:makeGrenadeStack('arsenal',1,{condition:49})}},{mounted:true},{knockedDown:true}]){
  const s=field({patch});assert.equal(grenadeChoice(s),null);
 }
});

test('grenade decisions are deterministic after JSON restore, pack reordering and changes to the RNG seed',()=>{
 const s=field({patch:{activeSlot:'primary',activeItem:undefined,inventory:{z:makeGrenadeStack('arsenal',1,{instanceId:'z'}),a:makeGrenadeStack('arsenal',1,{instanceId:'a'})}}}),before=structuredClone(s),order=grenadeChoice(s);
 assert.equal(order.item,'inventory:a');assert.deepEqual(chooseEnemyAction(s,actor(s)),order);assert.deepEqual(s,before);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(grenadeChoice(restored),order);actor(restored).inventory={a:actor(restored).inventory.a,z:actor(restored).inventory.z};restored.seed=1234;assert.deepEqual(grenadeChoice(restored),order);
});

test('enemy and militia grenade ownership does not grant direct player command',()=>{
 for(const side of ['enemy','player']){
  const s=field({side}),order=grenadeChoice(s),rejected=actBattle(s,order);assert.ok(rejected.lastError);assert.deepEqual(rejected.units,s.units);assert.equal(rejected.seed,s.seed);assert.equal(rejected.elapsedSeconds,s.elapsedSeconds);
 }
});

test('a hidden person inside the blast area cannot alter targeting or reveal itself through the risk warning',()=>{
 const s=field();Object.assign(s.tiles[5*s.width+6],{type:'wall',blocked:true,obstacleHeight:5});
 const baseline=grenadeChoice(s),preview=grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]);assert.ok(baseline);
 const hidden=addPerson(s,{id:'concealed',x:8,y:5});s.npcs=[{id:'concealed-npc',name:'Vecino',x:7,y:5}];
 assert.equal(canSee(s,actor(s),hidden),false);assert.equal(canSee(s,actor(s),s.npcs[0]),false);
 assert.ok(grenadeBlastExposure(s,{x:7,y:4},hidden,GRENADE_THROW.radius).multiplier>0);assert.ok(grenadeBlastExposure(s,{x:7,y:4},s.npcs[0],GRENADE_THROW.radius).multiplier>0);
 assert.deepEqual(grenadeChoice(s),baseline);assert.deepEqual(grenadeThrowPreview(planning(s),actor(s),opponents(s)[0]),preview);
});
