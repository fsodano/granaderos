import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,visibleRooms} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const {Scene,Matrix4}=await import('../web/node_modules/three/build/three.module.js');
const {createDeathBlood,DEATH_BLOOD_SECONDS}=await import('../web/lib/three/death-blood.ts');
const {admittedActors,presentActors,observedActorTransitions}=await import('../web/lib/three/presentation.ts');
const actor=(key='unit:one',patch={})=>({key,position:[2,0,3],action:'idle',...patch});
const death=(key='unit:one',patch={})=>actor(key,{action:'die',cue:{id:'death:'+key,action:'die',startedAt:1000,fromPosture:'standing'},...patch});
function setup(){const scene=new Scene(),blood=createDeathBlood(scene);return {scene,blood,root:scene.getObjectByName('death-blood')};}
const matrices=(root,name)=>{const mesh=root.getObjectByName('death-blood:'+name);return mesh?Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)):[];};
const frozen=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}return value;};
function field(){return createBattle([{id:'p',x:2,y:2,facing:2,weapon:1800,loaded:1,ammo:5,marksmanship:100,dexterity:100}],{
 width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),
 enemies:[{id:'e',x:3,y:2,hp:1,weapon:1809,patrol:false,overwatch:false},{id:'reserve',x:14,y:8,patrol:false,overwatch:false}],
});}
function shown(state,cues={}){const players=state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(state)),entries=admittedActors(state,players,revealed);return {entries,actors:presentActors(state,entries,{},revealed,{cues})};}

test('an actual fatal shot produces one brief death effect and a stain reconstructed from the saved corpse',()=>{
 const before=field(),copy=structuredClone(before),initial=shown(before),{blood,root}=setup();blood.update({actors:initial.actors,timeSeconds:.8});
 const after=actBattle(before,{type:'fire',unitId:'p',targetId:'e'});assert.equal(after.lastError,null);assert.equal(after.units.find(unit=>unit.id==='e').hp,0);
 const changes=observedActorTransitions(initial.entries,shown(after).entries),change=changes.find(change=>change.key==='unit:e');assert.equal(change.action,'die');
 const cues={'unit:e':{...change.extra,id:'actual-shot-death',action:change.action,startedAt:1000}},view=shown(after,cues),unchanged=JSON.stringify(after);
 blood.update({actors:frozen(view.actors),timeSeconds:1});assert.equal(blood.inspect().corpses,1);assert.equal(blood.inspect().bursts,1);assert.equal(blood.inspect().dropletInstances,7);
 const stain=matrices(root,'stains'),start=matrices(root,'droplets');blood.tick(1.25);assert.notDeepEqual(matrices(root,'droplets'),start);assert.deepEqual(matrices(root,'stains'),stain);
 blood.tick(1+DEATH_BLOOD_SECONDS+.01);assert.equal(blood.inspect().bursts,0);assert.equal(blood.inspect().dropletInstances,0);assert.deepEqual(matrices(root,'stains'),stain);
 blood.update({actors:view.actors,timeSeconds:2});assert.equal(blood.inspect().emitted,1);assert.equal(blood.inspect().bursts,0);
 const restored=validateBattleSnapshot(JSON.parse(unchanged)),loaded=setup();loaded.blood.update({actors:shown(restored).actors,timeSeconds:2});
 assert.deepEqual(matrices(loaded.root,'stains'),stain);assert.equal(loaded.blood.inspect().emitted,0);assert.equal(loaded.blood.inspect().dropletInstances,0);
 assert.equal(JSON.stringify(after),unchanged);assert.deepEqual(before,copy);blood.dispose();loaded.blood.dispose();
});

test('unit and civilian corpses retain distinct stains on their own floor; unconscious people do not bleed',()=>{
 const {blood,root}=setup(),input=frozen([actor('unit:same',{action:'dead'}),actor('npc:same',{action:'dead',position:[2,3,3]}),actor('unit:unconscious',{action:'unconscious'})]);
 blood.update({actors:input,timeSeconds:20});assert.equal(blood.inspect().corpses,2);assert.equal(blood.inspect().emitted,0);assert.equal(blood.inspect().stainInstances,8);
 const mesh=root.getObjectByName('death-blood:stains'),matrix=new Matrix4();mesh.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[13]-.012)<1e-6);mesh.getMatrixAt(4,matrix);assert.ok(Math.abs(matrix.elements[13]-3.012)<1e-6);
 assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.polygonOffset,true);assert.equal(mesh.raycast({},[]),undefined);
 const original=matrices(root,'stains');blood.update({actors:structuredClone(input),timeSeconds:500});assert.deepEqual(matrices(root,'stains'),original);blood.dispose();
});

test('first admission, concealment, stale cues and renderer reconstruction never replay a death',()=>{
 const {blood}=setup();blood.update({actors:[death()],timeSeconds:1});assert.equal(blood.inspect().corpses,1);assert.equal(blood.inspect().emitted,0);
 blood.update({actors:[actor()],timeSeconds:2});blood.update({actors:[],timeSeconds:2.1});blood.update({actors:[death()],timeSeconds:2.2});assert.equal(blood.inspect().emitted,0,'a newly visible corpse is not an observed kill');
 blood.update({actors:[actor()],timeSeconds:3});blood.update({actors:[death()],timeSeconds:3.1});assert.equal(blood.inspect().bursts,0,'old cue timing cannot start a new effect');
 blood.update({actors:[],timeSeconds:4});assert.equal(blood.inspect().stainInstances,0);assert.equal(blood.inspect().dropletInstances,0);
 const state=field();state.units.find(unit=>unit.id==='reserve').hp=0;for(const tile of state.tiles.filter(tile=>tile.x===10))Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});const publicView=shown(state);assert.ok(!publicView.actors.some(actor=>actor.key==='unit:reserve'));
 blood.update({actors:publicView.actors,timeSeconds:4});assert.equal(blood.inspect().corpses,0,'hidden corpses never cross the presentation boundary');
 assert.throws(()=>blood.update({state}),/admitted actor visuals/);blood.dispose();
});

test('reduced motion keeps the permanent stain and cannot replay suppressed droplets later',()=>{
 const {blood,root}=setup();blood.update({actors:[actor()],timeSeconds:.5,reducedMotion:true});blood.update({actors:[death()],timeSeconds:1,reducedMotion:true});
 assert.equal(blood.inspect().corpses,1);assert.equal(blood.inspect().dropletInstances,0);const stain=matrices(root,'stains');
 blood.update({actors:[death()],timeSeconds:1.1,reducedMotion:false});assert.equal(blood.inspect().dropletInstances,0);assert.deepEqual(matrices(root,'stains'),stain);
 blood.update({actors:[actor()],timeSeconds:2});blood.update({actors:[death('unit:one',{cue:{id:'next-death',action:'die',startedAt:2100}})],timeSeconds:2.1});assert.equal(blood.inspect().bursts,1);
 blood.update({actors:[death()],timeSeconds:2.2,reducedMotion:true});assert.equal(blood.inspect().bursts,0);blood.dispose();
});

test('many finite corpses share one draw call, and all renderer-owned resources are released once',()=>{
 const {scene,blood,root}=setup(),bodies=Array.from({length:100},(_,n)=>actor(`unit:${n}`,{position:[n%10,0,Math.floor(n/10)],action:'dead'}));
 blood.update({actors:bodies,timeSeconds:1});assert.equal(blood.inspect().corpses,100);assert.equal(blood.inspect().drawCalls,1);assert.equal(root.children.length,1);
 const mesh=root.children[0];let instances=0,geometry=0,material=0;mesh.addEventListener('dispose',()=>instances++);mesh.geometry.addEventListener('dispose',()=>geometry++);mesh.material.addEventListener('dispose',()=>material++);
 blood.update({actors:[actor()],timeSeconds:2});blood.update({actors:[death('unit:one',{cue:{id:'burst',action:'die',startedAt:2000}})],timeSeconds:2});assert.equal(blood.inspect().drawCalls,2);
 blood.dispose();blood.dispose();assert.equal(instances,1);assert.equal(geometry,1);assert.equal(material,1);assert.equal(scene.getObjectByName('death-blood'),undefined);assert.equal(blood.inspect().disposed,true);assert.throws(()=>blood.update(),/disposed/);
});
