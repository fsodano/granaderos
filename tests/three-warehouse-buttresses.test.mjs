import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('almacen',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},feature:building=>building.getObjectByName(`building-detail:${b.id}:warehouse-buttresses`),dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function supports(f){return [0,f.frame.width].flatMap(u=>Array.from({length:Math.max(0,Math.ceil((f.frame.depth-2)/3))},(_,n)=>({u,v:2+n*3}))).filter(({u,v})=>{const p=f.frame.at(u,v);return f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y)?.type==='wall';});}

test('actual warehouse supports form closed sloping masonry wedges in intact side cells at four rotations',()=>{
 let checked=0;
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),height=building.userData.height,points=[];assert.ok(node);
  node.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++){const x=p.getX(n),z=p.getZ(n);assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(x/T)&&tile.y===Math.round(z/T))?.type,'wall','every masonry vertex must remain in an intact support cell');assert.ok(p.getY(n)<height-.04);points.push({u:(x/T-.4-f.frame.origin.x)*f.frame.u.x+(z/T-.4-f.frame.origin.y)*f.frame.u.y,v:(x/T-.4-f.frame.origin.x)*f.frame.v.x+(z/T-.4-f.frame.origin.y)*f.frame.v.y,y:p.getY(n)});}}});
  for(const {u,v}of supports(f)){const a=u-.30*(f.frame.u.x+f.frame.u.y),c=v-.30*(f.frame.v.x+f.frame.v.y),out=u===0?-1:1,near=points.filter(p=>Math.abs(p.v-c)<.20),inner=Math.max(...near.filter(p=>Math.abs(p.u-(a-out*.39))<1e-5).map(p=>p.y)),outer=Math.max(...near.filter(p=>Math.abs(p.u-(a+out*.39))<1e-5).map(p=>p.y));assert.ok(Math.abs(inner-(height-12/V))<1e-5);assert.ok(Math.abs(outer-height*.59)<1e-5);assert.ok(inner-outer>.50,'the support must have the retained visible slope');checked++;}
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
