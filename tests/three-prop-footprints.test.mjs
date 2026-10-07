import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps}=await import('../web/lib/three/world-props.ts');
const {buildCannon}=await import('../web/lib/three/world-artillery.ts');
const T=1.2360585147470482;
function check(prop){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),before=structuredClone(prop);
 const group=buildProps('bounds',[prop],{terrain:{tiles:[]}},T,geometry,materials),box=new Box3().setFromObject(group),eps=1e-5;
 assert.ok(box.min.x>=(prop.x-.5)*T-eps&&box.max.x<=(prop.x+prop.footprint.width-.5)*T+eps,`${prop.type} ${prop.rotation}: X ${box.min.x},${box.max.x}`);
 assert.ok(box.min.z>=(prop.y-.5)*T-eps&&box.max.z<=(prop.y+prop.footprint.height-.5)*T+eps,`${prop.type} ${prop.rotation}: Z ${box.min.z},${box.max.z}`);
 assert.ok(box.min.y>=(prop.elevation??0)-eps,`${prop.type} must not sink below its floor`);
 assert.deepEqual(prop,before);disposeWorldNode(group);geometry.dispose();materials.dispose();
}
test('cart shafts, wheel rims and hubs fit its actual footprint on ground and upper floors',()=>{
 for(const footprint of [{width:2,height:1},{width:1,height:2},{width:1,height:1},{width:2,height:2}])for(const rotation of [0,90,180,270])for(const elevation of [0,3])check({id:'cart',type:'cart',x:2,y:3,footprint,rotation,elevation});
});
test('seeded loose timber and rubble remain in their cell through every authored rotation',()=>{
 for(const type of ['broken-timber','rubble'])for(const rotation of [0,90,180,270])for(let n=0;n<12;n++)check({id:type,type,x:n%4,y:Math.floor(n/4),footprint:{width:1,height:1},rotation,elevation:3});
});
test('cannon tyres and trail rest above their authoritative ground or upper surface',()=>{
 for(const type of ['bronze4','field8','swivel'])for(const elevation of [0,3])for(let direction=0;direction<8;direction++){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
  const group=buildCannon({id:'gun',type,x:4,y:3,elevation,facing:direction*Math.PI/4,loaded:true},{terrain:{tiles:[]}},T,geometry,materials),box=new Box3().setFromObject(group);
  assert.ok(box.min.y>=elevation-1e-5,`${type} at ${elevation}: ${box.min.y}`);disposeWorldNode(group);geometry.dispose();materials.dispose();
 }
});
