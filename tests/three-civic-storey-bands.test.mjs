import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270],ids=['ayuntamiento','palacio'];
function fixture(id,rotation,view='exterior',roof='original'){
 const s=createArchitectureReviewBattle(id,rotation,view,roof),b=s.buildings[0],frame=entranceFrame({...b,walls:s.tiles}),input={terrain:{width:s.width,height:s.height,tiles:s.tiles,buildings:s.buildings,upperSurfaces:s.upperSurfaces},revealedRooms:s.revealedRooms},g=new WorldGeometry(),m=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
 return {b,frame,input,geometry:g,materials:m,kind:id==='palacio'?'palace':'townhall',build(){const before=JSON.stringify(input),n=buildBuilding(b,input,T,g,m);n.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before,'bands may not modify authored movement, openings or disclosure');return n;},band(n){return n.getObjectByName(`building-detail:${b.id}:${this.kind}-storey-bands`);},point(u,v,y){const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);},dispose(n){disposeWorldNode(n);g.dispose();m.dispose();}};
}
function source(f){const parts=[];const visit=(e,label)=>{if(!e)return;if(Array.isArray(e)){e.forEach(n=>visit(n,label));return;}const band=e.props?.['data-storey-band']??label;if(e.type===ArchitectureVolume&&band)parts.push({...e.props,side:band});visit(e.props?.children,band);};for(const o of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(o.node);assert.equal(parts.length,4,'actual source has two visible facades, each with two stone band stages');return parts;}
function points(mesh){const p=mesh.geometry.getAttribute('position');return Array.from({length:p.count},(_,i)=>new Vector3(p.getX(i),p.getY(i),p.getZ(i)));}
function assertSourceCorners(node,part,material){const vertices=points(node.children.find(m=>m.material.name===material&&m.material.color.getHexString()===part.palette.base.slice(1)&&m.material.userData.architectureFinish?.texture.endsWith(`-${part.texture}-v2.png`)));for(const y of [part.bottom/V,part.top/V])for(const p of part.points){const target=new Vector3(p.x*T,y,p.y*T);assert.ok(vertices.some(v=>v.distanceTo(target)<2e-5),`${material}: missing actual source corner ${target.toArray()}`);}}
function doorCrossings(f,n){for(const tile of f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id&&t.type==='door')){const onY=tile.y===f.b.y||tile.y===f.b.y+f.b.height-1,sign=onY?(tile.y===f.b.y?-1:1):(tile.x===f.b.x?-1:1);for(const off of [-.20,0,.20])for(const y of [1.3,1.8,1.90]){const start=onY?new Vector3(tile.x*T+off,y,(tile.y+sign)*T):new Vector3((tile.x+sign)*T,y,tile.y*T+off),dir=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);assert.equal(new Raycaster(start,dir,0,T*1.6).intersectObject(f.band(n),true).length,0,'the source bands may not cover the complete standing doorway');}}}
function windowApproaches(f,n){for(const tile of f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id&&t.type==='window')){const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1);for(const off of [-.20,0,.20])for(const y of [1.0,1.3,1.8]){const start=onX?new Vector3((tile.x+sign)*T,y,tile.y*T+off):new Vector3(tile.x*T+off,y,(tile.y+sign)*T),dir=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);assert.equal(new Raycaster(start,dir,0,T*1.6).intersectObject(f.band(n),true).length,0,'a band may not conceal the existing window aperture');}}}

test('both civic facades retain the actual source two-step band corners, warm stone recipe and flat coping at four rotations',()=>{
 for(const id of ids)for(const rotation of rotations)for(const finish of ['adobe','limewash','ochre','stone','brick']){
  const f=fixture(id,rotation);f.b.wallFinish=finish;const direct=source(f),n=f.build(),band=f.band(n);assert.ok(band);
  for(const part of direct){const stone=part.texture==='stone',meshName=stone?'world:stone':`world:${finish}`;assertSourceCorners(band,part,meshName);const mesh=band.children.find(m=>m.material.name===meshName&&m.material.color.getHexString()===part.palette.base.slice(1)&&m.material.userData.architectureFinish?.texture.endsWith(`-${part.texture}-v2.png`));assert.equal(mesh.material.color.getHexString(),part.palette.base.slice(1));assert.equal(mesh.material.userData.architectureFinish.textureOpacity,stone?.60:.36);assert.equal(mesh.material.userData.architectureFinish.multiplyOpacity,0);if(part.cap!==false){const cap=band.children.find(m=>m.material.name===`world:civic-band-${stone?'stone':'plaster'}-coping`);assert.equal(cap.material.color.getHexString(),part.palette.trim.slice(1));const p=points(cap);for(const corner of part.points)assert.ok(p.some(point=>point.distanceTo(new Vector3(corner.x*T,part.top/V,corner.y*T))<2e-5));}}
  f.dispose(n);
 }
});

test('stepped faces are exposed at their actual planes, preserve metric masonry UVs and retain ordinary day and night illumination',()=>{
 for(const id of ids)for(const rotation of rotations)for(const night of [false,true]){
  const f=fixture(id,rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const n=f.build(),band=f.band(n),profile=getBuildingProfile(f.b),storey=n.userData.height*profile.groundFloorHeight/profile.wallHeight,out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),u=f.frame.width*.25;
  for(const [y,v,name]of [[storey,-.22,'world:stone'],[storey+4.5/V,-.30,'world:stone']]){const hit=new Raycaster(f.point(u,-1,y),out.clone().negate(),0,T*2).intersectObject(band,true)[0];assert.equal(hit?.object.material.name,name);const projected=hit.point.clone().sub(f.point(u,0,y)).dot(out);assert.ok(Math.abs(projected+v*T)<2e-5,'the complete source stage must stand in front of the real wall');}
  for(const mesh of band.children){const p=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv'),c=mesh.geometry.getAttribute('color');for(let i=0;i<p.count;i++){const expected=night?.27+.73*.5:1;assert.ok(Math.abs(c.getX(i)-expected)<1e-6);if(mesh.material.userData.architectureFinish){const expectedUV=Math.abs(normal.getY(i))>.5?[p.getX(i),p.getZ(i)]:Math.abs(normal.getX(i))>Math.abs(normal.getZ(i))?[p.getZ(i)*(normal.getX(i)>0?-1:1),p.getY(i)]:[p.getX(i)*(normal.getZ(i)>0?1:-1),p.getY(i)];assert.ok(Math.abs(uv.getX(i)-expectedUV[0])<2e-5&&Math.abs(uv.getY(i)-expectedUV[1])<2e-5);}}}
  f.dispose(n);
 }
});

test('actual door and window approaches remain clear at four rotations through original, closed slab, terrace and roof-route states',()=>{
 for(const id of ids)for(const rotation of rotations)for(const roof of ['original','slab','terrace','roof-route']){
  const f=fixture(id,rotation,'exterior',roof);for(const t of f.input.terrain.tiles)if(t.type==='door')t.open=true;const n=f.build();assert.ok(f.band(n));doorCrossings(f,n);windowApproaches(f,n);f.dispose(n);
 }
});

test('usable upper cells omit only their occupied band parts while blocked supports keep the source profile',()=>{
 for(const id of ids)for(const rotation of rotations)for(const blocked of [false,true]){
  const f=fixture(id,rotation),profile=getBuildingProfile(f.b),storey=profile.groundFloorHeight/V,u=Math.floor(f.frame.width*.5)-1,p=f.frame.at(u,0);f.input.terrain.upperSurfaces=[{...p,buildingId:f.b.id,tacticalLevel:1,elevation:storey,blocked,kind:'platform',type:'floor'}];const n=f.build(),band=f.band(n),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),hits=new Raycaster(f.point(u,-1,storey+4.5/V),out.clone().negate(),0,T*2).intersectObject(band,true);assert.equal(hits.length>0,blocked,'occupied source cap must leave the actual upper route clear');const adjacent=new Raycaster(f.point(u-1,-1,storey+4.5/V),out.clone().negate(),0,T*2).intersectObject(band,true);assert.ok(adjacent.length,'the neighboring supported band remains');f.dispose(n);
 }
});

test('edited metric heights protect complete apertures and the band joins the actual storey rather than a template roof',()=>{
 for(const id of ids)for(const rotation of rotations)for(const height of [4,4.5,6.2]){
  const f=fixture(id,rotation);for(const t of f.input.terrain.tiles)if(t.type==='door')t.open=true;f.input.terrain.upperSurfaces=f.b.rooms.flatMap(r=>r.cells).map(cell=>({...cell,buildingId:f.b.id,tacticalLevel:1,elevation:height,blocked:true,kind:'roof',type:'floor'}));const n=f.build(),band=f.band(n),profile=getBuildingProfile(f.b),storey=height*profile.groundFloorHeight/profile.wallHeight;assert.ok(band.children.some(mesh=>points(mesh).some(p=>Math.abs(p.y-(storey+5/V))<2e-5)));doorCrossings(f,n);windowApproaches(f,n);f.dispose(n);
 }
});

test('short slabs, edited-corner shells and unpainted legacy retain their original strip while ordinary room disclosure keeps the existing low facade',()=>{
 for(const id of ids)for(const rotation of rotations){
  for(const roof of ['slab','roof-route']){const f=fixture(id,rotation,'exterior',roof),n=f.build(),band=f.band(n);assert.ok(band);assert.equal(band.children.some(mesh=>mesh.material.name==='world:civic-band-stone-coping'),false,'short roof keeps the existing one-storey strip');f.dispose(n);}
  for(const type of ['rubble','door','window']){const f=fixture(id,rotation),p=f.frame.at(0,0);f.input.terrain.tiles.find(t=>t.x===p.x&&t.y===p.y).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(t=>t!==f.frame.door)];const n=f.build();assert.equal(f.band(n).children.some(mesh=>mesh.material.name==='world:civic-band-stone-coping'),false,'edited corner retains its existing inset/fallback facade');f.dispose(n);}
  const legacy=fixture(id,rotation);legacy.b.architecture=legacy.b.kind;legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const old=legacy.build();assert.equal(legacy.band(old).children.some(mesh=>mesh.material.name==='world:civic-band-stone-coping'),false);legacy.dispose(old);
  for(const view of ['partial','interior']){const f=fixture(id,rotation,view),n=f.build(),band=f.band(n);assert.equal(band?.children.some(mesh=>mesh.material.name==='world:civic-band-stone-coping')??false,false,'disclosed ground rooms must not regain a full upper facade');f.dispose(n);}
 }
});


test('the released upper eave trim keeps its exact altitude, projection and authored material',()=>{
 for(const id of ids)for(const rotation of rotations){
  const f=fixture(id,rotation),n=f.build(),band=f.band(n),trim=band.children.find(m=>m.material.name==='world:trim'),p=points(trim),height=n.userData.height;
  assert.equal(trim.material.color.getHexString(),'e0d2ad');
  const corners=[];for(const v of [0,f.frame.depth])for(const u of [-.10/T,f.frame.width+.10/T])for(const d of [-.145/T,.145/T])for(const y of [height-.175,height-.025])corners.push(f.point(u,v+(v===0?-.10:.10)/T+d,y));
  for(const u of [0,f.frame.width])for(const v of [0,f.frame.depth])for(const d of [-.145/T,.145/T])for(const y of [height-.175,height-.025])corners.push(f.point(u+(u===0?-.10:.10)/T+d,v,y));
  assert.equal(p.length,144,'the four released trim boxes remain complete');for(const c of corners)assert.ok(p.some(v=>v.distanceTo(c)<2e-5));for(const v of p)assert.ok(corners.some(c=>v.distanceTo(c)<2e-5),'the retained eave trim cannot gain an exposed roof cap');
  f.dispose(n);
 }
});
