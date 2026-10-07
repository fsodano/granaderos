import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {architecturalDetails,roofEdgeDetails}=await import('../web/lib/three/world-building-details.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const T=1.2360585147470482;

function fixture(kind,side='south'){
  const b={id:'review',x:2,y:2,width:7,height:7,kind,rooms:[{id:'room',cells:[{x:3,y:3},{x:4,y:4}]}]},tiles=[];
  for(let y=2;y<=8;y++)for(let x=2;x<=8;x++){
    const border=x===2||x===8||y===2||y===8;
    const door=side==='south'?x===5&&y===8:side==='north'?x===5&&y===2:side==='west'?x===2&&y===5:x===8&&y===5;
    tiles.push({x,y,type:door?'door':border?'wall':'floor',buildingId:b.id,blocked:border&&!door,open:door,doorId:door?'entrance':undefined});
  }
  const input={terrain:{width:12,height:12,tiles,buildings:[b]},revealedRooms:[]},geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
  const frame=entranceFrame({...b,walls:tiles});
  const localBounds=object=>{
    const bounds=new Box3();object.traverse(child=>{if(child instanceof Mesh){const positions=child.geometry.getAttribute('position');for(let n=0;n<positions.count;n++){
      const x=positions.getX(n)/T-.4-frame.origin.x,z=positions.getZ(n)/T-.4-frame.origin.y;
      bounds.expandByPoint(new Vector3(x*frame.u.x+z*frame.u.y,positions.getY(n),x*frame.v.x+z*frame.v.y));
    }}});return bounds;
  };
  const dispose=object=>{disposeWorldNode(object);geometry.dispose();materials.dispose();};
  return {b,input,geometry,materials,frame,localBounds,dispose};
}

test('upper facade panes keep the same width and wall contact through all four rotations',()=>{
  let expected;
  for(const side of ['north','east','south','west']){
    const f=fixture('palace',side),details=architecturalDetails(f.b,f.input,T,4.9,0,f.geometry,f.materials,false),windows=details.getObjectByName('building-detail:review:upper-windows'),bounds=f.localBounds(windows);
    assert.ok(bounds.min.z<-.06/T&&bounds.max.z<0,'panes and their trim must sit on the exterior facade');
    assert.ok(bounds.max.z-bounds.min.z<.12/T,'facade panes must stay thin along the wall normal');
    const actual=[...bounds.min.toArray(),...bounds.max.toArray()];
    if(expected)actual.forEach((value,n)=>assert.ok(Math.abs(value-expected[n])<1e-5,`${side} changes facade geometry`));else expected=actual;
    f.dispose(details);
  }
});

test('civic clock cupolas rest above the ground doorway in every orientation',()=>{
  for(const kind of ['cabildo','townhall'])for(const side of ['north','east','south','west']){
    const f=fixture(kind,side),height=kind==='townhall'?4.7:2.5,details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),tower=details.getObjectByName('building-detail:review:civic-clock-tower'),bounds=new Box3().setFromObject(tower);
    assert.ok(bounds.min.y>=height-.19,'the cupola must not extrude to the street');
    assert.ok(tower.children.some(child=>child.material?.name==='world:linen'),'clock faces must be present');
    const p=f.frame.at(f.frame.doorU,-1),ray=new Raycaster(new Vector3((p.x+.4)*T,1,(p.y+.4)*T),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6);
    details.updateMatrixWorld(true);assert.equal(ray.intersectObject(details,true).length,0,'exterior details must leave the doorway clear');
    f.dispose(details);
  }
});

test('pulperia trade signs keep their bracket and front face through rotation',()=>{
  let expected;
  for(const side of ['north','east','south','west']){
    const f=fixture('pulperia',side),details=architecturalDetails(f.b,f.input,T,2.5,0,f.geometry,f.materials,false),sign=details.getObjectByName('building-detail:review:trade-sign'),bounds=f.localBounds(sign),actual=[...bounds.min.toArray(),...bounds.max.toArray()];
    assert.ok(sign.children.some(child=>child.material?.name==='world:iron'),'the sign must have hanging hardware');
    assert.ok(bounds.max.z<.05&&bounds.min.z<-.5,'the sign must hang outside with its bracket anchored in the facade');
    if(expected)actual.forEach((value,n)=>assert.ok(Math.abs(value-expected[n])<1e-5));else expected=actual;
    f.dispose(details);
  }
});

test('farmhouse roof receives a capped domestic chimney, with finite shaded geometry',()=>{
  const f=fixture('farmhouse'),details=architecturalDetails(f.b,f.input,T,2.5,0,f.geometry,f.materials,false),chimney=details.getObjectByName('building-detail:review:domestic-chimney'),bounds=new Box3().setFromObject(chimney);
  assert.ok(bounds.max.y>3.5);assert.ok(chimney.children.some(child=>child.material?.name==='world:brick'));
  details.traverse(child=>{if(child instanceof Mesh){assert.ok(child.geometry.getAttribute('normal'));for(const value of child.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));}});f.dispose(details);
});

test('pitched roof eaves have depth and joined ridges, then disappear during room cutaway',()=>{
  const f=fixture('house'),a=new Vector3(0,2.5,0),b=new Vector3(4,2.5,0),c=new Vector3(2,3.5,0),d=new Vector3(2,3.5,4),e=new Vector3(0,2.5,4),g=new Vector3(4,2.5,4);
  const edges=roofEdgeDetails('review',[[a,e,d,c],[b,c,d,g]],2.5,f.geometry,f.materials.get('clay'),f.materials.get('darkwood'),1),bounds=new Box3().setFromObject(edges);
  assert.ok(Math.abs(bounds.min.y-2.425)<1e-5,'the eave needs a visible fascia depth');assert.ok(bounds.max.y>3.55,'the roof ridge needs a rounded cap');
  assert.ok(edges.children.some(child=>child.material?.name==='world:clay'));disposeWorldNode(edges);
  const exterior=buildBuilding(f.b,f.input,T,f.geometry,f.materials);assert.ok(exterior.getObjectByName('building-roof-edges:review'));disposeWorldNode(exterior);
  const interior=buildBuilding(f.b,{...f.input,revealedRooms:['room']},T,f.geometry,f.materials);assert.equal(interior.getObjectByName('building-roof-edges:review'),undefined);assert.equal(interior.getObjectByName('building-details:review'),undefined);f.dispose(interior);
});

test('flat terraces use masonry by default and preserve authored roof finishes',()=>{
  for(const roofFinish of [undefined,'aged','thatch']){
    const f=fixture('house');f.b.roof='terrace';if(roofFinish)f.b.roofFinish=roofFinish;
    const building=buildBuilding(f.b,f.input,T,f.geometry,f.materials),fabric=building.getObjectByName('building-fabric:review');
    const material=roofFinish?`world:${roofFinish}`:'world:stone';
    const roof=fabric.children.find(child=>child.material?.name===material&&child.material.polygonOffset);
    assert.ok(roof,`flat terrace must use ${material}`);assert.ok(roof.material.polygonOffsetFactor<0,'roof/wall joins need a depth bias');
    const edges=building.getObjectByName('building-roof-edges:review');assert.ok(edges.children.every(child=>child.material?.name==='world:stone'),'terrace coping must retain a masonry edge');
    f.dispose(building);
  }
});
