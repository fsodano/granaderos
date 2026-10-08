import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation=0,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('pulperia',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 const bounds=node=>{const box=new Box3();node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++){const dx=p.getX(n)/T-frame.origin.x,dz=p.getZ(n)/T-frame.origin.y;box.expandByPoint(new Vector3(dx*frame.u.x+dz*frame.u.y,p.getY(n),dx*frame.v.x+dz*frame.v.y));}}});return box;};
 return {b,input,frame,point,bounds,sign:building=>building.getObjectByName(`building-detail:${b.id}:trade-sign`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before,'decoration must not change gameplay state');return building;},dispose(node){disposeWorldNode(node);geometry.dispose();materials.dispose();}};
}
function sourceSign(f){let result;const visit=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.key==='shop-sign')result=node;visit(node.props?.children);};for(const entry of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(entry.node);assert.ok(result,'read the actual retained sprite sign');return result;}
function contained(f,sign){sign.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');for(let n=0;n<p.count;n++){assert.ok([p.getX(n),p.getY(n),p.getZ(n),normals.getX(n),normals.getY(n),normals.getZ(n)].every(Number.isFinite));assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','complete board, bracket and strokes remain over an intact wall cell');}}});}

test('authored shop plaque follows the actual sprite proportions, timber bracket and pale mark colours at four rotations',()=>{
 const reference=fixture(),source=sourceSign(reference),children=source.props.children,board=children.find(child=>child.type==='rect'),paths=children.filter(child=>child.type==='path');assert.equal(paths[0].props.d,'M0,0v10m0,-6h-14v4');assert.equal(paths[1].props.d,'M-17,14h6m-5,-3v6m4,-6v6');
 for(const rotation of rotations){const f=fixture(rotation),building=f.build(),sign=f.sign(building);assert.ok(sign);const nativeBoard=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:board`),bounds=f.bounds(nativeBoard),anchor=Math.max(.4,f.frame.doorU-1.35);assert.ok(Math.abs(bounds.min.x-(anchor-board.props.x/26-board.props.width/26))<1e-5);assert.ok(Math.abs(bounds.max.x-(anchor-board.props.x/26))<1e-5);assert.ok(Math.abs((bounds.max.x-bounds.min.x)-board.props.width/26)<1e-5);assert.ok(Math.abs((bounds.max.y-bounds.min.y)-board.props.height/V)<1e-5);
  const expected={'world:pulperia-sign-board':board.props.fill,'world:pulperia-sign-edge':board.props.stroke,'world:pulperia-sign-bracket':paths[0].props.stroke,'world:pulperia-sign-mark':paths[1].props.stroke};sign.traverse(mesh=>{if(mesh instanceof Mesh){assert.equal(mesh.material.color.getHexString(),expected[mesh.material.name].slice(1));assert.equal(mesh.material.map,null,'the sprite uses flat local pigment, not a newly multiplied world wood texture');}});for(const side of [-1,1]){const marks=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:face-${side}`).children.find(mesh=>mesh.material.name==='world:pulperia-sign-mark');assert.equal(marks.geometry.getAttribute('position').count,3*36,'both sides carry exactly two vertical marks and one crossbar');}contained(f,sign);f.dispose(building);
 }reference.dispose(reference.build());
});

test('plaque is physically in front of the source porch at ordinary standing height and its bracket joins the beam',()=>{
 for(const rotation of rotations){const f=fixture(rotation),building=f.build(),sign=f.sign(building),board=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:board`),support=Math.round(Math.max(.4,f.frame.doorU-1.35)+14/26),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),ray=new Raycaster(f.point(support,-1,1.8),out.clone().negate(),0,T*1.6),plaque=ray.intersectObject(board,true)[0],porch=building.getObjectByName(`building-detail:${f.b.id}:gallery`),shaft=ray.intersectObject(porch,true)[0];assert.ok(plaque&&shaft);assert.ok(shaft.distance-plaque.distance>.06,'the plaque cannot be buried behind the exposed porch shaft');const bracket=sign.getObjectByName(`building-pulperia-sign:${f.b.id}:bracket`),bounds=f.bounds(bracket),low=Math.max(2.12,building.userData.height*.72);assert.ok(bounds.min.z<-.47&&bounds.max.z>-.321);const r=new Raycaster(f.point(Math.max(.4,f.frame.doorU-1.35),-.32,low),new Vector3(0,-1,0),0,.035);assert.ok(r.intersectObject(bracket,true).length,'short timber return reaches the existing beam');contained(f,sign);f.dispose(building);}
});

function aperturesClear(f,building,sign){
 for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&['door','window'].includes(tile.type))){
  const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,face=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),id=tile.doorId??`${tile.type}:${tile.x},${tile.y}`,opening=building.userData.openings.find(record=>record.id===id),half=opening.width*.5-.015;
  assert.ok(half>0);for(const y of tile.type==='door'?[.3,1.3,1.8,1.9]:[1.3])for(const startOffset of [-.30,0,.30])for(const targetOffset of [-half,0,half]){
   const start=onX?new Vector3((tile.x+face)*T,y,tile.y*T+startOffset):new Vector3(tile.x*T+startOffset,y,(tile.y+face)*T),target=onX?new Vector3(tile.x*T,y,tile.y*T+targetOffset):new Vector3(tile.x*T+targetOffset,y,tile.y*T),direction=target.clone().sub(start).normalize();
   assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(sign,true).length,0,`sign obstructs the ${tile.type} approach or sight ray`);
  }
 }
}

test('source sign preserves actual aperture-width standing approach and oblique sight rays at four rotations',()=>{
 for(const rotation of rotations){const f=fixture(rotation);for(const tile of f.input.terrain.tiles)if(tile.type==='door')tile.open=true;const building=f.build();aperturesClear(f,building,f.sign(building));f.dispose(building);}
});

test('the safety probe rejects the same complete plaque moved across the real standing doorway',()=>{
 for(const rotation of rotations){const f=fixture(rotation),building=f.build(),obstructing=f.sign(building).clone(),center=Math.max(.4,f.frame.doorU-1.35)+14/26,offset=(f.frame.doorU-center)*T;obstructing.position.set(f.frame.u.x*offset,0,f.frame.u.y*offset);obstructing.updateMatrixWorld(true);assert.throws(()=>aperturesClear(f,building,obstructing),/sign obstructs the door approach or sight ray/);f.dispose(building);}
});

test('an edited sign support or front corner omits the entire authored plaque without changing openings or selecting another wall',()=>{
 for(const rotation of rotations)for(const location of ['support','corner'])for(const type of ['door','window','rubble']){const f=fixture(rotation),u=location==='corner'?0:Math.round(Math.max(.4,f.frame.doorU-1.35)+14/26),p=f.frame.at(u,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build();assert.equal(f.sign(building),undefined);f.dispose(building);}
});

test('authored plaque follows real slabs and terraces, ordinary room cutaways and occupied upper-route exclusions',()=>{
 for(const rotation of rotations){for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),sign=f.sign(building);assert.ok(sign);assert.ok(new Box3().setFromObject(sign).max.y<building.userData.height-.05);contained(f,sign);const bracket=f.bounds(sign.getObjectByName(`building-pulperia-sign:${f.b.id}:bracket`));assert.ok(Math.abs(bracket.max.y-(Math.max(2.12,building.userData.height*.72)+4/V))<1e-5,'bracket stays joined to its actual raised porch rather than the original projected wall height');f.dispose(building);}
  for(const blocked of [false,true]){const f=fixture(rotation),p=f.frame.at(2,0);f.input.terrain.upperSurfaces=[{...p,type:'floor',kind:'platform',tacticalLevel:1,elevation:2.05,blocked,buildingId:f.b.id}];const building=f.build();assert.equal(Boolean(f.sign(building)),blocked);f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(f.sign(building),undefined);f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const building=short.build();assert.equal(short.sign(building),undefined);short.dispose(building);
 }
});

test('local sign retains ordinary illumination while unpainted legacy shops keep their released generic sign',()=>{
 for(const rotation of rotations){const f=fixture(rotation);f.input.terrain.night=true;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),sign=f.sign(building);sign.traverse(mesh=>{if(mesh instanceof Mesh){const colours=mesh.geometry.getAttribute('color');for(let n=0;n<colours.count;n++)for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(colours[channel](n)-(.27+.73*.5))<1e-6);}});f.dispose(building);
  const legacy=fixture(rotation);legacy.b.architecture=legacy.b.kind;legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const old=legacy.build(),generic=legacy.sign(old);assert.ok(generic?.children.some(mesh=>mesh.material.name==='world:iron'));assert.equal(generic.getObjectByName(`building-pulperia-sign:${legacy.b.id}:board`),undefined);legacy.dispose(old);
 }
});


test('a missing or occupied porch never leaves a floating source bracket on a surviving sign cell',()=>{
 for(const rotation of rotations)for(const route of [false,true]){const f=fixture(rotation),p=f.frame.at(4,0);if(route)f.input.terrain.upperSurfaces=[{...p,type:'floor',kind:'platform',tacticalLevel:1,elevation:2.05,blocked:false,buildingId:f.b.id}];else f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='window';const building=f.build();assert.equal(building.getObjectByName(`building-detail:${f.b.id}:gallery`),undefined);assert.equal(f.sign(building),undefined);f.dispose(building);}
});
