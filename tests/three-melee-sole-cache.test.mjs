import assert from 'node:assert/strict';
import test from 'node:test';import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {NativeMeleeContactFit}=await import('../web/lib/three/melee-contact-fit.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {Vector3,Float32BufferAttribute}=await import('../web/node_modules/three/build/three.module.js');

test('cached sole transforms retain actual native footwear and active morphs',async()=>{
 for(const appearance of ['granadero','woman-scout'])for(const posture of ['standing','crouched'])for(const height of [0,3]){
  const asset=await publishedActor(appearance,0),visual={key:'unit:p',kind:'unit',id:'p',appearance,skin:'light',side:'player',tacticalLevel:0,garments:{headwear:null,outfit:null,legwear:null},selected:false,position:[7.12,height,5.86],yaw:Math.PI/4,posture,mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],bodyHeights:{standing:1.74,crouched:1.12,prone:.3},palette:{},variant:'idle'},runtime=new ActorRuntime(asset,visual);
  runtime.tick(.1,1000);runtime.root.updateMatrixWorld(true);const footwear=asset.appearance.parts.footwear.replace('{lod}',String(asset.lod)),fit=new NativeMeleeContactFit(runtime.model,runtime.root,footwear);
  for(const sole of fit.soles.values())for(const index of sole.vertices){
   const current=fit.solePoint(sole,index,new Vector3()),native=sole.mesh.localToWorld(sole.mesh.getVertexPosition(index,new Vector3()));assert.ok(current.distanceTo(native)<1e-6,appearance+'/'+posture+'/'+height+' sole '+index);
  }
  const sole=[...fit.soles.values()][0],geometry=sole.mesh.geometry,changed=geometry.clone(),values=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=.003;values[i+1]=.002;}
  changed.morphAttributes.position=[new Float32BufferAttribute(values,3)];changed.morphTargetsRelative=true;sole.mesh.geometry=changed;sole.mesh.morphTargetInfluences=[.4];
  const index=sole.vertices[0];assert.ok(fit.solePoint(sole,index,new Vector3()).distanceTo(sole.mesh.localToWorld(sole.mesh.getVertexPosition(index,new Vector3())))<1e-8,'A real footwear morph retains native deformation');
  sole.mesh.geometry=geometry;sole.mesh.morphTargetInfluences=[];changed.dispose();fit.dispose();runtime.dispose();
 }
});
