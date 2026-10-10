import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {civicCorniceRoofJoin}=await import('../web/lib/three/world-civic-cornice.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {ISO_PITCH}=await import('../web/lib/three/projection.ts');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,V=25.066666666666666,ids=['ayuntamiento','palacio'],rotations=[0,90,180,270],camera=new Vector3(Math.cos(ISO_PITCH)/Math.SQRT2,Math.sin(ISO_PITCH),Math.cos(ISO_PITCH)/Math.SQRT2);
function fixture(id,rotation,view='exterior',roof='original'){
 const s=createArchitectureReviewBattle(id,rotation,view,roof),b=s.buildings[0],frame=entranceFrame({...b,walls:s.tiles}),input={terrain:{width:s.width,height:s.height,tiles:s.tiles,buildings:s.buildings,upperSurfaces:s.upperSurfaces},revealedRooms:s.revealedRooms},g=new WorldGeometry(),m=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
 return {b,input,frame,g,m,point(u,v,y){const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);},build(){const saved=JSON.stringify(input),n=buildBuilding(b,input,T,g,m);n.updateMatrixWorld(true);assert.equal(JSON.stringify(input),saved);return n;},bands(n){return n.getObjectByName(`building-detail:${b.id}:${id==='palacio'?'palace':'townhall'}-storey-bands`);},dispose(n){disposeWorldNode(n);g.dispose();m.dispose();}};
}
function vertices(o){const all=[];o.traverse(n=>{if(n instanceof Mesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)all.push(new Vector3(p.getX(i),p.getY(i),p.getZ(i)));}});return all;}
function cornices(f){const result=[];const visit=e=>{if(!e)return;if(Array.isArray(e)){e.forEach(visit);return;}if(e.type===ArchitectureVolume&&String(e.props.label??'').includes('upper-cornice'))result.push(e.props);visit(e.props?.children);};for(const e of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(e.node);assert.equal(result.length,2);return result;}
function sourceCorners(part){return [part.bottom/V,part.top/V].flatMap(y=>part.points.map(p=>new Vector3(p.x*T,y,p.y*T)));}
function capSamples(f,top){const points=[];for(const v of [-.21,f.frame.depth+.21])for(const u of [0,f.frame.width*.25,f.frame.width*.5,f.frame.width*.75,f.frame.width])points.push(f.point(u,v,top));for(const u of [-.21,f.frame.width+.21])for(const v of [0,f.frame.depth*.25,f.frame.depth*.5,f.frame.depth*.75,f.frame.depth])points.push(f.point(u,v,top));for(const p of points){p.x=Math.fround(p.x);p.z=Math.fround(p.z);}return points;}

test('actual civic cornices keep every current source body and cap corner, section and local plaster recipe across all paints and rotations',()=>{
 for(const id of ids)for(const rotation of rotations)for(const finish of ['adobe','limewash','ochre','stone','brick']){
  const f=fixture(id,rotation);f.b.wallFinish=finish;const source=cornices(f),n=f.build(),band=f.bands(n),body=band.children.find(m=>m.material.userData.architectureFinish?.texture.endsWith('-plaster-v2.png')),cap=band.children.find(m=>m.material.name==='world:civic-band-plaster-coping');assert.ok(body&&cap);
  for(const part of source){const actual=vertices(body);for(const expected of sourceCorners(part))assert.ok(actual.some(p=>p.distanceTo(expected)<2e-5));for(const expected of sourceCorners({...part,bottom:part.top}))assert.ok(vertices(cap).some(p=>p.distanceTo(expected)<2e-5));assert.equal(body.material.color.getHexString(),part.palette.base.slice(1));assert.equal(cap.material.color.getHexString(),part.palette.trim.slice(1));assert.equal(body.material.userData.architectureFinish.textureOpacity,.36);assert.equal(body.material.userData.architectureFinish.multiplyOpacity,0);}
  for(const p of vertices(body)){const cell=f.input.terrain.tiles.find(t=>t.buildingId===f.b.id&&['wall','door','window'].includes(t.type)&&Math.abs(t.x-p.x/T)<=.50002&&Math.abs(t.y-p.z/T)<=.50002);assert.ok(cell,'the complete cornice belongs to authored wall cells');}
  f.dispose(n);
 }
});

test('the complete source cap stays below the actual roof underside and meets it while native ridge points stay exact for all saved roofs and elevations',()=>{
 for(const id of ids)for(const rotation of rotations)for(const finish of ['clay','aged','thatch'])for(const base of [0,1.7]){
  const f=fixture(id,rotation);f.b.roofFinish=finish;for(const t of f.input.terrain.tiles)t.elevation=base;const n=f.build(),height=n.userData.height,cap=base+height+1/V,edges=n.getObjectByName(`building-roof-edges:${f.b.id}`),profile=getBuildingProfile(f.b),rise=Math.min(profile.roofRise/V,Math.max(.4,f.frame.width*.28)),inset=Math.min(f.frame.width*.44,f.frame.depth*.3);let minimum=Infinity;
  for(const p of capSamples(f,cap)){const hit=new Raycaster(p.clone().add(new Vector3(0,-.3,0)),new Vector3(0,1,0),0,2).intersectObject(edges,true)[0];assert.equal(hit?.object.material.name,'world:darkwood',`${id} ${rotation} ${finish} ${base}: source cap ${p.toArray()} must be covered by real timber roofing`);const clearance=hit.point.y-cap;assert.ok(clearance>=-2e-5,`${id} ${rotation} ${finish}: cap penetrates actual underside by ${clearance}`);minimum=Math.min(minimum,clearance);}
  assert.ok(Math.abs(minimum)<2e-5,'the supported cap must meet the real underside');const fabric=n.getObjectByName(`building-fabric:${f.b.id}`),roof=fabric.children.find(m=>m.material.name===`world:${finish}`),p=vertices(roof);for(const v of [inset,f.frame.depth-inset])assert.ok(p.some(p=>p.distanceTo(f.point(f.frame.width*.5,v,base+height+rise))<2e-5),'ridge position must remain native');
  for(const mesh of [roof,...edges.children]){for(const [name,a]of Object.entries(mesh.geometry.attributes))for(const x of a.array)assert.ok(Number.isFinite(x),`${name} remains finite`);}
  f.dispose(n);
 }
});

test('ordinary camera rays cannot see the far cornice cap through the repaired roof and slope-local texture density remains metric',()=>{
 for(const id of ids)for(const rotation of rotations)for(const finish of ['clay','aged','thatch']){
  const f=fixture(id,rotation);f.b.roofFinish=finish;const n=f.build(),top=n.userData.height+1/V;
  for(const [u,v,out]of [[f.frame.width*.5,-.21,new Vector3(-f.frame.v.x,0,-f.frame.v.y)],[f.frame.width*.5,f.frame.depth+.21,new Vector3(f.frame.v.x,0,f.frame.v.y)],[-.21,f.frame.depth*.5,new Vector3(-f.frame.u.x,0,-f.frame.u.y)],[f.frame.width+.21,f.frame.depth*.5,new Vector3(f.frame.u.x,0,f.frame.u.y)]])if(out.dot(camera)<0){const p=f.point(u,v,Math.fround(top));p.x=Math.fround(p.x);p.z=Math.fround(p.z);p.addScaledVector(out,-1e-5);const hit=new Raycaster(p.clone().addScaledVector(camera,20),camera.clone().negate(),0,21).intersectObject(n,true)[0];assert.notEqual(hit?.object.material.name,'world:civic-band-plaster-coping','the physical roof must occlude its far cap');assert.ok(hit);}
  const fabric=n.getObjectByName(`building-fabric:${f.b.id}`),roof=fabric.children.find(m=>m.material.name===`world:${finish}`),pos=roof.geometry.attributes.position,uv=roof.geometry.attributes.uv,index=roof.geometry.index?.array;
  for(let i=0;i<(index?.length??pos.count);i+=3){const indices=[0,1,2].map(j=>index?index[i+j]:i+j),points=indices.map(k=>new Vector3(pos.getX(k),pos.getY(k),pos.getZ(k)));for(const [a,b]of [[0,1],[1,2],[2,0]]){const distance=points[a].distanceTo(points[b]),texture=Math.hypot(uv.getX(indices[a])-uv.getX(indices[b]),uv.getY(indices[a])-uv.getY(indices[b]));assert.ok(Math.abs(distance-texture)<4e-5,'roof UVs must use complete metres on the actual repaired plane');}}
  f.dispose(n);
 }
});

test('real openings, short roofs, usable roof routes, edited corner fallbacks, legacy shells and ordinary disclosure keep their existing admission',()=>{
 for(const id of ids)for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(id,rotation,'exterior',roof),n=f.build();assert.equal(civicCorniceRoofJoin(f.b,f.input,n.userData.height,buildingArtInset(f.b,f.input),false),undefined);assert.ok(!f.bands(n).children.some(m=>m.material.name==='world:civic-band-plaster-coping'));f.dispose(n);}
  for(const type of ['door','window','rubble']){const f=fixture(id,rotation),cell=f.frame.at(0,0);f.input.terrain.tiles.find(t=>t.x===cell.x&&t.y===cell.y).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(t=>t!==f.frame.door)];const n=f.build();assert.equal(civicCorniceRoofJoin(f.b,f.input,n.userData.height,buildingArtInset(f.b,f.input),false),undefined);f.dispose(n);}
  for(const view of ['partial','interior']){const f=fixture(id,rotation,view),n=f.build();assert.ok(f.input.revealedRooms.length);assert.equal(Boolean(f.bands(n)?.children.some(m=>m.material.name==='world:civic-band-plaster-coping')),false);f.dispose(n);}
  const f=fixture(id,rotation),n=f.build();for(const t of f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id&&['door','window'].includes(t.type))){const point=new Vector3(t.x*T,1.8,t.y*T),out=t.x===f.b.x?new Vector3(-1,0,0):t.x===f.b.x+f.b.width-1?new Vector3(1,0,0):t.y===f.b.y?new Vector3(0,0,-1):new Vector3(0,0,1);for(const y of [1,1.3,1.9]){point.y=y;assert.equal(new Raycaster(point.clone().addScaledVector(out,T),out.clone().negate(),0,T*1.6).intersectObject(f.bands(n),true).length,0,'the cornice cannot conceal a complete standing door or window');}}
  const old={...f.b,wallFinish:undefined};assert.equal(civicCorniceRoofJoin(old,f.input,n.userData.height,0,true),undefined);for(const height of [NaN,Infinity,-1,3.99])assert.equal(civicCorniceRoofJoin(f.b,f.input,height,0,false),undefined);f.dispose(n);
 }
 for(const id of ['casa','posta','barraca','iglesia','capilla','cabildo','pulperia','almacen','deposito','estancia','herreria','caballeriza']){const f=fixture(id,0);assert.equal(civicCorniceRoofJoin(f.b,f.input,5,0,false),undefined);f.g.dispose();f.m.dispose();}
});
