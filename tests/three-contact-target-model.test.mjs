import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {Group} from '../web/node_modules/three/build/three.module.js';
const {resolveContactTargetModel}=await import('../web/lib/three/contact-target-model.ts');

function fixture(){
 const visual={key:'unit:target',appearance:'woman-scout',position:[3,0,2],yaw:1,posture:'crouched',mounted:false,action:'idle',bodyHeights:{torso:.7}};
 const target={...visual},entry={visual,runtime:{model:new Group(),root:new Group(),asset:{appearance:{id:'woman-scout'}}}};
 return {visual,target,entry};
}

test('paired contact resolves the current admitted and loaded body without mutating it',()=>{
 const {visual,target,entry}=fixture(),before=structuredClone(target),model=resolveContactTargetModel(target,[visual],entry);
 assert.equal(model.model,entry.runtime.model);assert.equal(model.root,entry.runtime.root);assert.deepEqual(target,before);
});

test('hidden, replaced, pending, failed, stale and ambiguous target models cannot supply contact geometry',()=>{
 const {visual,target,entry}=fixture();
 assert.equal(resolveContactTargetModel(target,[],entry),undefined);
 assert.equal(resolveContactTargetModel(target,[visual,visual],entry),undefined);
 for(const current of [undefined,{}, {visual}, {...entry,error:true},{...entry,visual:{...visual}}, {...entry,runtime:{...entry.runtime,asset:{appearance:{id:'granadero'}}}}])assert.equal(resolveContactTargetModel(target,[visual],current),undefined);
 entry.runtime.root.visible=false;assert.equal(resolveContactTargetModel(target,[visual],entry),undefined);entry.runtime.root.visible=true;
 for(const changes of [{key:'npc:target'},{appearance:'granadero'},{position:[3.1,0,2]},{position:[3,1,2]},{yaw:2},{posture:'standing'},{mounted:true},{action:'hit'}])assert.equal(resolveContactTargetModel({...target,...changes},[visual],entry),undefined);
});
