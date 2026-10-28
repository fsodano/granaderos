import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3,Quaternion} from '../web/node_modules/three/build/three.module.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
for(const appearance of ['granadero','woman-scout'])test(`${appearance} keeps its lance continuous through carry and brace crossfades`,async()=>{
 const asset=await publishedActor(appearance,0),v={key:'unit:lance',id:'lance',kind:'unit',appearance,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'blade',items:[{id:'1812',reference:'primary',socket:'handRight'}],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{head:1.6,torso:1.2,legs:.5,muzzle:1.3}},runtime=new ActorRuntime(asset,v);
 runtime.tick(.1,0);runtime.tick(.1,100);runtime.root.updateMatrixWorld(true);
 const item=runtime.model.getObjectByName('primary:1812'),hand=runtime.model.getObjectByName('hand_r'),skin=[];
 runtime.model.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.material.name!=='Skin')return;const indices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){let influence=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i,j)].name;if(name==='hand_r')influence+=mesh.geometry.attributes.skinWeight.getComponent(i,j);}if(influence>.75)indices.push(i);}if(indices.length)skin.push({mesh,indices});});
 const snapshot=(phase,time)=>{runtime.root.updateMatrixWorld(true);const q=item.getWorldQuaternion(new Quaternion()),axis=new Vector3(0,1,0).applyQuaternion(q),wrist=hand.getWorldPosition(new Vector3()),base=item.getWorldPosition(new Vector3());let palmGap=Infinity;for(const {mesh,indices}of skin)for(const i of indices){const p=mesh.localToWorld(mesh.getVertexPosition(i,new Vector3())),local=item.worldToLocal(p);if(Math.abs(local.y)>.12)continue;palmGap=Math.min(palmGap,Math.abs(Math.hypot(local.x,local.z)-.017));}return{phase,time,axis:axis.toArray(),localQuaternion:item.quaternion.toArray(),gripToWrist:base.distanceTo(wrist),palmShaftSurfaceGap:palmGap,worldPosition:base.toArray(),hand:wrist.toArray()};};
 const frames=[snapshot('carry',0)];
 runtime.update({...v,action:'brace',idleAction:'brace'},200);runtime.tick(0,200);frames.push(snapshot('brace',0));
 for(let i=1;i<=18;i++){runtime.tick(1/120,200+i*1000/120);frames.push(snapshot('brace',i/120));}
 runtime.update(v,400);runtime.tick(0,400);frames.push(snapshot('return',0));
 for(let i=1;i<=18;i++){runtime.tick(1/120,400+i*1000/120);frames.push(snapshot('return',i/120));}
 const edge=(i)=>new Vector3(...frames[i].axis).angleTo(new Vector3(...frames[i-1].axis))*180/Math.PI;
 assert.ok(edge(1)<.001,'Carry to brace has no zero-delta weapon-axis jump');
 assert.ok(edge(20)<.001,'Brace to carry has no zero-delta weapon-axis jump');
 for(let i=1;i<frames.length;i++)assert.ok(edge(i)<10,`${frames[i].phase}/${frames[i].time}: no single 120 Hz frame contains the attachment's 55-degree turn`);
 assert.ok(Math.max(...frames.map(frame=>frame.palmShaftSurfaceGap))<.001,'The actual right-palm surface stays within 1 mm of the held shaft');
 runtime.dispose();
});
