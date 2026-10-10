import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {buildingStyle}=await import('../game/building-types.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('almacen',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},feature:building=>building.getObjectByName(`building-detail:${b.id}:warehouse-buttresses`),dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function supports(f){return [0,f.frame.width].flatMap(u=>Array.from({length:Math.max(0,Math.ceil((f.frame.depth-2)/3))},(_,n)=>({u,v:2+n*3}))).filter(({u,v})=>{const p=f.frame.at(u,v);return f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y)?.type==='wall';});}

test('actual warehouse supports form closed sloping masonry wedges in intact side cells at four rotations',()=>{
 let checked=0;
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),height=building.userData.height,inset=buildingArtInset(f.b,f.input),points=[];assert.ok(node);
  node.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++){const x=p.getX(n),z=p.getZ(n);assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(x/T)&&tile.y===Math.round(z/T))?.type,'wall','every masonry vertex must remain in an intact support cell');assert.ok(p.getY(n)<height-.04);points.push({u:(x/T-inset-f.frame.origin.x)*f.frame.u.x+(z/T-inset-f.frame.origin.y)*f.frame.u.y,v:(x/T-inset-f.frame.origin.x)*f.frame.v.x+(z/T-inset-f.frame.origin.y)*f.frame.v.y,y:p.getY(n)});}}});
  for(const {u,v}of supports(f)){const shift=inset===0?0:.30,a=u-shift*(f.frame.u.x+f.frame.u.y),c=v-shift*(f.frame.v.x+f.frame.v.y),out=u===0?-1:1,near=points.filter(p=>Math.abs(p.v-c)<.20),inner=Math.max(...near.filter(p=>Math.abs(p.u-(a-out*.39))<1e-5).map(p=>p.y)),outer=Math.max(...near.filter(p=>Math.abs(p.u-(a+out*.39))<1e-5).map(p=>p.y));assert.ok(Math.abs(inner-(height-12/V))<1e-5);assert.ok(Math.abs(outer-height*.59)<1e-5);assert.ok(inner-outer>.50,'the support must have the retained visible slope');checked++;}
  // A ray through the support must meet front and back surfaces, rather than
  // a single floating panel. The lower foot leaves the ordinary door route.
  const {u,v}=supports(f)[0],p=f.frame.at(u,v),onX=Math.abs(f.frame.u.x)===1,start=onX?new Vector3((p.x-1)*T,.35,(p.y+.1)*T):new Vector3((p.x+.1)*T,.35,(p.y-1)*T),direction=onX?new Vector3(1,0,0):new Vector3(0,0,1);assert.ok(new Raycaster(start,direction,0,2*T).intersectObject(node,true).length>=2);f.dispose(building);
 }assert.ok(checked>=8,'the check must cover both real side walls');
});

test('warehouse wedges retain metre-based masonry UVs and authored body finishes',()=>{
 for(const rotation of rotations)for(const finish of ['stone','brick','limewash','adobe']){
  const f=fixture(rotation);f.b.wallFinish=finish;const building=f.build(),node=f.feature(building);assert.ok(node.children.some(child=>child.material.name===`world:${finish}`));assert.ok(node.children.some(child=>child.material.name==='world:stone'));const coping=node.children.find(child=>child.material.name==='world:masonry-coping');assert.equal(coping.material.color.getHexString(),{stone:'c5bd9f',brick:'cfb490',limewash:'eee6d1',adobe:'cab48e'}[finish],'the sloped cap must retain the direct authored finish trim');let vertical=0;
  node.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position'),uv=child.geometry.getAttribute('uv'),normal=child.geometry.getAttribute('normal');for(let n=0;n<p.count;n+=3){if(Math.abs(normal.getY(n))>.5)continue;for(const next of [n+1,n+2])if(Math.abs(p.getY(n)-p.getY(next))>.7){assert.ok(Math.abs(Math.abs(uv.getY(n)-uv.getY(next))-Math.abs(p.getY(n)-p.getY(next)))<1e-5,'vertical courses must keep the same physical texture density as the wall');vertical++;}}}});assert.ok(vertical>0);f.dispose(building);
 }
});

test('edited warehouse supports leave door, window and breach cells clear',()=>{
 for(const rotation of rotations)for(const type of ['door','window','rubble']){
  const f=fixture(rotation),{u,v}=supports(f)[0],p=f.frame.at(u,v);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;const entrance=f.frame.door;f.input.terrain.tiles=[entrance,...f.input.terrain.tiles.filter(tile=>tile!==entrance)];const building=f.build(),node=f.feature(building);assert.ok(node,'other intact side supports remain');node.traverse(child=>{if(child instanceof Mesh){const positions=child.geometry.getAttribute('position');for(let n=0;n<positions.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(positions.getX(n)/T)&&tile.y===Math.round(positions.getZ(n)/T))?.type,'wall');}});
  const onX=Math.abs(f.frame.u.x)===1,sign=onX?(p.x===f.b.x?-1:1):(p.y===f.b.y?-1:1),y=type==='window'?1.3:1.9,start=onX?new Vector3((p.x+sign)*T,y,p.y*T):new Vector3(p.x*T,y,(p.y+sign)*T),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(node,true).length,0);f.dispose(building);
 }
});

test('warehouse supports stay below real flat roofs and disappear with ordinary room cutaways',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),node=f.feature(building);assert.ok(node);node.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.ok(p.getY(n)<building.userData.height-.04,'low scenery must not occupy an authored upper route');}});f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
 }
});

function sourceButtress(f){
 let source;
 const visit=node=>{if(!node||source)return;if(Array.isArray(node)){for(const child of node)visit(child);return;}if(String(node.props?.['data-architectural-volume']).includes('storehouse-buttress')){source=node.props.children.filter(child=>child.type===ArchitectureVolume);return;}visit(node.props?.children);};
 for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);
 assert.ok(source,'the actual current warehouse sprite must have its paired body and foot volumes');return source;
}

test('the current stone warehouse body and separate stone foot retain the actual sprite palettes and 60% volume overlay',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),source=sourceButtress(f),building=f.build(),node=f.feature(building),body=node.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()===source[0].props.palette.base.slice(1)),foot=node.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()===source[1].props.palette.base.slice(1));assert.ok(body&&foot);assert.ok(body.material!==foot.material,'the current source gives the footing a separate warm stone base');assert.equal(source[0].props.texture,'stone');assert.equal(source[1].props.texture,'stone');
  for(const mesh of [body,foot]){assert.equal(mesh.material.userData.architectureFinish.role,'volume');assert.equal(mesh.material.userData.architectureFinish.textureOpacity,.60);assert.equal(mesh.material.userData.architectureFinish.multiplyOpacity,0);assert.equal(mesh.material.userData.architectureFinish.texture,'/art/architecture-stone-v2.png');}
  assert.equal(node.children.find(mesh=>mesh.material.name==='world:masonry-coping').material.color.getHexString(),source[0].props.palette.trim.slice(1));f.dispose(building);
 }
});

test('source stone supports retain normal day and night vertex light without an extra guessed uniform shade',()=>{
 for(const rotation of rotations)for(const night of [false,true]){
  const f=fixture(rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),node=f.feature(building),body=node.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()==='928f80'),expected=night?.27+.73*.5:1;assert.ok(body);
  const colours=body.geometry.getAttribute('color');for(let n=0;n<colours.count;n++)for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(colours[channel](n)-expected)<1e-6,'source compositing must precede the unmodified physical illumination');f.dispose(building);
 }
});

test('warehouse finish correction preserves other authored body textures and unpainted legacy selection',()=>{
 for(const rotation of rotations)for(const finish of ['brick','limewash','adobe']){
  const f=fixture(rotation);f.b.wallFinish=finish;const building=f.build(),node=f.feature(building),body=node.children.find(mesh=>mesh.material.name===`world:${finish}`);assert.ok(body);assert.equal(body.material.userData.architectureFinish,undefined,'this current-stone correction must not silently replace an edited body texture');f.dispose(building);
 }
 for(const rotation of rotations){
  const f=fixture(rotation);f.b.architecture='warehouse';f.b.roof='terrace';f.b.wallFinish=undefined;const building=f.build(),node=f.feature(building),style=buildingStyle(f.b),body=node.children.find(mesh=>mesh.material.color.getHexString()===style.wall.slice(1));assert.ok(body);assert.equal(body.material.userData.architectureFinish,undefined);assert.ok(node.children.every(mesh=>mesh.material.userData.architectureFinish===undefined),'unpainted legacy supports must keep their released materials');f.dispose(building);
 }
});
