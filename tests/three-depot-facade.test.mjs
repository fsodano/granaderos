import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('deposito',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3((p.x+.4)*T,y,(p.y+.4)*T);};
 return {b,input,frame,point,feature:(building,name)=>building.getObjectByName(`building-detail:${b.id}:${name}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

test('actual depot piers have a full-height stone body and remain in intact support cells at every rotation',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),piers=f.feature(building,'depot-masonry-piers'),height=building.userData.height,bounds=new Box3().setFromObject(piers);assert.ok(piers.children.every(child=>child.material.name==='world:stone'));assert.equal(bounds.min.y,0);assert.ok(Math.abs(bounds.max.y-(height-2/V))<1e-5,'stone capitals must reach the wall eave');
  let vertices=0;piers.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++){const tile=f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T));assert.equal(tile?.type,'wall',`${rotation}: a pier must remain inside its intact authored cell`);vertices++;}}});assert.ok(vertices>=300);
  for(const u of [0,f.frame.width])for(let v=0;v<=f.frame.depth;v++)if(v===0||v===f.frame.depth||v%3===0){
   const p=f.frame.at(u,v),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);if(tile.type!=='wall')continue;
   const onX=Math.abs(f.frame.u.x)===1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),start=onX?new Vector3((tile.x+sign*2)*T,1.5,(tile.y+.30)*T):new Vector3((tile.x+.30)*T,1.5,(tile.y+sign*2)*T),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);
   assert.equal(new Raycaster(start,direction,0,T*3).intersectObject(building,true)[0]?.object.material.name,'world:stone',`${rotation}/${u}/${v}: the full-height stone face must remain visible outside the wall`);
  }
  for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&['door','window'].includes(tile.type))){const onY=tile.y===f.b.y||tile.y===f.b.y+f.b.height-1,sign=onY?(tile.y===f.b.y?-1:1):(tile.x===f.b.x?-1:1),y=tile.type==='door'?1.9:1.3,start=onY?new Vector3(tile.x*T,y,(tile.y+.4+sign)*T):new Vector3((tile.x+.4+sign)*T,y,tile.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(piers,true).length,0,'broad piers must leave authored opening centres clear');}f.dispose(building);
 }
});

test('the depot loft hatch and supported hoist fit the real pitched gable through all four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),height=building.userData.height,rise=getBuildingProfile(f.b).roofRise/V,bottom=height+7/V,top=height+rise-7/V,hatch=f.feature(building,'depot-loft-hatch'),hoist=f.feature(building,'depot-loft-hoist'),u=Math.round(f.frame.width*.5)-.4*(f.frame.u.x+f.frame.u.y);assert.ok(hatch&&hoist);assert.ok(hatch.children.some(child=>child.material.name==='world:iron'));assert.ok(hoist.children.some(child=>child.material.name==='world:depot-rope'));const bounds=new Box3().setFromObject(hatch);assert.ok(Math.abs(bounds.min.y-(bottom-.04))<1e-5);assert.ok(Math.abs(bounds.max.y-(top+.04))<1e-5);assert.ok(new Box3().setFromObject(hoist).max.y<height+rise,'the hoist must fit below the actual roof ridge');
  const hits=new Raycaster(f.point(u-.20,-1,(bottom+top)*.5),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6).intersectObject(hatch,true).filter(hit=>hit.object.material.name==='world:wood');assert.ok(hits.length>=2);assert.ok(Math.abs(hits.at(-1).distance-hits[0].distance-.095*T)<1e-5,'the timber hatch must have a closed face and actual thickness');f.dispose(building);
 }
});

test('edited depot supports remove only the unsupported pier and omit a loft hatch over an opening',()=>{
 for(const rotation of rotations)for(const type of ['window','door','rubble']){
  const f=fixture(rotation),mid=Math.round(f.frame.width*.5),center=f.frame.at(mid,0),pier=f.frame.at(0,3),entrance=f.frame.door;
  for(const p of [center,pier])f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;
  // The first authored exterior door defines the frame. Keep that entrance
  // first when adding a new side door to test the original facade supports.
  f.input.terrain.tiles=[entrance,...f.input.terrain.tiles.filter(tile=>tile!==entrance)];
  const building=f.build();assert.equal(Boolean(f.feature(building,'depot-loft-hatch')),false,`${rotation}/${type}: hatch needs an intact wall`);assert.equal(Boolean(f.feature(building,'depot-loft-hoist')),false);const piers=f.feature(building,'depot-masonry-piers');assert.ok(piers,'other intact piers remain');piers.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});f.dispose(building);
 }
});

test('depot roof details follow real roof rise, upper walking cells and ordinary room disclosure',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build();assert.ok(f.feature(building,'depot-masonry-piers'));assert.equal(f.feature(building,'depot-loft-hatch'),undefined,'flat roofs have no pitched loft');assert.equal(f.feature(building,'depot-loft-hoist'),undefined);f.dispose(building);}
  for(const mode of ['blocked','walking','ground','distant']){const f=fixture(rotation),p=f.frame.at(mode==='distant'?0:Math.round(f.frame.width*.5),0);f.input.terrain.upperSurfaces=[{...p,type:'floor',kind:'platform',tacticalLevel:mode==='ground'?0:1,elevation:3.3,blocked:mode==='blocked',buildingId:f.b.id}];const building=f.build(),present=mode!=='walking';assert.equal(Boolean(f.feature(building,'depot-loft-hatch')),present,`${rotation}/${mode}`);assert.equal(Boolean(f.feature(building,'depot-loft-hoist')),present);f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();for(const name of ['depot-masonry-piers','depot-loft-hatch','depot-loft-hoist'])assert.equal(f.feature(building,name),undefined,'revealed rooms must not retain floating exterior details');f.dispose(building);}
  for(const finish of ['clay','aged','thatch']){const f=fixture(rotation);f.b.roofFinish=finish;f.b.wallFinish='adobe';const building=f.build();assert.ok(f.feature(building,'gallery').children.some(child=>child.material?.name===`world:${finish}`));assert.ok(f.feature(building,'depot-masonry-piers').children.every(child=>child.material.name==='world:stone'));f.dispose(building);}
 }
});
