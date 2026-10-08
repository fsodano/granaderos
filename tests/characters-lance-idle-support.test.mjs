import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,LoopOnce} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
async function fixture(appearance,equipment){
 const asset=await publishedActor(appearance,0);
 const actor=new ActorRuntime(asset,{key:'unit:sideways',id:'sideways',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'blade',items:[{id:'1812',reference:'primary',socket:'handRight'}],garments:{},selected:false,bodyHeights:{}});
 const mesh=actor.model.getObjectByName('Human_footwear_LOD0'),position=mesh.geometry.attributes.position,boots={l:[],r:[]},native=[];
 for(let index=0;index<position.count;index++)boots[position.getX(index)>0?'l':'r'].push(index);
 for(const side of ['l','r'])assert.ok(boots[side].length>200,'The complete sole, toe, heel and fitted boot are checked');
 actor.model.traverse(node=>{if(node.isBone&&node.name!=='Root')native.push({node,position:node.position.clone(),scale:node.scale.clone()});});
 let action,clip;
 function select(name){actor.mixer.stopAllAction();clip=asset.animation.animations.find(c=>c.name===name);assert.ok(clip,name);action=actor.mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;return{clip,spec:asset.clips.find(c=>c.name===name)};}
 function pose(time){action.paused=false;action.enabled=true;actor.mixer.setTime(time);actor.root.updateMatrixWorld(true);mesh.skeleton.update();for(const shape of native){assert.ok(shape.node.position.distanceTo(shape.position)<.000001,shape.node.name+' keeps its native joint offset');assert.ok(shape.node.scale.distanceTo(shape.scale)<.000001,shape.node.name+' keeps its native scale');}}
 function point(index){return mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);}
 function lowest(side){let height=Infinity,index;for(const candidate of boots[side]){const y=point(candidate).y;if(y<height){height=y;index=candidate;}}return{height,index};}
 return{asset,actor,select,pose,point,lowest};
}

for(const appearance of ['granadero','woman-scout'])test(`${appearance} standing owned lance idle supports complete native boots without moving its upper contact`,async()=>{
 const f=await fixture(appearance,'lance');try{const {clip,spec}=f.select('stand.idle.lance');assert.equal(clip.duration,Math.fround(59/30));assert.equal(spec.duration,1.999992);assert.equal(spec.nativeBootSupport.surface,'complete-native-boot');
 for(let i=0;i<=240;i++){f.pose(clip.duration*i/240);const heights=['l','r'].map(side=>f.lowest(side).height);assert.ok(Math.min(...heights)>.0005,`${appearance} actual complete boots at ${i}/240: ${heights}`);assert.ok(Math.min(...heights)<.0035,'The actual native torso has floor support');}
 }finally{f.actor.dispose();}
});
