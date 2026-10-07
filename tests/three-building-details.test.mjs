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
    const f=fixture('pulperia',side),details=architecturalDetails(f.b,f.input,T,2.5,0,f.geometry,f.materials,false),sign=details.getObjectByName('building-detail:review:trade-sign'),bounds=f.localBounds(sign),door=f.frame.doorU-.4*(f.frame.u.x+f.frame.u.y),actual=[bounds.min.x-door,bounds.min.y,bounds.min.z,bounds.max.x-door,bounds.max.y,bounds.max.z];
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

test('chapels use a roof-supported bell gable with a real arched opening in every orientation',()=>{
  let expected;
  for(const side of ['north','east','south','west']){
    const f=fixture('chapel',side),height=2.5,details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),bell=details.getObjectByName('building-detail:review:chapel-bell-gable');
    assert.ok(bell);assert.equal(details.getObjectByName('building-detail:review:bell-tower'),undefined,'a modest chapel must not reuse the parish tower');
    const bounds=f.localBounds(bell),door=f.frame.doorU-.4*(f.frame.u.x+f.frame.u.y),actual=[bounds.min.x-door,bounds.max.x-door,bounds.min.y,bounds.max.y,bounds.min.z,bounds.max.z];
    if(expected)actual.forEach((value,n)=>assert.ok(Math.abs(value-expected[n])<1e-5));else expected=actual;
    assert.ok(bounds.min.y>height+.6);assert.ok(bell.children.some(child=>child.material?.name==='world:brass'));
    const spring=height+30/25.066666666666666*.62+.55,p=f.frame.at(door,-1),ray=new Raycaster(new Vector3((p.x+.4)*T,spring+.14,(p.y+.4)*T),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.5);
    details.updateMatrixWorld(true);assert.equal(ray.intersectObject(bell,true).length,0,'the bell gable must have an actual opening above the hanging beam');
    f.dispose(details);
  }
});

test('domestic and forge chimneys are supported by solid side walls and avoid playable upper floor cells',()=>{
  for(const kind of ['house','smithy'])for(const side of ['north','east','south','west']){
    const name=kind==='smithy'?'forge-chimney':'domestic-chimney',f=fixture(kind,side),height=2.5,before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),chimney=details.getObjectByName(`building-detail:review:${name}`),bounds=new Box3().setFromObject(chimney);
    assert.ok(chimney);assert.ok(bounds.min.y>=height-.13&&bounds.max.y>4,'a capped chimney must clear the pitched roof');
    if(kind==='smithy')assert.ok(chimney.children.some(child=>child.material?.name==='world:brick'),'the forge chimney keeps its brick construction');
    const x=Math.round(bounds.getCenter(new Vector3()).x/T),y=Math.round(bounds.getCenter(new Vector3()).z/T);assert.equal(f.input.terrain.tiles.find(tile=>tile.x===x&&tile.y===y)?.type,'wall');
    assert.equal(JSON.stringify(f.input),before);disposeWorldNode(details);
    f.input.terrain.upperSurfaces=f.input.terrain.tiles.filter(tile=>tile.type==='wall').map(tile=>({...tile,type:'floor',kind:'roof',tacticalLevel:1,blocked:false,elevation:3}));
    const playable=architecturalDetails(f.b,f.input,T,3,0,f.geometry,f.materials,false);assert.equal(playable.getObjectByName(`building-detail:review:${name}`),undefined,'a decoration must not occupy an existing roof walking tile');disposeWorldNode(playable);
    delete f.input.terrain.upperSurfaces;for(const tile of f.input.terrain.tiles.filter(tile=>tile.type==='wall'))tile.type='window';
    const unsupported=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false);assert.equal(unsupported.getObjectByName(`building-detail:review:${name}`),undefined);f.dispose(unsupported);
  }
});

test('chapel bell gables and domestic or forge chimneys disappear with the inspected room',()=>{
  for(const kind of ['chapel','house','smithy']){
    const f=fixture(kind),building=buildBuilding(f.b,{...f.input,revealedRooms:['room']},T,f.geometry,f.materials);
    assert.equal(building.getObjectByName('building-details:review'),undefined);f.dispose(building);
  }
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

test('church towers occupy solid corner foundations through every rotation and skip missing supports',()=>{
  for(const side of ['north','east','south','west'])for(const wide of [false,true]){
    const f=fixture('church',side);
    if(wide)for(const u of [0,1])for(const v of [0,1]){const p=f.frame.at(f.frame.width-u,v);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='wall';}
    const before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,2.55,0,f.geometry,f.materials,false),tower=details.getObjectByName('building-detail:review:bell-tower'),base=new Box3();
    tower.traverse(child=>{if(child instanceof Mesh){const positions=child.geometry.getAttribute('position');for(let n=0;n<positions.count;n++)if(positions.getY(n)<.001)base.expandByPoint(new Vector3().fromBufferAttribute(positions,n));}});
    for(let y=Math.floor(base.min.z/T+.5);y<=Math.ceil(base.max.z/T-.5);y++)for(let x=Math.floor(base.min.x/T+.5);x<=Math.ceil(base.max.x/T-.5);x++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===x&&tile.y===y)?.type,'wall',`${side} tower occupies a non-solid cell at ${x},${y}`);
    assert.equal(JSON.stringify(f.input),before);disposeWorldNode(details);
    for(const u of [0,f.frame.width]){const p=f.frame.at(u,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='window';}
    const unsupported=architecturalDetails(f.b,f.input,T,2.55,0,f.geometry,f.materials,false);assert.equal(unsupported.getObjectByName('building-detail:review:bell-tower'),undefined);f.dispose(unsupported);
  }
});

test('church shaped facades and circular barred oculi stay joined and rotate with the entrance',()=>{
  let expected;
  for(const side of ['north','east','south','west']){
    const f=fixture('church',side),height=2.55,before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),facade=details.getObjectByName('building-detail:review:church-shaped-facade'),oculus=details.getObjectByName('building-detail:review:church-oculus'),pilasters=details.getObjectByName('building-detail:review:church-facade-pilasters');
    assert.ok(facade&&oculus&&pilasters);const bounds=f.localBounds(facade),center=f.frame.doorU-.4*(f.frame.u.x+f.frame.u.y),actual=[bounds.min.x-center,bounds.max.x-center,bounds.min.y,bounds.max.y,bounds.min.z,bounds.max.z];
    // The crest may clamp along a compact facade; its shape and thickness
    // still remain the same through every tile rotation.
    if(expected)actual.slice(2).forEach((value,n)=>assert.ok(Math.abs(value-expected[n+2])<1e-5));else expected=actual;
    assert.ok(bounds.min.y<height&&bounds.max.y>height+1.9,'curved masonry must join the original gable and rise above it');
    assert.ok(bounds.max.z>0&&bounds.min.z<-.20/T,'the facade needs real masonry thickness at the shell');
    assert.ok(oculus.children.some(child=>child.material?.name==='world:iron'));assert.ok(oculus.children.some(child=>child.material?.name==='world:darkwood'));
    const circle=f.localBounds(oculus);assert.ok(Math.abs((circle.max.x-circle.min.x)*T-(circle.max.y-circle.min.y))<.01,'the oculus must remain circular in physical metres');assert.ok(circle.min.y>height);
    details.traverse(child=>{if(child instanceof Mesh){assert.ok(child.geometry.getAttribute('normal')&&child.geometry.getAttribute('uv'));for(const value of child.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));}});
    assert.equal(JSON.stringify(f.input),before);f.dispose(details);
  }
});

test('compact and reserved parish belfries show arched faces above the nave on all four sides',()=>{
  for(const side of ['north','east','south','west'])for(const wide of [false,true]){
    const f=fixture('church',side);if(wide)for(const u of [0,1])for(const v of [0,1]){const p=f.frame.at(f.frame.width-u,v);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='wall';}
    const height=2.55,details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),tower=details.getObjectByName('building-detail:review:bell-tower'),panes=tower.children.find(child=>child.material?.name==='world:darkwood'),bounds=f.localBounds(panes);
    assert.ok(bounds.max.y-bounds.min.y>(wide?1.2:.8),'parish tower must have readable tall bell openings');
    const roofRise=38/25.066666666666666,top=height+roofRise+(wide?1.80:1.25),cy=top-.17-(wide?1.30:.85)*.5,centerU=f.frame.width-(wide?.5:0)-.4*(f.frame.u.x+f.frame.u.y),centerV=(wide?.5:0)-.4*(f.frame.v.x+f.frame.v.y);
    assert.ok(bounds.min.y>height+roofRise+.20,'the complete bell opening must rise above the nave ridge');
    tower.updateMatrixWorld(true);for(const [du,dv]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const p=f.frame.at(centerU+du*1.4,centerV+dv*1.4),ray=new Raycaster(new Vector3((p.x+.4)*T,cy,(p.y+.4)*T),new Vector3(-du*f.frame.u.x-dv*f.frame.v.x,0,-du*f.frame.u.y-dv*f.frame.v.y),0,T);
      assert.ok(ray.intersectObject(panes,true).length>0,'every belfry face must retain its dark arched inset');
    }
    f.dispose(details);
  }
});

test('church facade additions preserve doorway, window and breach paths through every rotation',()=>{
  for(const side of ['north','east','south','west'])for(const type of ['window','rubble']){
    const f=fixture('church',side),point=f.frame.at(1,0),tile=f.input.terrain.tiles.find(tile=>tile.x===point.x&&tile.y===point.y);tile.type=type;
    const before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,2.55,0,f.geometry,f.materials,false);details.updateMatrixWorld(true);
    for(const [u,y]of [[f.frame.doorU,1.90],[1,type==='window'?1.3:1.90]]){
      const actual=u-.4*(f.frame.u.x+f.frame.u.y),start=f.frame.at(actual,-1),ray=new Raycaster(new Vector3((start.x+.4)*T,y,(start.y+.4)*T),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6);
      assert.equal(ray.intersectObject(details,true).length,0,`${side} ${type} must remain clear`);
    }
    assert.equal(JSON.stringify(f.input),before);f.dispose(details);
  }
});

test('parish towers and front crests follow authored slab and terrace roofs without a generated pitch',()=>{
  for(const side of ['north','east','south','west'])for(const roof of ['terrace','slab']){
    const f=fixture('church',side);for(const u of [0,1])for(const v of [0,1]){const p=f.frame.at(f.frame.width-u,v);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='wall';}
    if(roof==='terrace')f.b.roof='terrace';
    else f.input.terrain.upperSurfaces=[{x:3,y:3,type:'floor',kind:'roof',buildingId:f.b.id,tacticalLevel:1,elevation:3.2,blocked:false}];
    const before=JSON.stringify(f.input),building=buildBuilding(f.b,f.input,T,f.geometry,f.materials),height=building.userData.height,tower=building.getObjectByName('building-detail:review:bell-tower'),panes=tower.children.find(child=>child.material?.name==='world:darkwood'),crest=building.getObjectByName('building-detail:review:church-shaped-facade');
    assert.equal(height,roof==='slab'?3.2:64/25.066666666666666,'metric slabs must supply the actual roof elevation');
    const openings=new Box3().setFromObject(panes),outline=new Box3().setFromObject(crest);
    assert.ok(openings.min.y>height+.20&&openings.min.y<height+.40,'the bell stage must clear the flat roof without adding the template pitch');
    assert.ok(new Box3().setFromObject(tower).max.y<height+3.1,'flat roofs must not inherit the generated nave rise');
    assert.ok(outline.min.y<height&&outline.max.y<height+.9,'the front crest must join the authored flat shell');
    assert.equal(JSON.stringify(f.input),before);f.dispose(building);
  }
});

test('parish and civic towers preserve legal upper routes while retaining blocked and ground surfaces',()=>{
  for(const kind of ['church','cabildo','townhall'])for(const side of ['north','east','south','west'])for(const mode of ['blocked','ground','walkable']){
    const f=fixture(kind,side),name=kind==='church'?'bell-tower':'civic-clock-tower';
    // Every perimeter cell covers both possible parish foundations and the
    // civic base. Upper cells are ordinary authoritative scene surfaces.
    f.input.terrain.upperSurfaces=f.input.terrain.tiles.filter(tile=>tile.type!=='floor').map(tile=>({...tile,type:'floor',kind:'roof',tacticalLevel:mode==='ground'?0:1,elevation:3,blocked:mode==='blocked'}));
    const before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,3,0,f.geometry,f.materials,false);
    assert.equal(Boolean(details.getObjectByName(`building-detail:review:${name}`)),mode!=='walkable',`${kind} ${side} must preserve ${mode} roof surfaces`);
    assert.equal(JSON.stringify(f.input),before);f.dispose(details);
  }
});

test('civic tower clearance checks its full base footprint and parish towers can use the other supported corner',()=>{
  for(const side of ['north','east','south','west']){
    const f=fixture('cabildo',side),center=f.frame.at(f.frame.width*.5,.1),height=3;
    f.input.terrain.upperSurfaces=[{x:Math.floor(center.x+.4)+1,y:Math.round(center.y+.4),type:'floor',kind:'roof',buildingId:f.b.id,tacticalLevel:1,elevation:height,blocked:false}];
    const details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false);
    assert.equal(details.getObjectByName('building-detail:review:civic-clock-tower'),undefined,'a route touching the broad cornice must not be hidden by a tower whose centre is in another cell');f.dispose(details);
    const g=fixture('church',side),blocked=g.frame.at(g.frame.width,0);g.input.terrain.upperSurfaces=[{...blocked,type:'floor',kind:'roof',buildingId:g.b.id,tacticalLevel:1,elevation:height,blocked:false}];
    const alternate=architecturalDetails(g.b,g.input,T,height,0,g.geometry,g.materials,false),tower=alternate.getObjectByName('building-detail:review:bell-tower'),bounds=g.localBounds(tower);
    assert.ok(tower,'an intact opposite foundation can retain the parish tower');assert.ok(bounds.getCenter(new Vector3()).x<1,'the tower must move to the unoccupied supported corner');g.dispose(alternate);
  }
});

test('palace balcony follows the actual doorway and requires both solid entrance supports',()=>{
  for(const side of ['north','east','south','west']){
    const f=fixture('palace',side),before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,4.95,0,f.geometry,f.materials,false),balcony=details.getObjectByName('building-detail:review:palace-balcony'),bounds=f.localBounds(balcony);
    const actualDoor=f.frame.doorU-.4*(f.frame.u.x+f.frame.u.y);
    assert.ok(Math.abs(bounds.getCenter(new Vector3()).x-actualDoor)<1e-5,'balcony must align with the real door midpoint');
    assert.ok(bounds.min.y>2.6,'balcony must stay above the ground passage');assert.ok(balcony.children.some(child=>child.material?.name==='world:iron'),'balcony must have an iron railing');
    assert.equal(JSON.stringify(f.input),before);disposeWorldNode(details);
    for(const type of ['window','door','rubble']){
      const p=f.frame.at(f.frame.doorU+1,0),support=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);support.type=type;
      const unsupported=architecturalDetails(f.b,f.input,T,4.95,0,f.geometry,f.materials,false);assert.equal(unsupported.getObjectByName('building-detail:review:palace-balcony'),undefined,`${type} must remove the unsupported balcony`);disposeWorldNode(unsupported);
    }
    f.geometry.dispose();f.materials.dispose();
  }
});

test('barracks and stable details preserve the open doorway in all four orientations',()=>{
  for(const kind of ['barracks','stable'])for(const side of ['north','east','south','west']){
    const f=fixture(kind,side),before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,2.5,0,f.geometry,f.materials,false),feature=details.getObjectByName(`building-detail:review:${kind==='barracks'?'barracks-gate':'stable-timber-frame'}`);
    assert.ok(feature);assert.ok(feature.children.some(child=>child.material?.name===(kind==='barracks'?'world:brass':'world:wood')));
    const u=f.frame.doorU-.4*(f.frame.u.x+f.frame.u.y),p=f.frame.at(u,-1),ray=new Raycaster(new Vector3((p.x+.4)*T,1,(p.y+.4)*T),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6);details.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(details,true).length,0,`${kind} details obstruct the door at ${side}`);assert.equal(JSON.stringify(f.input),before);f.dispose(details);
  }
});

test('palace balcony and military details leave no floating features during room cutaway',()=>{
  for(const kind of ['palace','barracks','stable','church']){
    const f=fixture(kind),building=buildBuilding(f.b,{...f.input,revealedRooms:['room']},T,f.geometry,f.materials);
    assert.equal(building.getObjectByName('building-details:review'),undefined);assert.equal(building.getObjectByName('building-roof-edges:review'),undefined);f.dispose(building);
  }
});

test('tall civic facades have separate arcade levels, iron rails, side windows and a roof-supported clock',()=>{
  for(const kind of ['cabildo','townhall'])for(const side of ['north','east','south','west']){
    const f=fixture(kind,side),height=5.1,details=architecturalDetails(f.b,f.input,T,height,0,f.geometry,f.materials,false),ground=details.getObjectByName('building-detail:review:civic-ground-arcade'),upper=details.getObjectByName('building-detail:review:civic-upper-arcade'),cornices=details.getObjectByName('building-detail:review:civic-cornices'),windows=details.getObjectByName('building-detail:review:civic-side-windows'),tower=details.getObjectByName('building-detail:review:civic-clock-tower');
    const lowerBounds=new Box3().setFromObject(ground),upperBounds=new Box3().setFromObject(upper);
    assert.ok(lowerBounds.max.y<height*.51&&upperBounds.min.y>height*.51,'arcade floors must remain visually separate');
    assert.ok(upper.children.some(child=>child.material?.name==='world:darkwood'));assert.ok(upper.children.some(child=>child.material?.name==='world:iron'),'upper arcade needs its period rail');
    assert.ok(new Box3().setFromObject(cornices).max.y>5);assert.ok(windows.children.some(child=>child.material?.name==='world:iron'),'side windows need wrought iron bars');
    const clockBounds=new Box3().setFromObject(tower);assert.ok(clockBounds.min.y>height-.20);assert.ok(clockBounds.max.y>height+2.9,'clock cupola must rise clearly above the roof');f.dispose(details);
  }
});

test('civic decoration leaves doors, windows and wall breaches clear through all rotations',()=>{
  for(const side of ['north','east','south','west']){
    const f=fixture('cabildo',side);
    for(const [offset,type]of [[-1,'window'],[1,'rubble']]){const p=f.frame.at(f.frame.doorU+offset,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;}
    const before=JSON.stringify(f.input),details=architecturalDetails(f.b,f.input,T,5.1,0,f.geometry,f.materials,false);details.updateMatrixWorld(true);
    for(const [offset,y]of [[-1,1.3],[0,1.90],[1,1.90]]){
      const u=f.frame.doorU+offset-.4*(f.frame.u.x+f.frame.u.y),p=f.frame.at(u,-1),ray=new Raycaster(new Vector3((p.x+.4)*T,y,(p.y+.4)*T),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6);
      assert.equal(ray.intersectObject(details,true).length,0,`${side} civic decoration obstructs ${offset}`);
    }
    assert.equal(JSON.stringify(f.input),before);f.dispose(details);
  }
});

test('short civic profiles keep one arcade level and revealed rooms omit every civic detail',()=>{
  const f=fixture('cabildo'),short=architecturalDetails(f.b,f.input,T,2.5,0,f.geometry,f.materials,false);assert.ok(short.getObjectByName('building-detail:review:civic-ground-arcade'));assert.equal(short.getObjectByName('building-detail:review:civic-upper-arcade'),undefined);disposeWorldNode(short);
  const interior=buildBuilding(f.b,{...f.input,revealedRooms:['room']},T,f.geometry,f.materials);assert.equal(interior.getObjectByName('building-details:review'),undefined);f.dispose(interior);
});
