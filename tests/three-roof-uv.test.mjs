import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {MeshStandardMaterial,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldBatch,WorldGeometry,disposeWorldNode,roofTextureProjector,cellTop}=await import('../web/lib/three/world-geometry.ts');
const {clipRoofCell}=await import('../web/lib/three/world-buildings.ts');
const close=(a,b)=>a.forEach((value,n)=>assert.ok(Math.abs(value-b[n])<1e-5,`${a} differs from ${b}`));

test('roof tile courses preserve direction and physical spacing after rotation and translation',()=>{
  const panel=[new Vector3(0,2.5,0),new Vector3(4,2.5,0),new Vector3(4,3.7,3),new Vector3(0,3.7,3)],points=[...panel,new Vector3(1.5,3.1,1.5)],expected=points.map(roofTextureProjector(panel));
  close(expected[0],[0,0]);close(expected[1],[4,0]);close(expected[2],[4,Math.hypot(3,1.2)]);close(expected[4],[1.5,Math.hypot(1.5,.6)]);
  for(let turn=0;turn<4;turn++){
    const rotate=point=>point.clone().applyAxisAngle(new Vector3(0,1,0),turn*Math.PI/2).add(new Vector3(13,1.4,-7)),project=roofTextureProjector(panel.map(rotate));
    points.map(rotate).forEach((point,n)=>close(project(point),expected[n]));
  }
});

test('hip triangles keep each row parallel to its eave rather than the world axes',()=>{
  const panel=[new Vector3(-2,2.5,-2),new Vector3(2,2.5,-2),new Vector3(.7,3.5,1)],project=roofTextureProjector(panel),a=panel[0].clone().lerp(panel[2],.5),b=panel[1].clone().lerp(panel[2],.5);
  assert.ok(Math.abs(project(a)[1]-project(b)[1])<1e-10,'points on a tile course need the same V');
  assert.ok(Math.abs(project(b)[0]-project(a)[0]-2)<1e-10,'course spacing must measure the eave direction');
});

test('clipped roofs retain their original texture origin and slope coordinates',()=>{
  const panel=[new Vector3(0,2.5,0),new Vector3(4,2.5,0),new Vector3(4,3.7,3),new Vector3(0,3.7,3)],project=roofTextureProjector(panel),clipped=clipRoofCell(panel,1,1,2,2),library=new WorldGeometry(),material=new MeshStandardMaterial(),batch=new WorldBatch(library);
  batch.polygon(material,clipped,1,project);const group=batch.finish('clipped-roof'),geometry=group.children[0].geometry,positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let n=0;n<positions.count;n++){const point=new Vector3().fromBufferAttribute(positions,n);close([uv.getX(n),uv.getY(n)],project(point));assert.ok(uv.getX(n)>=1-1e-5,'clipping must not restart the texture at zero');}
  disposeWorldNode(group);library.dispose();material.dispose();
});

test('shared ground polygons retain the existing world texture coordinates',()=>{
  const library=new WorldGeometry(),material=new MeshStandardMaterial(),batch=new WorldBatch(library);cellTop(batch,material,2,3,4,5,1.7);const group=batch.finish('ground'),geometry=group.children[0].geometry,positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let n=0;n<positions.count;n++)close([uv.getX(n),uv.getY(n)],[positions.getX(n),positions.getZ(n)+positions.getY(n)]);
  disposeWorldNode(group);library.dispose();material.dispose();
});
