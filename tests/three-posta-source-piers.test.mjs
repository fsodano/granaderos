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
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('posta',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 return {b,input,frame,point,feature(building){const node=building.getObjectByName(`building-detail:${b.id}:posta-corner-piers`);return node?.children.length?node:undefined;},build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function supported(f,node){node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','all parts stay inside an intact actual wall cell');}});}
function sourcePiers(f){
 const parts=[];const visit=node=>{if(!node)return;if(Array.isArray(node)){for(const child of node)visit(child);return;}if(node.type===ArchitectureVolume&&String(node.props.label).startsWith('posta-pier-'))parts.push(node.props);visit(node.props?.children);};
 for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);
 assert.equal(parts.length,6,'the actual direct posta has two source shaft, foot and capital sets');return parts;
}
function frameBounds(f,mesh,maxY=Infinity){const p=mesh.geometry.getAttribute('position'),origin=f.frame.at(0,0),bounds={u0:Infinity,u1:-Infinity,v0:Infinity,v1:-Infinity};for(let n=0;n<p.count;n++){if(p.getY(n)>maxY)continue;const x=p.getX(n)/T-origin.x,y=p.getZ(n)/T-origin.y,u=x*f.frame.u.x+y*f.frame.u.y,v=x*f.frame.v.x+y*f.frame.v.y;bounds.u0=Math.min(bounds.u0,u);bounds.u1=Math.max(bounds.u1,u);bounds.v0=Math.min(bounds.v0,v);bounds.v1=Math.max(bounds.v1,v);}return bounds;}

test('actual posta shafts, warm stone feet and capitals match the current source planes with exposed coping at four rotations',()=>{
 const sourceFixture=fixture(0),source=sourcePiers(sourceFixture),origin=sourceFixture.frame.at(0,0),sourceBounds=part=>{const vs=part.points.map(p=>(p.x-origin.x)*sourceFixture.frame.v.x+(p.y-origin.y)*sourceFixture.frame.v.y);return {v0:Math.min(...vs),v1:Math.max(...vs)};};
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),height=building.userData.height,body=node.children.find(mesh=>mesh.material.name==='world:ochre'),foot=node.children.find(mesh=>mesh.material.name==='world:stone'),coping=node.children.find(mesh=>mesh.material.name==='world:posta-pier-coping');assert.ok(body&&foot&&coping);supported(f,node);
  for(const [mesh,label]of [[body,'shaft'],[foot,'base'],[coping,'capital']]){const native=frameBounds(f,mesh,label==='shaft'?height-7/V:Infinity),direct=sourceBounds(source.find(part=>part.label.endsWith('-'+label)));assert.ok(Math.abs(native.v0-direct.v0)<1e-5&&Math.abs(native.v1-direct.v1)<1e-5,'the local front/back planes must match the actual current sprite');}
  assert.ok(Math.abs(new Box3().setFromObject(foot).max.y-getBuildingProfile(f.b).plinthHeight/V)<1e-5);
  for(const u of [0,f.frame.width]){const ray=new Raycaster(f.point(u,-.365,height+2),new Vector3(0,-1,0),0,4),top=ray.intersectObject(building,true)[0];assert.equal(top?.object,coping,'both capitals remain visible beyond the main hip eave');assert.ok(Math.abs(top.point.y-(height-1.5/V))<1e-5);const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),standing=new Raycaster(f.point(u,-1,1.3),out.clone().negate(),0,2*T),post=standing.intersectObject(node,true)[0],wall=standing.intersectObject(building.getObjectByName(`building-fabric:${f.b.id}`),true)[0];assert.ok(post&&wall);assert.ok(Math.abs(wall.distance-post.distance-(.34*T-.09))<1e-5,'the source shaft exposes 33 cm rather than the previous enlarged front plane');}
  f.dispose(building);
 }
 sourceFixture.dispose(sourceFixture.build());
});

test('posta piers preserve the full standing doorway and every exterior window centre through rotation',()=>{
 for(const rotation of rotations){const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),node=f.feature(building),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(building,true).length,0);}for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&tile.type==='window')){const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),start=onX?new Vector3((tile.x+sign)*T,1.3,tile.y*T):new Vector3(tile.x*T,1.3,(tile.y+sign)*T),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(node,true).length,0);}f.dispose(building);}
});

test('edited posta corner supports preserve the previous supported fallback planes and omit unsupported piers',()=>{
 for(const rotation of rotations)for(const type of ['rubble','door','window']){
  const f=fixture(rotation),p=f.frame.at(0,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),node=f.feature(building);assert.ok(node);supported(f,node);const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),start=new Vector3(p.x*T,type==='window'?1.3:1.8,p.y*T).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,T*1.6).intersectObject(node,true).length,0);
  if(type!=='rubble'){const body=node.children.find(mesh=>mesh.material.name==='world:ochre'),bounds=frameBounds(f,body,building.userData.height-7/V),shift=.4*(f.frame.v.x+f.frame.v.y)-(.4-.245)*(f.frame.v.x+f.frame.v.y);assert.ok(Math.abs(bounds.v0-(shift-.245))<1e-5&&Math.abs(bounds.v1-(shift+.245))<1e-5,'an edited corner opening retains the released fallback body plane');}
  f.dispose(building);
 }
});

test('posta local plaster, warm stone and coping keep the current source recipe for all authored pigments',()=>{
 for(const finish of ['adobe','limewash','ochre','stone','brick']){
  const sourceFixture=fixture(0);sourceFixture.b.wallFinish=finish;const source=sourcePiers(sourceFixture),shaft=source.find(part=>part.label.endsWith('-shaft')),foot=source.find(part=>part.label.endsWith('-base')),capital=source.find(part=>part.label.endsWith('-capital'));assert.equal(shaft.texture,'plaster');assert.equal(foot.texture,'stone');
  for(const rotation of rotations){const f=fixture(rotation);f.b.wallFinish=finish;const building=f.build(),node=f.feature(building),body=node.children.find(mesh=>mesh.material.name===`world:${finish}`&&mesh.material.color.getHexString()===shaft.palette.base.slice(1)),base=node.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()===foot.palette.base.slice(1));assert.ok(body&&base);assert.notEqual(body.material,base.material);assert.equal(body.material.userData.architectureFinish.textureOpacity,.36);assert.equal(body.material.userData.architectureFinish.texture,'/art/architecture-plaster-v2.png');assert.equal(body.material.userData.architectureFinish.multiplyOpacity,0);assert.equal(base.material.userData.architectureFinish.textureOpacity,.60);assert.equal(node.children.find(mesh=>mesh.material.name==='world:posta-pier-coping').material.color.getHexString(),capital.palette.trim.slice(1));f.dispose(building);}sourceFixture.dispose(sourceFixture.build());
 }
});

test('posta local piers follow real slabs, usable upper levels and room disclosure while preserving unpainted legacy geometry',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),node=f.feature(building);assert.ok(node);supported(f,node);assert.ok(Math.abs(new Box3().setFromObject(node).max.y-(building.userData.height-1.5/V))<1e-5);f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.ok(Math.abs(new Box3().setFromObject(short.feature(shortBuilding)).max.y-(1.8-1.5/V))<1e-5);short.dispose(shortBuilding);
  for(const blocked of [false,true]){const f=fixture(rotation),corners=[f.frame.at(0,0),f.frame.at(f.frame.width,0)];f.input.terrain.upperSurfaces=corners.map(p=>({...p,tacticalLevel:1,elevation:2.2,blocked,kind:'platform',buildingId:f.b.id,type:'floor'}));const building=f.build();assert.equal(Boolean(f.feature(building)),blocked);f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
  const legacy=fixture(rotation);legacy.b.architecture='posta';legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const building=legacy.build(),node=legacy.feature(building),body=node.children.find(mesh=>mesh.material.name!=='world:stone'&&mesh.material.name!=='world:trim'),bounds=frameBounds(legacy,body);assert.ok(Math.abs(bounds.v0+.445)<1e-5&&Math.abs(bounds.v1-.13)<1e-5,'the unpainted legacy retains its prior enlarged shaft and capital planes');assert.ok(node.children.some(mesh=>mesh.material.name==='world:trim'));assert.equal(node.children.find(mesh=>mesh.material.name==='world:stone').material.userData.architectureFinish,undefined);legacy.dispose(building);
 }
});

test('the local posta pier materials retain metre texture spacing and ordinary day and night vertex light',()=>{
 for(const rotation of rotations)for(const night of [false,true]){const f=fixture(rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),node=f.feature(building),expected=night?.27+.73*.5:1;for(const mesh of node.children){const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),colour=mesh.geometry.getAttribute('color'),normal=mesh.geometry.getAttribute('normal');let vertical=0;for(let n=0;n<p.count;n++){for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(colour[channel](n)-expected)<1e-6);if(n%3===0&&Math.abs(normal.getY(n))<.5)for(const next of [n+1,n+2])if(Math.abs(p.getY(n)-p.getY(next))>.10){assert.ok(Math.abs(Math.abs(uv.getY(n)-uv.getY(next))-Math.abs(p.getY(n)-p.getY(next)))<1e-5);vertical++;}}if(mesh.material.name!=='world:posta-pier-coping')assert.ok(vertical>0);}f.dispose(building);}
});
