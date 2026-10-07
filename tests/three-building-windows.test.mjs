import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {addWindowFace}=await import('../web/lib/three/world-building-windows.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {BUILDING_OPENINGS}=await import('../game/building-scale.js');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {createElement}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup}=await import('../web/node_modules/react-dom/server.node.js');
const {Opening}=await import('../web/app/TacticalArchitectureMaterials.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666;

test('timber lattice has clipped diagonal slats on both wall axes and readable lower openings from either face',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),width=.74,sill=.765,top=1.85,height=top-sill;
 for(const axis of ['x','y']){
  const batch=new WorldBatch(geometry);addWindowFace(batch,materials,{axis,mid:0,cross:0,base:0,sill,top,width,style:'lattice',light:1});const face=batch.finish('window-review');face.updateMatrixWorld(true);
  assert.equal(face.children.some(child=>child.material.name==='world:iron'),false,'timber lattice must not substitute iron bars');const timber=face.children.find(child=>child.material.name==='world:timber-lattice'),bounds=new Box3().setFromObject(timber);assert.ok(bounds.min.y>sill&&bounds.max.y<top);
  assert.ok((axis==='x'?bounds.min.x:bounds.min.z)>-width*.5);assert.ok((axis==='x'?bounds.max.x:bounds.max.z)<width*.5,'diagonal ends must stay within the opening');
  for(const sign of [-1,1])for(const side of [-1,1]){
   const x=side*(-width*.5+width/18+width*4/18),y=top-height/19-height*6/19,origin=axis==='x'?new Vector3(x,y,sign*.20):new Vector3(sign*.20,y,x),direction=axis==='x'?new Vector3(0,0,-sign):new Vector3(-sign,0,0),hits=new Raycaster(origin,direction,0,.4).intersectObject(face,true);
   assert.equal(hits[0]?.object.material.name,'world:timber-lattice');assert.ok(Math.abs((axis==='x'?hits[0].point.z:hits[0].point.x)*sign-.042)<1e-5,'slats must clear the pane from either camera face');
  }
  for(const sign of [-1,1]){const x=width*.12,y=sill+height*.15,origin=axis==='x'?new Vector3(x,y,sign*.20):new Vector3(sign*.20,y,x),direction=axis==='x'?new Vector3(0,0,-sign):new Vector3(-sign,0,0);assert.equal(new Raycaster(origin,direction,0,.4).intersectObject(face,true)[0]?.object.material.name,'world:glass','the lower pane must retain open space between the timbers');}disposeWorldNode(face);
 }
 geometry.dispose();materials.dispose();
});

function render(battle,tiles=battle.tiles){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:{width:battle.width,height:battle.height,tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),building=buildBuilding(battle.buildings[0],input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);
 return {building,dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
test('the actual pulperia and stable retain diagonal timber windows at all four rotations and through authored tile-style overrides',()=>{
 let windows=0;
 for(const id of ['pulperia','caballeriza','barraca'])for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],tiles=battle.tiles.map(tile=>id==='barraca'&&tile.type==='window'?{...tile,style:'lattice'}:tile),r=render(battle,tiles),fabric=r.building.getObjectByName(`building-fabric:${b.id}`);
  for(const tile of tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='window')){
   const onY=tile.y===b.y||tile.y===b.y+b.height-1,axis=onY?'x':'y',width=r.building.userData.openings.find(record=>record.id===`window:${tile.x},${tile.y}`).width,sill=BUILDING_OPENINGS.windowSill/V,top=BUILDING_OPENINGS.windowTop/V,height=top-sill,x=-width*.5+width/18+width*4/18,y=top-height/19-height*6/19;
   for(const sign of [-1,1]){const origin=axis==='x'?new Vector3(tile.x*T+x,y,(tile.y+.4)*T+sign*.20):new Vector3((tile.x+.4)*T+sign*.20,y,tile.y*T+x),direction=axis==='x'?new Vector3(0,0,-sign):new Vector3(-sign,0,0);assert.equal(new Raycaster(origin,direction,0,.4).intersectObject(fabric,true)[0]?.object.material.name,'world:timber-lattice',`${id}/${rotation}: missing diagonal timber face`);}windows++;
  }r.dispose();
 }assert.ok(windows>=24);
});

test('other retained window styles keep their existing glazing and bars',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 for(const style of ['barred','small','arched'])for(const axis of ['x','y']){
  const batch=new WorldBatch(geometry);addWindowFace(batch,materials,{axis,mid:0,cross:0,base:0,sill:.765,top:1.85,width:.74,style,light:1});const face=batch.finish('style-review');assert.ok(face.children.some(child=>child.material.name==='world:glass'));assert.equal(face.children.some(child=>child.material.name==='world:timber-lattice'),false);assert.ok(face.children.some(child=>child.material.name===`world:${style==='shutters'?'wood':'iron'}`));const bounds=new Box3().setFromObject(face);assert.ok(Math.abs(bounds.min.y-.765)<1e-5&&Math.abs(bounds.max.y-1.85)<1e-5);disposeWorldNode(face);
 }geometry.dispose();materials.dispose();
});

test('ordinary window cutaways and breaches remove the new timber without changing retained opening flags or dimensions',()=>{
 for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle('pulperia',rotation,'exterior'),initial=render(battle),records=initial.building.userData.openings.map(record=>({...record}));initial.dispose();
  for(const flags of [{open:true},{broken:true},{open:true,broken:true}]){const r=render(battle,battle.tiles.map(tile=>tile.type==='window'?{...tile,...flags}:tile));assert.deepEqual(r.building.userData.openings.map(record=>({...record,open:false})),records.map(record=>({...record,open:false})));assert.ok(r.building.getObjectByName(`building-fabric:${battle.buildings[0].id}`).children.some(child=>child.material.name==='world:timber-lattice'),'retained window flags do not redefine the authored lattice');r.dispose();}
  const breached=render(battle,battle.tiles.map(tile=>tile.type==='window'?{...tile,type:'rubble'}:tile));assert.equal(breached.building.getObjectByName(`building-fabric:${battle.buildings[0].id}`).children.some(child=>['world:glass','world:timber-lattice'].includes(child.material.name)),false);breached.dispose();
  for(const view of ['partial','interior'])for(const roof of ['original','slab','roof-route']){
   const inside=createArchitectureReviewBattle('pulperia',rotation,view,roof),b=inside.buildings[0],r=render(inside),fabric=r.building.getObjectByName(`building-fabric:${b.id}`);let cut=0;
   for(const tile of inside.tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='window')){
    const record=r.building.userData.openings.find(record=>record.id===`window:${tile.x},${tile.y}`);if(record.height>=.3)continue;const onY=tile.y===b.y||tile.y===b.y+b.height-1,origin=onY?new Vector3(tile.x*T,1.3,(tile.y+.4)*T-.2):new Vector3((tile.x+.4)*T-.2,1.3,tile.y*T),direction=onY?new Vector3(0,0,1):new Vector3(1,0,0);assert.equal(new Raycaster(origin,direction,0,.4).intersectObject(fabric,true).filter(hit=>hit.object.material.name==='world:timber-lattice').length,0,'a low disclosed wall must not retain a floating lattice');cut++;
   }assert.ok(cut>0);r.dispose();
  }
 }
});


test('authored green shutters remain visible inside the aperture from both actual wall faces with the source central gap and rails',()=>{
 const source=renderToStaticMarkup(createElement(Opening,{type:'window',style:'shutters',trim:'#e3d5b5'}));
 assert.equal((source.match(/fill="#65705a"/g)||[]).length,2);assert.equal((source.match(/stroke="#a8ac84"/g)||[]).length,2);assert.ok(source.includes('width="6"'),'each current source shutter occupies six of the eighteen opening units');
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 for(const axis of ['x','y']){
  const width=.74,sill=.765,top=1.85,height=top-sill,batch=new WorldBatch(geometry);addWindowFace(batch,materials,{axis,mid:0,cross:0,base:0,sill,top,width,style:'shutters',light:1});const face=batch.finish('shutter-review');face.updateMatrixWorld(true);
  const panel=face.children.find(child=>child.material.name==='world:timber-shutter'),rails=face.children.find(child=>child.material.name==='world:shutter-rail');assert.equal(panel.material.color.getHexString(),'65705a');assert.equal(rails.material.color.getHexString(),'a8ac84');assert.equal(face.children.some(child=>child.material.name==='world:wood'),false,'the source green paint may not become an exposed plain brown post');
  const bounds=new Box3().setFromObject(panel);assert.ok(Math.abs((axis==='x'?bounds.max.x-bounds.min.x:bounds.max.z-bounds.min.z)-width)<1e-6,'both panels must stay in the actual opening, rather than disappear behind masonry jambs');assert.ok(bounds.min.y>sill&&bounds.max.y<top);
  const hit=(x,y,sign)=>{const origin=axis==='x'?new Vector3(x,y,sign*.2):new Vector3(sign*.2,y,x),direction=axis==='x'?new Vector3(0,0,-sign):new Vector3(-sign,0,0);return new Raycaster(origin,direction,0,.4).intersectObject(face,true)[0];};
  for(const sign of [-1,1]){
   for(const side of [-1,1]){assert.equal(hit(side*width/3,sill+height*.35,sign)?.object.material.name,'world:timber-shutter');for(const down of [5,10,15])assert.equal(hit(side*width/3,top-height*down/19,sign)?.object.material.name,'world:shutter-rail','each actual shutter face must expose all three authored rails');}
   assert.equal(hit(0,(top+sill)*.5,sign)?.object.material.name,'world:glass','the current source central gap remains readable');
  }disposeWorldNode(face);
 }geometry.dispose();materials.dispose();
});

test('real house and farmhouse shutter panels clear their masonry jambs across four rotations, saved style flags and ordinary disclosure',()=>{
 for(const id of ['casa','estancia'])for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],r=render(battle),fabric=r.building.getObjectByName(`building-fabric:${b.id}`),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},inset=buildingArtInset(b,input),records=r.building.userData.openings.map(record=>({...record}));
  for(const tile of battle.tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='window')){
   const record=records.find(record=>record.id===`window:${tile.x},${tile.y}`),onY=tile.y===b.y||tile.y===b.y+b.height-1,width=record.width,y=BUILDING_OPENINGS.windowSill/V+(BUILDING_OPENINGS.windowTop-BUILDING_OPENINGS.windowSill)/V*.35;
   for(const sign of [-1,1])for(const side of [-1,1]){const x=side*width/3,origin=onY?new Vector3(tile.x*T+x,y,(tile.y+inset)*T+sign*.2):new Vector3((tile.x+inset)*T+sign*.2,y,tile.y*T+x),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);assert.equal(new Raycaster(origin,direction,0,.4).intersectObject(fabric,true)[0]?.object.material.name,'world:timber-shutter',`${id}/${rotation}: the actual wall must expose its shutter face`);}
  }r.dispose();
  for(const flags of [{open:true},{broken:true}]){const f=render(battle,battle.tiles.map(tile=>tile.type==='window'?{...tile,...flags}:tile));assert.deepEqual(f.building.userData.openings.map(record=>({...record,open:false})),records.map(record=>({...record,open:false})));assert.ok(f.building.getObjectByName(`building-fabric:${b.id}`).children.some(child=>child.material.name==='world:timber-shutter'));f.dispose();}
  const breached=render(battle,battle.tiles.map(tile=>tile.type==='window'?{...tile,type:'rubble'}:tile));assert.equal(breached.building.getObjectByName(`building-fabric:${b.id}`).children.some(child=>['world:timber-shutter','world:shutter-rail','world:shutter-edge'].includes(child.material.name)),false);breached.dispose();
  for(const view of ['partial','interior']){const inside=createArchitectureReviewBattle(id,rotation,view),f=render(inside),body=f.building.getObjectByName(`building-fabric:${b.id}`),low=f.building.userData.openings.filter(record=>record.type==='window'&&record.height<.3);assert.ok(low.length>0);const fullCount=f.building.userData.openings.filter(record=>record.type==='window'&&record.height>=.3).length,panel=body.children.find(child=>child.material.name==='world:timber-shutter');if(fullCount===0)assert.equal(panel,undefined,'ordinary cutaways may not leave floating shutters');f.dispose();}
 }
});
