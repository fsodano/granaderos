import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('caballeriza',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 const local=p=>({u:(p.x/T-frame.origin.x)*frame.u.x+(p.z/T-frame.origin.y)*frame.u.y,v:(p.x/T-frame.origin.x)*frame.v.x+(p.z/T-frame.origin.y)*frame.v.y,y:p.y});
 return {b,input,frame,point,local,feature:(building,name='stable-timber-frame')=>building.getObjectByName(`building-detail:${b.id}:${name}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function vertices(f,node){const points=[];node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)points.push(f.local(new Vector3(p.getX(n),p.getY(n),p.getZ(n))));}});return points;}
function supported(f,node){node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every low timber vertex must remain in an actual intact wall cell');}});}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<2e-5,`${actual} vs ${expected}`);

test('the actual stable has exposed source-sized front posts, source ties and a real timber header at every rotation',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),posts=f.feature(building,'stable-posts-and-ties'),header=f.feature(building,'stable-timber-header'),height=building.userData.height,top=height*.89;assert.ok(node&&posts&&header);near(new Box3().setFromObject(node).max.y,top);supported(f,posts);
  const points=vertices(f,posts);for(const u of [0,2,6])for(const a of [-.095,.095])for(const v of [-.30,.12])for(const y of [0,top])assert.ok(points.some(p=>Math.abs(p.u-u-a)<2e-5&&Math.abs(p.v-v)<2e-5&&Math.abs(p.y-y)<2e-5),'all three supported posts keep the complete source box');
  const hp=vertices(f,header);near(Math.min(...hp.map(p=>p.u)),.02);near(Math.max(...hp.map(p=>p.u)),f.frame.width-.02);near(Math.min(...hp.map(p=>p.v)),-.28);near(Math.max(...hp.map(p=>p.v)),.10);near(Math.min(...hp.map(p=>p.y)),top-4/V);near(Math.max(...hp.map(p=>p.y)),top);assert.ok(header.children.every(mesh=>mesh.material.name==='world:wood'&&mesh.material.userData.architectureFinish===undefined),'keep the shared timber finish');
  const fabric=building.getObjectByName(`building-fabric:${f.b.id}`),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);
  for(const u of [0,2,6]){const ray=new Raycaster(f.point(u+(u===0?.04:0),-1,1.3),out.clone().negate(),0,2*T),postHit=ray.intersectObject(posts,true)[0],wallHit=ray.intersectObject(fabric,true)[0];assert.ok(postHit&&wallHit);near(wallHit.distance-postHit.distance,.30*T-.09);}
  const tieY=top-7.5/V,tieRay=new Raycaster(f.point(2.3,-1,tieY),out.clone().negate(),0,2*T),tieHit=tieRay.intersectObject(posts,true)[0];assert.ok(tieHit);assert.ok(tieHit.distance<.69*T,'the diagonal tie must remain in front of the actual wall');f.dispose(building);
 }
});

test('edited stable windows, doors and breached post cells lose only unsupported low members and keep standing apertures',()=>{
 for(const rotation of rotations)for(const u of [0,2,6])for(const type of ['window','door','rubble']){
  const f=fixture(rotation),p=f.frame.at(u,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),posts=f.feature(building,'stable-posts-and-ties');assert.ok(posts);supported(f,posts);const origin=f.point(u,-1,1.3),direction=new Vector3(f.frame.v.x,0,f.frame.v.y);assert.equal(new Raycaster(origin,direction,0,2*T).intersectObject(f.feature(building),true).length,0,'the changed opening must retain its clear low span');f.dispose(building);
 }
 for(const rotation of rotations){const f=fixture(rotation);f.frame.door.open=true;const building=f.build();for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,new Vector3(f.frame.v.x,0,f.frame.v.y),0,2*T).intersectObject(building,true).length,0,'a full standing body must cross the original entrance');}f.dispose(building);}
});

test('stable ground members stay below real roofs, omit low upper routes and follow ordinary cutaways',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),node=f.feature(building);assert.ok(node);assert.ok(new Box3().setFromObject(node).max.y<building.userData.height-.05);f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.equal(Boolean(short.feature(shortBuilding,'stable-timber-header')),false,'omit a header that cannot clear the shortened standing door');assert.ok(new Box3().setFromObject(short.feature(shortBuilding)).max.y<1.8);short.dispose(shortBuilding);
  for(const blocked of [true,false]){const f=fixture(rotation),supports=[0,2,6].map(u=>f.frame.at(u,0));f.input.terrain.upperSurfaces=supports.map(p=>({...p,kind:'platform',type:'floor',tacticalLevel:1,elevation:2.2,blocked,buildingId:f.b.id}));const building=f.build(),node=f.feature(building);assert.ok(node);assert.equal(node.children.length>0,blocked,'only a usable overlapping low surface excludes the frame');f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
 }
});

test('the stable exposure remains authored-only while unpainted legacy frames keep their released placement and finish',()=>{
 for(const rotation of rotations){const f=fixture(rotation);f.b.architecture='stable';f.b.kind=undefined;f.b.wallFinish=undefined;const building=f.build(),node=f.feature(building);assert.ok(node);assert.equal(buildingArtInset(f.b,f.input),.4);assert.equal(Boolean(f.feature(building,'stable-posts-and-ties')),false);assert.equal(Boolean(f.feature(building,'stable-timber-header')),false);near(new Box3().setFromObject(node).max.y,building.userData.height*.91+.07);assert.ok(node.children.every(mesh=>mesh.material.name==='world:wood'));f.dispose(building);}
});
