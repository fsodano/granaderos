import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('capilla',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 return {b,input,frame,point,feature:building=>building.getObjectByName(`building-detail:${b.id}:chapel-corner-piers`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function supported(f,node){node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every shaft, foot and capital stays in an intact actual support cell');}});}

test('actual chapel front piers keep their source-sized shaft, foot, exposed capital and physical supports at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),height=building.userData.height,coping=node.children.find(mesh=>mesh.material.name==='world:chapel-pier-coping');assert.ok(node);supported(f,node);assert.ok(coping);
  for(const u of [0,f.frame.width]){
   const sample=u===0?u+.04:u-.04,top=new Raycaster(f.point(sample,-.365,height+2),new Vector3(0,-1,0),0,3).intersectObject(building,true)[0];assert.ok(top?.object===coping,'both capitals must remain readable outside the real roof eave');assert.ok(Math.abs(top.point.y-(height+2.5/V))<1e-5);
   const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),ray=new Raycaster(f.point(sample,-1,1.3),out.clone().negate(),0,2*T),body=ray.intersectObject(node,true)[0],wall=ray.intersectObject(building.getObjectByName(`building-fabric:${f.b.id}`),true)[0];assert.ok(body&&wall);assert.ok(Math.abs(wall.distance-body.distance-(.34*T-.09))<1e-5,'the whole source shaft projects about 33 cm beyond the wall');
  }
  const foot=node.children.find(mesh=>mesh.material.name==='world:stone');assert.ok(Math.abs(new Box3().setFromObject(foot).max.y-getBuildingProfile(f.b).plinthHeight/V)<1e-5);f.dispose(building);
 }
});

test('supported chapel piers leave the complete standing doorway and all current exterior window centres clear',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),node=f.feature(building),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);
  for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(building,true).length,0);}
  for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&tile.type==='window')){const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),start=onX?new Vector3((tile.x+sign)*T,1.3,tile.y*T):new Vector3(tile.x*T,1.3,(tile.y+sign)*T),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(node,true).length,0);}
  f.dispose(building);
 }
});

test('edited chapel front supports remove only their unsupported piers and preserve original corner-opening fallback',()=>{
 for(const rotation of rotations)for(const type of ['rubble','door','window']){
  const f=fixture(rotation),p=f.frame.at(0,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),node=f.feature(building);assert.ok(node,'the other intact corner retains its supported pier');supported(f,node);const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),start=new Vector3(p.x*T,type==='window'?1.3:1.8,p.y*T).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,T*1.6).intersectObject(node,true).length,0);f.dispose(building);
 }
});

function sourcePiers(f){
 const parts=[];const visit=node=>{if(!node)return;if(Array.isArray(node)){for(const child of node)visit(child);return;}if(node.type===ArchitectureVolume&&String(node.props.label).startsWith('chapel-corner-'))parts.push(node.props);visit(node.props?.children);};
 for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);
 assert.equal(parts.length,6,'the direct visible chapel has two source shaft/foot/capital sets');return parts;
}

test('chapel pier bodies keep the current sprite plaster exception, separate warm stone feet and local coping for every authored pigment',()=>{
 for(const finish of ['adobe','limewash','ochre','stone','brick']){
  const sourceFixture=fixture(0);sourceFixture.b.wallFinish=finish;const source=sourcePiers(sourceFixture),shaft=source.find(part=>part.label.endsWith('-shaft')),foot=source.find(part=>part.label.endsWith('-base')),capital=source.find(part=>part.label.endsWith('-capital'));assert.equal(shaft.texture,'plaster');assert.equal(foot.texture,'stone');
  for(const rotation of rotations){const f=fixture(rotation);f.b.wallFinish=finish;const building=f.build(),node=f.feature(building),body=node.children.find(mesh=>mesh.material.name===`world:${finish}`&&mesh.material.color.getHexString()===shaft.palette.base.slice(1)),base=node.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()===foot.palette.base.slice(1));assert.ok(body&&base);assert.notEqual(body.material,base.material);assert.equal(body.material.userData.architectureFinish.textureOpacity,.36);assert.equal(body.material.userData.architectureFinish.texture,'/art/architecture-plaster-v2.png');assert.equal(body.material.userData.architectureFinish.multiplyOpacity,0);assert.equal(base.material.userData.architectureFinish.textureOpacity,.60);assert.equal(node.children.find(mesh=>mesh.material.name==='world:chapel-pier-coping').material.color.getHexString(),capital.palette.trim.slice(1));f.dispose(building);}
  sourceFixture.dispose(sourceFixture.build());
 }
});

test('chapel piers respect actual slab heights, usable upper surfaces, legacy selection and normal room disclosure',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),node=f.feature(building);if(roof==='roof-route')assert.equal(Boolean(node),false,'the capital above the roof must not occupy an accessible upper corner');else{assert.ok(node);supported(f,node);assert.ok(Math.abs(new Box3().setFromObject(node).max.y-building.userData.height-2.5/V)<1e-5);}f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.ok(Math.abs(new Box3().setFromObject(short.feature(shortBuilding)).max.y-1.8-2.5/V)<1e-5);short.dispose(shortBuilding);
  for(const blocked of [false,true]){const f=fixture(rotation),corners=[f.frame.at(0,0),f.frame.at(f.frame.width,0)];f.input.terrain.upperSurfaces=corners.map(p=>({...p,tacticalLevel:1,elevation:2.2,blocked,kind:'platform',buildingId:f.b.id,type:'floor'}));const building=f.build();assert.equal(Boolean(f.feature(building)),blocked);f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
  const legacy=fixture(rotation);legacy.b.architecture='chapel';legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const building=legacy.build();assert.equal(Boolean(legacy.feature(building)),false);legacy.dispose(building);
 }
});
