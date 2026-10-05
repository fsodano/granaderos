import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,firearmMaintenancePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {fieldPractice} from '../game/skill-training.js';

const kit=(points,id)=>({kind:'repair-kit',name:'Juego de herramientas',count:1,weight:2,repairPoints:points,instanceId:id});
// These subsystem arenas declare their finite owned supplies before admission.
const field=(unit={},exploration=false)=>validateBattleSnapshot(createBattle([
 {id:'p',name:'Mecánico',x:1,y:1,weapon:1805,loaded:1,ammo:3,condition:40,mechanical:60,...unit},
],{width:24,height:8,seed:45,exploration,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false})),enemies:exploration?[]:[{id:'e',x:22,y:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}]}));
const actor=b=>b.units.find(u=>u.id==='p');
const repair=b=>actBattle(b,{type:'repair',unitId:'p'});
const physical=b=>({...b,lastError:null,log:[]});
const unchangedGear=(before,after)=>{
 for(const key of ['loaded','ammo','reloadProgress','jammed','weapon','weaponInstanceId','weaponMetadata','contentWeapon','ammunitionChoice','weaponFittings','weaponFittingPattern','bladeFittingPattern','offHand','hp','energy','morale'])assert.deepEqual(after[key],before[key],key);
};

test('maintenance retains the ordinary trait gain, AP cost and three practice attempts while spending finite points',()=>{
 for(const [traits,gain,pa] of [[[],30,25],[['workshop_training'],40,25],[['gunsmith_artillerist','workshop_training'],45,18]]){
  const b=field({traits,condition:10,toolkitPoints:50}),before=structuredClone(b),u=actor(b),expected=structuredClone(u);
  fieldPractice(expected,'mechanical',3);
  const preview=firearmMaintenancePreview(b,u);
  assert.deepEqual(b,before);assert.equal(preview.valid,true);assert.equal(preview.gain,gain);assert.equal(preview.materialCost,gain);assert.equal(preview.pa,pa);assert.equal(preview.materialsAvailable,50);
  const next=actBattle(b,preview.action),n=actor(next);
  assert.equal(next.lastError,null);assert.equal(n.condition,10+gain);assert.equal(n.toolkitPoints,50-gain);assert.equal(n.ap,u.ap-pa);assert.equal(next.elapsedSeconds-b.elapsedSeconds,6);
  for(const key of ['practiceSeed','skillPractice','trainedStats','mechanical'])assert.deepEqual(n[key],expected[key],key);
  unchangedGear(u,n);assert.deepEqual(n.inventory,u.inventory);assert.equal(next.seed,b.seed);assert.deepEqual(b,before);
 }
});

test('a fractional final repair consumes one whole material point and preserves the identified partial kit',()=>{
 const b=field({condition:99.75,inventory:{tools:kit(3,'partial-kit')},leftHandItem:'inventory:tools'},true),u=actor(b),preview=firearmMaintenancePreview(b,u);
 assert.equal(preview.gain,.25);assert.equal(preview.materialCost,1);
 const next=repair(b),n=actor(next);
 assert.equal(next.lastError,null);assert.equal(n.condition,100);assert.equal(n.inventory.tools.repairPoints,2);assert.equal(n.inventory.tools.instanceId,'partial-kit');assert.equal(n.inventory.tools.count,1);assert.equal(n.leftHandItem,'inventory:tools');
 assert.equal(n.ap,u.ap);assert.equal(next.elapsedSeconds-b.elapsedSeconds,2);assert.equal(next.seed,b.seed);unchangedGear(u,n);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
});

test('numeric reserve is spent first and actual kit depletion clears its held reference without consuming another identity',()=>{
 const b=field({condition:40,toolkitPoints:5,inventory:{a:kit(13,'first-kit'),b:kit(20,'second-kit')},leftHandItem:'inventory:a'}),u=actor(b),preview=firearmMaintenancePreview(b,u);
 assert.equal(preview.materialsAvailable,38);assert.equal(preview.materialCost,30);
 const next=repair(b),n=actor(next);
 assert.equal(next.lastError,null);assert.equal(n.condition,70);assert.equal(n.toolkitPoints,0);assert.equal(n.inventory.a,undefined);assert.equal(n.leftHandItem,null);
 assert.deepEqual(n.inventory.b,{...u.inventory.b,repairPoints:8});assert.equal(repairMaterialPoints(n),8);unchangedGear(u,n);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);
});

test('partial supplies limit the actual gain and an exhausted repeat cannot farm work or practice',()=>{
 const b=field({inventory:{tools:kit(7,'last-kit')},leftHandItem:'inventory:tools'}),next=repair(b);
 assert.equal(next.lastError,null);assert.equal(actor(next).condition,47);assert.equal(repairMaterialPoints(actor(next)),0);assert.equal(actor(next).inventory.tools,undefined);assert.equal(actor(next).leftHandItem,null);
 const preview=firearmMaintenancePreview(next,actor(next));assert.equal(preview.valid,false);assert.equal(preview.gain,0);assert.equal(preview.materialCost,0);
 const rejected=repair(next);assert.match(rejected.lastError,/materiales/);assert.deepEqual(physical(rejected),physical(next));
});

test('missing materials, a full or unavailable firearm, incapacity and insufficient AP reject before any paid change',()=>{
 const missing=firearmMaintenancePreview(field(),null);assert.equal(missing.valid,false);assert.equal(missing.action,null);
 for(const [unit,prepare] of [
  [{},()=>{}],[{condition:100,toolkitPoints:10},()=>{}],[{weapon:1813,loaded:0,toolkitPoints:10},()=>{}],
  [{activeSlot:'blade',blade:1813,toolkitPoints:10},()=>{}],[{toolkitPoints:10},b=>actor(b).ap=24],
  [{toolkitPoints:10,energy:0},()=>{}],[{toolkitPoints:10,knockedDown:true},()=>{}],
 ]){
  const b=field(unit);prepare(b);const before=structuredClone(b),preview=firearmMaintenancePreview(b,actor(b));
  assert.equal(preview.valid,false);assert.equal(preview.gain,0);assert.equal(preview.materialCost,0);assert.deepEqual(b,before);
  const rejected=repair(b);assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(b));assert.deepEqual(b,before);
 }
});

test('two finite maintenance strokes replay exactly across presented execution and validated JSON checkpoints',()=>{
 let b=field({toolkitPoints:5,inventory:{tools:kit(30,'replay-kit')},condition:40}),replayed=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
 for(const expected of [[70,5],[75,0]]){
  const before=structuredClone(b),action=firearmMaintenancePreview(b,actor(b)).action,ordinary=actBattle(b,action),presented=presentedActBattle(b,action);
  assert.equal(ordinary.lastError,null);assert.deepEqual(presented.state,ordinary);assert.deepEqual(b,before);
  replayed=actBattle(replayed,action);assert.deepEqual(replayed,ordinary);
  b=validateBattleSnapshot(JSON.parse(JSON.stringify(ordinary)));assert.deepEqual(b,ordinary);assert.equal(actor(b).condition,expected[0]);assert.equal(repairMaterialPoints(actor(b)),expected[1]);
  replayed=validateBattleSnapshot(JSON.parse(JSON.stringify(replayed)));
 }
 assert.equal(actor(b).inventory.tools,undefined);assert.equal(actor(b).loaded,1);assert.equal(actor(b).ammo,3);assert.equal(b.elapsedSeconds,6);assert.equal(b.seed,45);
});
