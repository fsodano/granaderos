import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset,buildingFloorRectangles}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270],ids=['pulperia','herreria','deposito'];
function fixture(id,rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

// Read the front-visible source once; opposite sprite views omit the glyph.
// The native plaque retains the same authored proportions at every rotation.
let retainedSourceSign;
function sourceSign(f){
 if(retainedSourceSign)return retainedSourceSign;
 let sign;const visit=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.key==='shop-sign')sign=node;visit(node.props?.children);};
 for(const entry of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(entry.node);
 assert.ok(sign);retainedSourceSign=sign.props.children.find(node=>node.type==='rect').props;return retainedSourceSign;
}
function supportedSourceSign(f,building,sign){
 const source=sourceSign(f),board=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:board`),bracket=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:bracket`),porch=building.getObjectByName(`building-detail:${f.b.id}:gallery`);
 assert.ok(board&&bracket&&porch);const boardBounds=new Box3().setFromObject(board),anchor=new Box3().setFromObject(bracket).max.y;
 assert.ok(Math.abs(boardBounds.min.y-(anchor-(Number(source.y)+Number(source.height))/V))<1e-5,'the actual source board hangs below its own bracket');
 assert.ok(Math.abs(boardBounds.max.y-(anchor-Number(source.y)/V))<1e-5);assert.ok(Math.abs(boardBounds.max.y-boardBounds.min.y-Number(source.height)/V)<1e-5);
 const beam=porch.children.find(mesh=>mesh.material?.name==='world:wood'),beamTop=new Box3().setFromObject(beam).max.y,u=Math.max(.4,f.frame.doorU-1.35),p=f.frame.at(u,-.32);
 const ray=new Raycaster(new Vector3(p.x*T,beamTop,p.y*T),new Vector3(0,-1,0),0,.035);
 assert.ok(ray.intersectObject(bracket,true).length,'the real bracket return meets the actual porch beam');
 let vertices=0;sign.traverse(mesh=>{if(mesh instanceof Mesh){const positions=mesh.geometry.getAttribute('position');vertices+=positions.count;for(let n=0;n<positions.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(positions.getX(n)/T)&&tile.y===Math.round(positions.getZ(n)/T))?.type,'wall','all board, mark and bracket faces stay over an intact support');}});assert.ok(vertices>0);
}

test('shop, forge and depot centring requires both actual intact front corners and preserves legacy and edited support fallback',()=>{
 for(const id of ids)for(const rotation of rotations){
  const normal=fixture(id,rotation);assert.equal(buildingArtInset(normal.b,normal.input),0);normal.dispose(normal.build());
  for(const uEnd of ['left','right'])for(const type of ['rubble','grass','door','window']){const f=fixture(id,rotation),p=f.frame.at(uEnd==='left'?0:f.frame.width,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;assert.equal(buildingArtInset(f.b,f.input),.4);f.dispose(f.build());}
  const legacy=fixture(id,rotation);legacy.b.architecture=legacy.b.kind;legacy.b.kind=undefined;legacy.b.wallFinish=undefined;assert.equal(buildingArtInset(legacy.b,legacy.input),.4);legacy.dispose(legacy.build());
 }
});

test('all actual shop, forge and depot roofs and standing door apertures join their centred shells through four rotations',()=>{
 for(const id of ids)for(const rotation of rotations){
  const f=fixture(id,rotation);f.frame.door.open=true;const building=f.build(),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),roof=fabric.children.find(mesh=>mesh.material.name===`world:${f.b.roofFinish}`),profile=getBuildingProfile(f.b);assert.ok(roof);const p=roof.geometry.getAttribute('position'),xs=[],zs=[];for(let n=0;n<p.count;n++){xs.push(p.getX(n));zs.push(p.getZ(n));}for(const [actual,expected]of [[Math.min(...xs),(f.b.x-profile.eave)*T],[Math.max(...xs),(f.b.x+f.b.width-1+profile.eave)*T],[Math.min(...zs),(f.b.y-profile.eave)*T],[Math.max(...zs),(f.b.y+f.b.height-1+profile.eave)*T]])assert.ok(Math.abs(actual-expected)<1e-5);
  if(id==='deposito'){const rise=Math.min(profile.roofRise/V,Math.max(.4,f.frame.width*.28)),wall=fabric.children.find(mesh=>mesh.material.name===`world:${f.b.wallFinish}`),vertices=wall.geometry.getAttribute('position');for(const v of [0,f.frame.depth])for(const u of [0,f.frame.width*.5,f.frame.width]){const point=f.frame.at(u,v),y=building.userData.height+(u===f.frame.width*.5?rise:0);assert.ok(Array.from({length:vertices.count},(_,n)=>n).some(n=>Math.abs(vertices.getX(n)-point.x*T)<1e-5&&Math.abs(vertices.getZ(n)-point.y*T)<1e-5&&Math.abs(vertices.getY(n)-y)<1e-5));}}
  const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=new Vector3(f.frame.door.x*T+offset*f.frame.u.x,y,f.frame.door.y*T+offset*f.frame.u.y).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(building,true).length,0);}assert.equal(building.userData.openings.find(opening=>opening.id===f.frame.door.doorId).width,.60*T);f.dispose(building);
 }
});

test('actual shop, forge and depot floor returns retain physical hatches and original upper and threshold footprints',()=>{
 for(const id of ids)for(const rotation of rotations){
  const f=fixture(id,rotation,'interior'),cell=f.b.rooms.flatMap(room=>room.cells).find(cell=>cell.x===f.b.x+1),before=JSON.stringify(f.input);assert.ok(cell);assert.equal(buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[],0)[0].minX,f.b.x*T+.09);const hatch={linkId:'work-return-hatch',level:0,height:0,minX:f.b.x*T+.10,maxX:f.b.x*T+.30,minZ:cell.y*T-.10,maxZ:cell.y*T+.10},clipped=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[hatch],0);assert.ok(clipped.length>1);for(const part of clipped)assert.ok(part.maxX<=hatch.minX||part.minX>=hatch.maxX||part.maxZ<=hatch.minZ||part.minZ>=hatch.maxZ);
  const route=fixture(id,rotation,'exterior','roof-route'),upper=route.input.terrain.upperSurfaces.find(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&surface.x===cell.x&&surface.y===cell.y);assert.ok(upper);for(const point of [upper,{x:f.frame.door.x,y:f.frame.door.y,elevation:0}])assert.deepEqual(buildingFloorRectangles(f.b,f.input,point,T,[],0),[{minX:(point.x-.5)*T,maxX:(point.x+.5)*T,minZ:(point.y-.5)*T,maxZ:(point.y+.5)*T}]);assert.equal(JSON.stringify(f.input),before);f.dispose(f.build());route.dispose(route.build());
 }
});

test('existing shop signs, forge chimneys and depot piers or loft follow actual supports, flat roofs and ordinary disclosure after centring',()=>{
 for(const id of ids)for(const rotation of rotations)for(const roof of ['original','slab','terrace','roof-route']){
  const f=fixture(id,rotation,'exterior',roof),building=f.build();if(id==='pulperia'){const sign=building.getObjectByName(`building-detail:${f.b.id}:trade-sign`);assert.ok(sign);supportedSourceSign(f,building,sign);}if(id==='herreria'){const chimney=building.getObjectByName(`building-detail:${f.b.id}:forge-chimney`);assert.equal(Boolean(chimney),roof!=='roof-route');if(chimney)chimney.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});}if(id==='deposito'){assert.ok(building.getObjectByName(`building-detail:${f.b.id}:depot-masonry-piers`));for(const name of ['depot-loft-hatch','depot-loft-hoist'])assert.equal(Boolean(building.getObjectByName(`building-detail:${f.b.id}:${name}`)),roof==='original');}f.dispose(building);
 }
 for(const id of ids)for(const rotation of rotations)for(const view of ['partial','interior']){const f=fixture(id,rotation,view),building=f.build();for(const name of ['trade-sign','forge-chimney','depot-masonry-piers','depot-loft-hatch','depot-loft-hoist'])assert.equal(Boolean(building.getObjectByName(`building-detail:${f.b.id}:${name}`)),false);f.dispose(building);}
});
