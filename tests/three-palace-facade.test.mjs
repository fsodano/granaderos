import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildTerrace}=await import('../game/buildings.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,rotations=[0,90,180,270];

function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('palacio',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles.filter(tile=>tile.buildingId===b.id)}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const along=.4*(frame.u.x+frame.u.y),depth=.4*(frame.v.x+frame.v.y),name=feature=>`building-detail:${b.id}:${feature}`;
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3((p.x+.4)*T,y,(p.y+.4)*T);};
 const ray=(object,u,v,y,axis='v',sign=1)=>new Raycaster(point(u,v,y),new Vector3(frame[axis].x*sign,0,frame[axis].y*sign),0,T*1.6).intersectObject(object,true);
 const build=()=>{const building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);return building;};
 const dispose=building=>{disposeWorldNode(building);geometry.dispose();materials.dispose();};
 return {b,input,frame,along,depth,name,point,ray,build,dispose};
}
function vertices(object){const result=[];object.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)result.push(new Vector3().fromBufferAttribute(p,n));}});return result;}

test('the actual palace has four supported stone columns, a measured storey band and a joined balcony through four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),before=JSON.stringify(f.input),building=f.build(),height=building.userData.height,profile=getBuildingProfile(f.b),storey=height*profile.groundFloorHeight/profile.wallHeight,columns=building.getObjectByName(f.name('entrance-columns')),bands=building.getObjectByName(f.name('palace-storey-bands')),balcony=building.getObjectByName(f.name('palace-balcony'));
  for(const u of [3,5,7,9])assert.ok(f.ray(columns,u-f.along,-1,1).some(hit=>hit.object.material.name==='world:stone'),`${rotation}: missing formal support ${u}`);
  const stoneBand=bands.children.find(child=>child.material.name==='world:stone'),bounds=new Box3().setFromObject(stoneBand);assert.ok(Math.abs(bounds.min.y-(storey-.075))<1e-5);assert.ok(Math.abs(bounds.max.y-(storey+.075))<1e-5);
  const floorRay=new Raycaster(f.point(f.frame.doorU-f.along+.60,-.25,storey+1),new Vector3(0,-1,0),0,1),slab=floorRay.intersectObject(balcony,true).find(hit=>hit.object.material.name==='world:stone');assert.ok(slab);assert.ok(Math.abs(slab.point.y-(storey+.24))<1e-5,'the balcony floor must follow the real storey band');
  assert.ok(new Box3().setFromObject(columns).max.y>storey+.04&&new Box3().setFromObject(columns).max.y<storey+.24,'column caps must join the balcony slab');assert.ok(balcony.children.some(child=>child.material.name==='world:timber-edge'),'the balcony retains its current panelled door');
  assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('the compiled palace has twenty-one separate arched upper panes across its four supported faces',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),height=building.userData.height,storey=height*70/124,bottom=storey+.65,windows=building.getObjectByName(f.name('palace-upper-windows'));let count=0;
  for(const [v,us]of [[0,[2,4,8,10,12]],[f.frame.depth,[1,3,5,7,9,11]]])for(const u of us){const sign=v===0?1:-1;assert.ok(f.ray(windows,u-f.along+.10/T,v-sign,bottom+.30,'v',sign).some(hit=>hit.object.material.name==='world:darkwood'),`${rotation}: missing front/rear pane ${u},${v}`);count++;}
  for(const u of [0,f.frame.width])for(const v of [1,3,5,7,9]){const sign=u===0?1:-1;assert.ok(f.ray(windows,u-sign,v-f.depth+.10/T,bottom+.30,'u',sign).some(hit=>hit.object.material.name==='world:darkwood'),`${rotation}: missing side pane ${u},${v}`);count++;}
  assert.equal(count,21);assert.ok(new Box3().setFromObject(windows).max.y<height-.20,'the upper panes stay below the real roof');
  const u=4-f.along;assert.equal(f.ray(windows,u+.30/T,-1,bottom+1.13).length,0,'arched shoulders must have real empty space');assert.ok(f.ray(windows,u,-1,bottom+1.13).some(hit=>hit.object.material.name==='world:darkwood'),'the central arch crest must remain');
  const paneHits=f.ray(windows,u+.10/T,-1,bottom+.30).filter(hit=>hit.object.material.name==='world:darkwood');assert.ok(paneHits.length>=2);assert.ok(paneHits.at(-1).distance-paneHits[0].distance>.03,'the upper panes are closed shallow geometry');f.dispose(building);
 }
});

test('edited palace wall cells remove unsupported columns and panes while all entrance paths remain clear',()=>{
 for(const rotation of rotations)for(const type of ['window','door','rubble']){
  const f=fixture(rotation),cell=f.frame.at(3,0);f.input.terrain.tiles.find(tile=>tile.x===cell.x&&tile.y===cell.y).type=type;const before=JSON.stringify(f.input),building=f.build(),details=building.getObjectByName(`building-details:${f.b.id}`),columns=building.getObjectByName(f.name('entrance-columns'));
  for(const p of vertices(columns).filter(p=>p.y<1.8))assert.ok(Math.abs(p.x/T-cell.x)>.5||Math.abs(p.z/T-cell.y)>.5,'columns cannot fill an edited opening cell');
  for(const [u,y]of [[f.frame.doorU-f.along,1.90],[3-f.along,type==='window'?1.30:1.90]])assert.equal(f.ray(details,u,-1,y).length,0,'formal details must preserve standing doors and window openings');assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
 for(const rotation of rotations){
  const f=fixture(rotation);for(const u of [3,5]){const p=f.frame.at(u,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='rubble';}
  const rear=f.frame.at(3,f.frame.depth);f.input.terrain.tiles.find(tile=>tile.x===rear.x&&tile.y===rear.y).type='rubble';const building=f.build();assert.equal(Boolean(building.getObjectByName(f.name('palace-balcony'))),false,'the balcony requires intact supports on both sides');assert.equal(Boolean(building.getObjectByName(f.name('palace-pediment'))),false);
  const windows=building.getObjectByName(f.name('palace-upper-windows')),bottom=building.userData.height*70/124+.65;assert.equal(f.ray(windows,3-f.along,f.frame.depth+1,bottom+.30,'v',-1).length,0,'a breached wall must not retain a floating upper pane');f.dispose(building);
 }
});

test('short authored palace slabs keep one floor and clear roof routes through every rotation',()=>{
 for(const rotation of rotations)for(const roof of ['slab','roof-route']){
  const f=fixture(rotation,'exterior',roof),before=JSON.stringify(f.input),building=f.build(),details=building.getObjectByName(`building-details:${f.b.id}`);assert.equal(building.userData.height,3);
  for(const feature of ['palace-balcony','palace-pediment','palace-upper-windows'])assert.equal(Boolean(building.getObjectByName(f.name(feature))),false);
  for(const feature of ['entrance-columns','palace-pilasters','palace-storey-bands'])assert.ok(new Box3().setFromObject(building.getObjectByName(f.name(feature))).max.y<3,'short roofs must not inherit a decorative second floor');assert.equal(f.ray(details,f.frame.doorU-f.along,-1,1.9).length,0);assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('the palace portico excludes the actual walking roof footprint and retains closed or inner slabs',()=>{
 for(const rotation of rotations)for(const mode of ['blocked','front-route','inner-route']){
  const f=fixture(rotation),upper=buildTerrace({...f.b,roof:'terrace'},{elevation:4.9});f.input.terrain.upperSurfaces=upper.upperSurfaces.map(surface=>({...surface,blocked:true,obstacleHeight:0}));
  if(mode!=='blocked'){const p=f.frame.at(f.frame.doorU,mode==='front-route'?0:3);f.input.terrain.upperSurfaces.find(surface=>surface.x===p.x&&surface.y===p.y).blocked=false;}
  const before=JSON.stringify(f.input),building=f.build();assert.equal(building.userData.height,4.9);assert.equal(Boolean(building.getObjectByName(f.name('palace-pediment'))),mode!=='front-route');assert.ok(new Box3().setFromObject(building.getObjectByName(f.name('palace-upper-windows'))).max.y<4.9);assert.ok(new Box3().setFromObject(building.getObjectByName(f.name('palace-balcony'))).max.y<4.9);assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('palace details retain authored finishes and window styles while normal room disclosure controls the facade',()=>{
 for(const rotation of rotations){
  for(const style of ['arched','barred','small','lattice','shutters']){
   const f=fixture(rotation);f.b.wallFinish='brick';f.b.roofFinish='thatch';f.b.windowStyle=style;const before=JSON.stringify(f.input),building=f.build(),pediment=building.getObjectByName(f.name('palace-pediment')),windows=building.getObjectByName(f.name('palace-upper-windows'));
   assert.ok(pediment.children.some(child=>child.material.name==='world:brick'));assert.ok(windows.children.some(child=>child.material.name===`world:${style==='shutters'?'timber-shutter':style==='lattice'?'wood':'iron'}`));assert.equal(JSON.stringify(f.input),before);f.dispose(building);
  }
  for(const view of ['partial','interior']){
   const f=fixture(rotation,view),building=f.build();assert.ok(f.input.revealedRooms.length>0,'the fixture must use ordinary entry orders');assert.equal(Boolean(building.getObjectByName(`palace-facade:${f.b.id}`)),false);f.dispose(building);
  }
  const f=fixture(rotation);f.b.rooms.push({id:'upper-office',tacticalLevel:1,cells:[{x:f.b.x+2,y:f.b.y+2,tacticalLevel:1}]});f.input.revealedRooms=['upper-office'];const before=JSON.stringify(f.input),building=f.build();assert.ok(building.getObjectByName(f.name('palace-upper-windows')),'upper disclosure must retain unopened ground-room facades');assert.equal(building.userData.cutawayRooms.length,0);assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});
