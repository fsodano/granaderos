import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildUpperSurfaces}=await import('../web/lib/three/world-terrain.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666;
const features={capilla:'chapel-bell-gable',casa:'domestic-chimney',herreria:'forge-chimney'};

function fixture(id,rotation,roof,view='exterior'){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {battle,b,input,frame:entranceFrame({...b,walls:battle.tiles.filter(tile=>tile.buildingId===b.id)}),build:()=>buildBuilding(b,input,T,geometry,materials),name:`building-detail:${b.id}:${features[id]}`,dispose:object=>{disposeWorldNode(object);geometry.dispose();materials.dispose();}};
}

function sourceForge(f){
 const parts={};const visit=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type===ArchitectureVolume&&['forge-chimney','chimney-cap'].includes(node.props.label))parts[node.props.label]=node.props;visit(node.props?.children);};
 for(const entry of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(entry.node);
 assert.ok(parts['forge-chimney']&&parts['chimney-cap'],'Use the actual current source masonry');return parts;
}

test('actual chapel and chimney templates follow explicit terraces and blocked metric slab elevations through four rotations',()=>{
 for(const id of Object.keys(features))for(const rotation of [0,90,180,270])for(const roof of ['terrace','slab']){
  const f=fixture(id,rotation,roof),before=JSON.stringify(f.input),building=f.build(),height=building.userData.height,feature=building.getObjectByName(f.name);assert.ok(feature,`${id}/${rotation}/${roof}`);
  if(roof==='slab')assert.equal(height,3);const bounds=new Box3().setFromObject(feature);
  if(id==='capilla'){assert.ok(Math.abs(bounds.min.y-height)<1e-5,'the bell gable must meet the real flat roof');assert.ok(bounds.max.y<height+1.60,'a flat chapel must not retain the generated gable rise');}
  else if(id==='herreria'){
   const source=sourceForge(f),profile=getBuildingProfile(f.b),brick=feature.children.find(mesh=>mesh.material?.name==='world:brick'),masonry=new Box3().setFromObject(brick),flue=feature.children.find(mesh=>mesh.material?.name==='world:forge-flue');
   assert.ok(brick&&flue);assert.equal(brick.material.color.getHexString(),source['forge-chimney'].palette.base.slice(1));assert.equal(source['forge-chimney'].texture,'brick');
   assert.ok(Math.abs(masonry.min.y-height-(source['forge-chimney'].bottom-profile.wallHeight)/V)<1e-5,'source shaft must enter the actual flat roof');
   const capTop=height+(source['chimney-cap'].top-profile.wallHeight-profile.roofRise)/V;
   assert.ok(Math.abs(masonry.max.y-capTop)<1e-5,'source cap clears the slab without an imaginary roof rise');
   assert.ok(Math.abs(bounds.max.y-capTop-.3/V)<1e-5,'the retained source flue plane sits above the cap');
  }else{assert.ok(Math.abs(bounds.min.y-height+.12)<1e-5,'chimney masonry must still enter the roof');assert.ok(Math.abs(bounds.max.y-height-.729)<1e-5,'the chimney cap must clear the flat slab without adding an imaginary pitch');}
  assert.equal(JSON.stringify(f.input),before,'presentation must preserve collision, upper cells and disclosure');f.dispose(building);
 }
});

test('accessible real roof cells omit chapel bell gables and side chimneys through all four rotations',()=>{
 for(const id of Object.keys(features))for(const rotation of [0,90,180,270]){
  const f=fixture(id,rotation,'roof-route'),before=JSON.stringify(f.input),building=f.build();assert.equal(building.userData.height,3);assert.equal(building.getObjectByName(f.name),undefined,'scenery must leave every authored roof walking cell open');assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('one playable upper cell removes the overlapping chapel crown or moves a chimney to another solid wall',()=>{
 for(const id of Object.keys(features))for(const rotation of [0,90,180,270]){
  const f=fixture(id,rotation,'slab'),initial=f.build(),bounds=new Box3().setFromObject(initial.getObjectByName(f.name)),center=bounds.getCenter(new Vector3()),cell=id==='capilla'?f.frame.at(f.frame.doorU,0):{x:Math.round(center.x/T),y:Math.round(center.z/T)},surface=f.input.terrain.upperSurfaces.find(surface=>surface.x===cell.x&&surface.y===cell.y);assert.ok(surface);disposeWorldNode(initial);surface.blocked=false;
  const before=JSON.stringify(f.input),building=f.build(),feature=building.getObjectByName(f.name);
  if(id==='capilla')assert.equal(feature,undefined,'a narrow bell gable must not obstruct a real roof cell');
  else{assert.ok(feature,'an intact unoccupied side wall can retain the chimney');const replacement=new Box3().setFromObject(feature).getCenter(new Vector3());assert.ok(Math.round(replacement.x/T)!==surface.x||Math.round(replacement.z/T)!==surface.y,'the chimney must leave the selected route clear');}
  assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('authored flat-roof details leave no floating scenery during normal partial and full room disclosure',()=>{
 for(const id of Object.keys(features))for(const rotation of [0,90,180,270])for(const view of ['partial','interior']){
  const f=fixture(id,rotation,'slab',view),building=f.build();assert.ok(f.battle.elapsedSeconds>0);assert.ok(f.input.revealedRooms.length>0);assert.equal(building.getObjectByName(f.name),undefined);f.dispose(building);
 }
});

test('zero-height blocked slabs keep a flat surface while positive and default upper obstacles retain their mass',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 for(const [obstacleHeight,rise]of [[0,0],[.80,.80],[undefined,.45]]){
  const surface={id:'review-roof',x:4,y:4,type:'floor',kind:'roof',tacticalLevel:1,elevation:3,slabThickness:.2,material:'adobe',blocked:true,...(obstacleHeight===undefined?{}:{obstacleHeight})},input={terrain:{width:10,height:10,tiles:[],upperSurfaces:[surface]}},before=JSON.stringify(input),roof=buildUpperSurfaces([surface],input,T,geometry,materials),bounds=new Box3().setFromObject(roof);
  assert.ok(Math.abs(bounds.max.y-3-rise)<1e-5,'only a positive authored obstacle may extend above the slab');assert.ok(Math.abs(bounds.min.y-2.8)<1e-5);assert.equal(roof.children.some(child=>child.material?.name==='world:stone'),rise>0);assert.equal(JSON.stringify(input),before);disposeWorldNode(roof);
 }
 geometry.dispose();materials.dispose();
});
