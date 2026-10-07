import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270],sourceSlats=[8,13,18,23,28,33];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('caballeriza',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3((p.x+.4)*T,y,(p.y+.4)*T);};
 const local=p=>({u:(p.x/T-.4-frame.origin.x)*frame.u.x+(p.z/T-.4-frame.origin.y)*frame.u.y,v:(p.x/T-.4-frame.origin.x)*frame.v.x+(p.z/T-.4-frame.origin.y)*frame.v.y,y:p.y});
 return {b,input,frame,point,local,feature:(building,name='stable-ventilation')=>building.getObjectByName(`building-detail:${b.id}:${name}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before,'scenery must not edit the compiled battle');return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
const vertices=(f,mesh)=>{const p=mesh.geometry.getAttribute('position');return Array.from({length:p.count},(_,n)=>f.local(new Vector3(p.getX(n),p.getY(n),p.getZ(n))));};
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<2e-5,`${message}: ${actual} vs ${expected}`);

test('the actual stable vent follows the broad current sprite triangle within the real gable at every rotation',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),height=building.userData.height,rise=Math.min(getBuildingProfile(f.b).roofRise/V,Math.max(.4,f.frame.width*.28)),center=f.frame.width*.5,half=.45*(f.frame.width-.8),bottom=height+2/V,top=height+rise-3/V;assert.ok(node);
  const panel=node.children.find(mesh=>mesh.material.name==='world:stable-loft-shadow'),points=vertices(f,panel).sort((a,b)=>a.u-b.u);assert.equal(panel.material.color.getHexString(),'594c35');assert.equal(points.length,3);near(points[0].u,center-half,'left gable endpoint');near(points[0].y,bottom,'vent base');near(points[1].u,center,'vent peak centre');near(points[1].y,top,'vent peak follows real roof rise');near(points[2].u,center+half,'right gable endpoint');assert.ok(half*2>f.frame.width*.75,'the vent must cover the broad gable shown by the current sprite');
  node.traverse(mesh=>{if(mesh instanceof Mesh)for(const p of vertices(f,mesh)){assert.ok(Number.isFinite(p.u+p.v+p.y));assert.ok(p.y<=height+rise*(1-Math.abs(p.u-center)/center)+1e-5,'the timber frame must fit within the actual masonry gable');assert.ok(p.y<height+rise-.05,'the roof ridge must remain above the vent');assert.ok(p.v<0&&p.v>-.14,'the front detail must stay joined to its existing gable');}});
  assert.ok(f.feature(building,'stable-timber-frame'),'existing load-bearing timber details must remain');f.dispose(building);
 }
});

test('six separate stable slats retain the measured current source spacing, heights and timber pigment',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building),slats=node.children.find(mesh=>mesh.material.name==='world:stable-loft-timber'),height=building.userData.height,rise=getBuildingProfile(f.b).roofRise/V,span=f.frame.width-.8,points=vertices(f,slats);assert.equal(slats.material.color.getHexString(),'ac9467');assert.equal(slats.material.map,null,'the source slat pigment must not multiply the shared diffuse timber map');
  const groups=sourceSlats.map(x=>({u:.4+x/40*span,points:[],x}));
  for(const p of points){const group=groups.reduce((a,b)=>Math.abs(a.u-p.u)<Math.abs(b.u-p.u)?a:b);assert.ok(Math.abs(group.u-p.u)<=.6/V/T+1e-5);group.points.push(p);}
  for(const {x,u,points:part}of groups){assert.ok(part.length>0,'each of the six source slats must have physical geometry');near((Math.min(...part.map(p=>p.u))+Math.max(...part.map(p=>p.u)))*.5,u,'slat centre');near(Math.min(...part.map(p=>p.y)),height+3/V,'slat bottom');near(Math.max(...part.map(p=>p.y)),height+2/V+(rise-7/V)*(1-Math.abs(x-20)/18),'slat top');}
  f.dispose(building);
 }
});

test('stable ventilation omits real flat roofs and usable upper surfaces while retaining blocked and distant surfaces',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build();assert.equal(Boolean(f.feature(building)),false,`${rotation}/${roof}: flat roofs cannot have a pitched vent`);assert.ok(f.feature(building,'stable-timber-frame'));f.dispose(building);}
  for(const mode of ['blocked','walking','ground','distant']){
   const f=fixture(rotation),p=f.frame.at(Math.round(f.frame.width*.5),mode==='distant'?f.frame.depth+3:0);f.input.terrain.upperSurfaces=[{...p,type:'floor',kind:'platform',tacticalLevel:mode==='ground'?0:1,elevation:3.3,blocked:mode==='blocked',buildingId:f.b.id}];const building=f.build();assert.equal(Boolean(f.feature(building)),mode!=='walking',`${rotation}/${mode}: only a usable overlapping upper surface must exclude the vent`);f.dispose(building);
  }
 }
});

test('the stable vent preserves ordinary room disclosure, authored finishes and a standing body through the door',()=>{
 for(const rotation of rotations){
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false,'normal room disclosure must remove the exterior gable scenery');f.dispose(building);}
  const f=fixture(rotation),door=f.input.terrain.tiles.find(tile=>tile.x===f.frame.door.x&&tile.y===f.frame.door.y);door.open=true;const before=JSON.stringify(f.b),building=f.build();assert.equal(JSON.stringify(f.b),before);assert.ok(building.getObjectByName(`building-fabric:${f.b.id}`).children.some(mesh=>mesh.material.name===`world:${f.b.wallFinish}`));
  for(const y of [1.3,1.8])for(const offset of [-.20,0,.20]){
   const start=new Vector3((door.x-f.frame.v.x)*T+offset*f.frame.u.x,y,(door.y-f.frame.v.y)*T+offset*f.frame.u.y),direction=new Vector3(f.frame.v.x,0,f.frame.v.y);assert.equal(new Raycaster(start,direction,0,2*T).intersectObject(building,true).length,0,`${rotation}/${y}/${offset}: the standing door route must stay clear`);
  }f.dispose(building);
 }
});
