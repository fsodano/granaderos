import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {Quaternion,Vector3}=await import('../web/node_modules/three/build/three.module.js');

test('masonry texel density follows real face dimensions through cell joins and rotations',()=>{
  for(const kind of ['adobe','limewash','ochre','brick','stone'])for(const angle of [0,Math.PI*.5,Math.PI,Math.PI*1.5]){
    const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:1.236,assetUrl:path=>path}),batch=new WorldBatch(geometry),material=materials.get(kind);
    const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle);
    batch.primitive('box',material,[4,6,3],[4,3,.18],rotation);
    batch.primitive('box',material,[8,6,3],[4,3,.18],rotation);
    const group=batch.finish('masonry'),mesh=group.children[0],p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
    // Every triangle edge keeps its physical length in the texture plane.
    // A normalized box would stretch the same image over 4 m and 3 m edges.
    for(let n=0;n<p.count;n+=3)for(const [a,b] of [[n,n+1],[n+1,n+2],[n+2,n]]){
      const physical=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
      const texture=Math.hypot(uv.getX(a)-uv.getX(b),uv.getY(a)-uv.getY(b));
      assert.ok(Math.abs(physical-texture)<1e-5,`${kind} ${angle}: ${physical} versus ${texture}`);
    }
    const normal=mesh.geometry.getAttribute('normal'),seen=new Map();
    for(let n=0;n<p.count;n++){
      const key=[p.getX(n),p.getY(n),p.getZ(n),normal.getX(n),normal.getY(n),normal.getZ(n)].map(value=>value.toFixed(4)).join(',');
      const value=[uv.getX(n),uv.getY(n)];if(seen.has(key))assert.deepEqual(value,seen.get(key),'coplanar joined faces keep a shared texture coordinate');else seen.set(key,value);
    }
    disposeWorldNode(group);geometry.dispose();materials.dispose();
  }
});

test('masonry mapping preserves the cached primitive and explicit polygon coordinates',()=>{
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:1,assetUrl:path=>path}),batch=new WorldBatch(geometry),original=[...geometry.get('box').getAttribute('uv').array];
  const projector=point=>[point.x*2,point.z*3];
  batch.box(materials.get('brick'),0,3,0,5,6,.2);
  batch.polygon(materials.get('stone'),[new Vector3(0,3,0),new Vector3(0,3,1),new Vector3(1,3,1)],1,projector);
  const group=batch.finish('mapping'),surface=group.children.find(mesh=>mesh.material.name==='world:stone'),uv=surface.geometry.getAttribute('uv');
  assert.deepEqual([...uv.array],[0,0,0,3,2,3]);
  assert.deepEqual([...geometry.get('box').getAttribute('uv').array],original);
  disposeWorldNode(group);geometry.dispose();materials.dispose();
});
