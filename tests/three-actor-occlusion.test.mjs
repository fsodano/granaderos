import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Bone,Skeleton,SkinnedMesh,GreaterDepth,EqualStencilFunc,KeepStencilOp} from '../web/node_modules/three/build/three.module.js';
const {ActorOcclusion,markActorMaterials}=await import('../web/lib/three/actor-occlusion.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
test('selected actor occlusion uses world stencil pixels and shares the existing geometry and bones',()=>{
 const root=new Group(),bone=new Bone(),geometry=new BoxGeometry(),material=new MeshStandardMaterial(),body=new SkinnedMesh(geometry,material);root.add(bone,body);body.bind(new Skeleton([bone]));
 const view=new ActorOcclusion();view.setActor(root);view.sync();const overlay=body.children.find(n=>n.userData.occlusionOverlay);
 assert.ok(overlay instanceof SkinnedMesh);assert.equal(overlay.skeleton,body.skeleton);assert.equal(overlay.geometry,body.geometry);assert.equal(overlay.castShadow,false);assert.equal(overlay.material.depthFunc,GreaterDepth);assert.equal(overlay.material.depthWrite,false);assert.equal(overlay.material.stencilFunc,EqualStencilFunc);assert.equal(overlay.material.stencilRef,1);assert.equal(overlay.material.stencilZPass,KeepStencilOp);assert.equal(material.stencilRef,0);
 view.sync();assert.equal(body.children.length,1,'sync must not clone its own overlays');body.visible=false;assert.equal(overlay.parent.visible,false,'hidden source parts also hide their overlay');
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);view.dispose();assert.equal(body.children.length,0);assert.equal(disposed,0,'shared assets remain owned by their library');
});
test('selection changes and removed equipment remove every previous silhouette',()=>{
 const a=new Group(),b=new Group(),mesh=()=>new Mesh(new BoxGeometry(),new MeshStandardMaterial()),body=mesh(),item=mesh();a.add(body,item);b.add(mesh());const view=new ActorOcclusion();view.setActor(a);view.sync();assert.equal(item.children.length,1);
 item.removeFromParent();view.sync();assert.equal(item.children.length,0);view.setActor(b);view.sync();assert.equal(body.children.length,0);assert.equal(b.children[0].children.length,1);view.setActor(null);view.sync();assert.equal(b.children[0].children.length,0);view.dispose();
});
test('opaque world pixels mark occlusion; transparent smoke and glass do not erase the actor mask',()=>{
 const materials=new WorldMaterials({tileMetres:1,assetUrl:p=>p}),wall=materials.get('adobe'),smoke=materials.get('smoke',{opacity:.2}),glass=materials.get('glass',{opacity:.3});
 assert.equal(wall.stencilWrite,true);assert.equal(wall.stencilRef,1);assert.equal(smoke.stencilWrite,false);assert.equal(glass.stencilWrite,false);materials.dispose();
});
