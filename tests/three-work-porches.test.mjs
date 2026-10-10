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
const {ProjectedRoofSurface}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270],ids=['pulperia','herreria','deposito'];
const names={pulperia:'gallery',herreria:'forge-canopy',deposito:'gallery'};
function fixture(id,rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 return {b,input,frame,point,feature:building=>building.getObjectByName(`building-detail:${b.id}:${names[id]}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function supports(f){
 if(f.b.kind==='depot')return [2,6,10];const radius=f.b.kind==='pulperia'?2:1.25,lo=Math.max(.15,f.frame.doorU-radius),hi=Math.min(f.frame.width-.15,f.frame.doorU+radius);return Array.from({length:Math.ceil(hi-lo)},(_,n)=>Math.round(lo)+n).filter(u=>{const p=f.frame.at(u,0);return u<=hi&&f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y)?.type==='wall'&&!(u>lo+.7&&u<hi-.7&&u%2);});
}
function supported(f,node){node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)if(p.getY(n)<1.9)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every low shaft, foot and brace remains in an intact actual wall cell');}});}
function sourceRoof(f){let source;const visit=node=>{if(!node)return;if(Array.isArray(node)){for(const child of node)visit(child);return;}if(node.type===ProjectedRoofSurface&&String(node.props.id).includes(f.b.kind==='depot'?'depot-loading':f.b.kind==='smithy'?'forge':'shop-porch'))source=node.props;visit(node.props?.children);};for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);assert.ok(source);return source;}

test('source shop, forge and depot roof plans remain distinct, closed and exposed at all four actual rotations',()=>{
 for(const id of ids){const reference=fixture(id,0),source=sourceRoof(reference),sourceUs=source.points.map(p=>(p.x-reference.frame.origin.x)*reference.frame.u.x+(p.y-reference.frame.origin.y)*reference.frame.u.y),sourceVs=source.points.map(p=>(p.x-reference.frame.origin.x)*reference.frame.v.x+(p.y-reference.frame.origin.y)*reference.frame.v.y);
  for(const rotation of rotations){const f=fixture(id,rotation),building=f.build(),node=f.feature(building);assert.ok(node);assert.ok(node.getObjectByName(`building-roof-edges:${f.b.id}:${names[id]}`));supported(f,node);const roof=node.children.find(mesh=>mesh.material?.name===`world:${f.b.roofFinish}`),p=roof.geometry.getAttribute('position'),us=[],vs=[];for(let n=0;n<p.count;n++){const x=p.getX(n)/T-f.frame.origin.x,z=p.getZ(n)/T-f.frame.origin.y;us.push(x*f.frame.u.x+z*f.frame.u.y);vs.push(x*f.frame.v.x+z*f.frame.v.y);}for(const [actual,expected]of [[Math.min(...us),Math.min(...sourceUs)],[Math.max(...us),Math.max(...sourceUs)],[Math.min(...vs),Math.min(...sourceVs)],[Math.max(...vs),Math.max(...sourceVs)]])assert.ok(Math.abs(actual-expected)<1e-5,'roof plan follows the actual direct source, rather than a common oversized canopy');
   const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const u of supports(f)){const ray=new Raycaster(f.point(u,-1,1.3),out.clone().negate(),0,2*T),post=ray.intersectObject(node,true)[0],wall=ray.intersectObject(building.getObjectByName(`building-fabric:${f.b.id}`),true)[0];assert.ok(post&&wall);assert.equal(post.object.material.name,'world:wood');assert.ok(Math.abs(wall.distance-post.distance-((id==='deposito'?.38:.39)*T-.09))<1e-5);}f.dispose(building);
  }reference.dispose(reference.build());
 }
});

test('new source porch frames clear every standing exterior door and actual window at four rotations',()=>{
 for(const id of ids)for(const rotation of rotations){const f=fixture(id,rotation);for(const tile of f.input.terrain.tiles)if(tile.type==='door')tile.open=true;const building=f.build(),node=f.feature(building);for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&['door','window'].includes(tile.type))){const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);for(const offset of [-.20,0,.20])for(const y of tile.type==='door'?[1.3,1.8]:[1.3]){const start=onX?new Vector3((tile.x+sign)*T,y,tile.y*T+offset):new Vector3(tile.x*T+offset,y,(tile.y+sign)*T);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(node,true).length,0);}}f.dispose(building);}
});

test('source posts and braces omit edited supports while intact-corner fallbacks leave authored openings clear',()=>{
 for(const id of ids)for(const rotation of rotations)for(const corner of [false,true])for(const type of ['rubble','door','window']){const f=fixture(id,rotation),p=f.frame.at(corner?0:supports(f)[0],0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),node=f.feature(building);if(node){supported(f,node);const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),start=new Vector3(p.x*T,type==='window'?1.3:1.8,p.y*T).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,T*1.6).intersectObject(node,true).length,0);}f.dispose(building);}
});

test('depot loading feet have the source warm stone finish and real three-post spacing',()=>{
 for(const rotation of rotations){const f=fixture('deposito',rotation),building=f.build(),node=f.feature(building),foot=node.children.find(mesh=>mesh.material.name==='world:stone');assert.ok(foot);assert.equal(foot.material.color.getHexString(),'a99a79');assert.equal(foot.material.userData.architectureFinish.textureOpacity,.60);assert.ok(Math.abs(new Box3().setFromObject(foot).max.y-getBuildingProfile(f.b).plinthHeight/V)<1e-5);supported(f,node);f.dispose(building);}
 for(const id of ['pulperia','herreria']){const f=fixture(id,0),building=f.build();assert.ok(f.feature(building).children.every(mesh=>mesh.material?.name!=='world:stone'),'the source generic timber porch has no invented stone feet');f.dispose(building);}
});

test('source porches retain standing fascia clearance and follow actual flat roofs, upper routes, disclosure and legacy appearance',()=>{
 for(const id of ids)for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(id,rotation,'exterior',roof),building=f.build(),node=f.feature(building);assert.ok(node);assert.ok(new Box3().setFromObject(node).max.y<building.userData.height-.01,'a closed shallow roof remains below the actual upper walking plane');supported(f,node);f.dispose(building);}
  const short=fixture(id,rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.equal(Boolean(short.feature(shortBuilding)),false);short.dispose(shortBuilding);
  for(const blocked of [false,true]){const f=fixture(id,rotation),p=f.frame.at(f.frame.doorU,0);f.input.terrain.upperSurfaces=[{...p,tacticalLevel:1,elevation:2.05,blocked,kind:'platform',buildingId:f.b.id,type:'floor'}];const building=f.build();assert.equal(Boolean(f.feature(building)),blocked);f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(id,rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
  const legacy=fixture(id,rotation);legacy.b.architecture=legacy.b.kind;legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const building=legacy.build();assert.equal(Boolean(building.getObjectByName(`building-work-porch:${legacy.b.id}`)),false);assert.ok(legacy.feature(building));legacy.dispose(building);
 }
});

test('the source generic thatch exception affects only shop and forge porches while depot retains its explicit roof finish',()=>{
 for(const id of ids)for(const rotation of rotations)for(const finish of ['clay','aged','thatch']){const f=fixture(id,rotation);f.b.roofFinish=finish;const building=f.build(),node=f.feature(building),expected=id!=='deposito'&&finish==='thatch'?'clay':finish;assert.ok(node.children.some(mesh=>mesh.material?.name===`world:${expected}`));f.dispose(building);}
});

test('source porch roof courses retain physical metre spacing and normal illumination after rotation',()=>{
 for(const id of ids)for(const rotation of rotations)for(const night of [false,true]){const f=fixture(id,rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),node=f.feature(building),roof=node.children.find(mesh=>mesh.material?.name===`world:${f.b.roofFinish}`),p=roof.geometry.getAttribute('position'),uv=roof.geometry.getAttribute('uv'),expected=night?.27+.73*.5:1;let across=0,downhill=0;
  for(let a=0;a<p.count;a++)for(let b=a+1;b<p.count;b++){const first=new Vector3().fromBufferAttribute(p,a),last=new Vector3().fromBufferAttribute(p,b),delta=last.clone().sub(first),u=delta.x*f.frame.u.x+delta.z*f.frame.u.y,v=delta.x*f.frame.v.x+delta.z*f.frame.v.y;if(Math.abs(delta.y)<1e-5&&Math.abs(v)<1e-5&&Math.abs(u)>.30){assert.ok(Math.abs(Math.abs(uv.getX(b)-uv.getX(a))-Math.abs(u))<1e-5);across++;}if(Math.abs(u)<1e-5&&Math.abs(v)>.30){assert.ok(Math.abs(Math.abs(uv.getY(b)-uv.getY(a))-first.distanceTo(last))<1e-5);assert.ok(Math.abs(uv.getX(b)-uv.getX(a))<1e-5);downhill++;}}assert.ok(across&&downhill);
  for(const mesh of node.children.filter(child=>child instanceof Mesh)){const colours=mesh.geometry.getAttribute('color');for(let n=0;n<colours.count;n++)for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(colours[channel](n)-expected)<1e-6);}f.dispose(building);
 }
});
