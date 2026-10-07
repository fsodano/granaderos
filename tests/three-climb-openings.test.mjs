import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {VERTICAL_CLIMB_HATCH} from '../game/climb-geometry.js';
const {Scene,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {subtractRectangle,climbOpenings,surfaceRectangles}=await import('../web/lib/three/world-climb-openings.ts');
const T=1.2360585147470482;
const area=rect=>(rect.maxX-rect.minX)*(rect.maxZ-rect.minZ);
function fixture(height=3,thickness=.2){
 const tiles=Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',elevation:0,blocked:false})),upperSurfaces=Array.from({length:9},(_,i)=>({id:`upper-${i}`,x:2+i%3,y:2+Math.floor(i/3),type:'floor',kind:'roof',buildingId:'review',tacticalLevel:1,elevation:height,slabThickness:thickness,blocked:false}));
 return {admittedActorPoints:[{x:3,y:3,activeClimbLink:'hatch'}],terrain:{width:8,height:8,tiles,upperSurfaces,buildings:[{id:'review',kind:'house',x:1,y:1,width:5,height:5,rooms:[{id:'upper-room',tacticalLevel:1,cells:upperSurfaces.map(({x,y,tacticalLevel})=>({x,y,tacticalLevel}))}]}],climbLinks:[{id:'hatch',kind:'climb',from:{x:3,y:3},to:{x:3,y:3,tacticalLevel:1}}]},revealedRooms:['upper-room']};
}
function setup(input){const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});world.update(input);return {world,root:scene.getObjectByName('sector-world')};}
function floorHits(root,height,across,forward){root.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(3*T+across,height+.30,3*T+forward),new Vector3(0,-1,0),0,.55);return ['upper-surfaces','building-fabric:review','climb-covers'].flatMap(name=>root.getObjectByName(name)?ray.intersectObject(root.getObjectByName(name),true):[]);}

test('rectangle subtraction preserves uncovered area without overlapping fragments',()=>{
 const rect={minX:0,maxX:2,minZ:0,maxZ:2},cut={minX:.4,maxX:1.5,minZ:.7,maxZ:1.8},parts=subtractRectangle(rect,cut);
 assert.equal(parts.length,4);assert.ok(Math.abs(parts.reduce((sum,part)=>sum+area(part),0)+area(cut)-area(rect))<1e-10);
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)assert.ok(Math.min(parts[i].maxX,parts[j].maxX)<=Math.max(parts[i].minX,parts[j].minX)||Math.min(parts[i].maxZ,parts[j].maxZ)<=Math.max(parts[i].minZ,parts[j].minZ));
 assert.deepEqual(subtractRectangle(rect,{minX:-1,maxX:3,minZ:-1,maxZ:3}),[]);assert.deepEqual(subtractRectangle(rect,{minX:2,maxX:3,minZ:0,maxZ:1}),[rect]);
});

test('vertical access cuts the complete measured aperture through adjacent slabs and disclosed room floors',()=>{
 for(const height of [2,3,4.2])for(const thickness of [.12,.20,.35]){
  const input=fixture(height,thickness),before=JSON.stringify(input),{root,world}=setup(input),h=VERTICAL_CLIMB_HATCH;
  for(const x of [h.minAcross+.03,0,h.maxAcross-.03])for(const z of [h.minForward+.03,-.65,h.maxForward-.03])assert.equal(floorHits(root,height,x,z).length,0,`${height} m slab/floor fills the actual body aperture at ${x},${z}`);
  for(const x of [-.20,.20])for(const z of [-.123,.147,.32])assert.ok(floorHits(root,height,x,z).length>0,'saved heels and the roof landing retain real support');
  const upper=root.getObjectByName('upper-surfaces');assert.equal(upper.userData.surfaceIds.length,9);
  let volume=0;upper.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const a=new Vector3().fromBufferAttribute(p,i),b=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2);volume+=a.dot(b.cross(c))/6;}});
  assert.ok(Math.abs(Math.abs(volume)-(9*T*T-area({minX:h.minAcross,maxX:h.maxAcross,minZ:h.minForward,maxZ:h.maxForward}))*thickness)<1e-4,'slab fragments retain their actual closed volume');
  assert.equal(JSON.stringify(input),before);world.dispose();
 }
});

test('vertical opening edits invalidate slab and room-floor caches and leave ordinary access unchanged',()=>{
 const input=fixture(),{root,world}=setup(input),upper=root.getObjectByName('upper-surfaces'),building=root.getObjectByName('building:review');
 world.update(input);assert.equal(root.getObjectByName('upper-surfaces').uuid,upper.uuid);assert.equal(root.getObjectByName('building:review').uuid,building.uuid);
 const closed={...input,terrain:{...input.terrain,climbLinks:[]}};world.update(closed);assert.notEqual(root.getObjectByName('upper-surfaces').uuid,upper.uuid);assert.notEqual(root.getObjectByName('building:review').uuid,building.uuid);assert.ok(floorHits(root,3,0,-.45).length>0);
 const cardinal={...input,terrain:{...input.terrain,climbLinks:[{...input.terrain.climbLinks[0],from:{x:2,y:3}}]}};world.update(cardinal);assert.ok(floorHits(root,3,0,-.45).length>0);assert.deepEqual(climbOpenings(cardinal,T),[]);world.dispose();
});

test('openings match only the exact authored level and height and never modify lower floors',()=>{
 const input=fixture(),openings=climbOpenings(input,T);assert.equal(openings.length,1);
 for(const surface of [{x:3,y:3,elevation:0},{x:3,y:3,tacticalLevel:2,elevation:3},{x:3,y:3,tacticalLevel:1,elevation:3.5}])assert.equal(surfaceRectangles(surface,T,openings).length,1);
 assert.ok(surfaceRectangles({x:3,y:2,tacticalLevel:1,elevation:3},T,openings).length>1,'the rear cell also contains the measured opening');
});


test('idle covers support ordinary roof walking and only the current admitted link opens them',()=>{
 const input=fixture(),{root,world}=setup({...input,admittedActorPoints:[]}),cover=()=>root.getObjectByName('climb-cover:hatch');
 const before=JSON.stringify(input);assert.equal(cover().userData.open,false);
 assert.ok(floorHits(root,3,0,-.45).some(hit=>Math.abs(hit.point.y-3)<1e-6),'closed cover is flush with the walking surface');
 const closed=cover().uuid;world.updateActors([{x:3,y:3}]);assert.equal(cover().uuid,closed,'unmodified state keeps the same mesh');
 world.updateActors([{x:3,y:3,activeClimbLink:'unknown'}]);assert.equal(cover().uuid,closed,'another link cannot open this cover');
 world.updateActors([{x:3,y:3,activeClimbLink:'hatch'}]);assert.equal(cover().userData.open,true);assert.equal(floorHits(root,3,0,-.45).length,0);
 const raised=cover().uuid;world.updateActors([{x:3.1,y:3.1,activeClimbLink:'hatch'}]);assert.equal(cover().uuid,raised,'visible movement does not rebuild a raised cover');
 world.updateActors([{x:3,y:3,tacticalLevel:1,elevation:3}]);assert.equal(cover().userData.open,false);assert.ok(floorHits(root,3,0,-.45).length>0,'the final pose restores walking support');
 world.update({...input,terrain:{...input.terrain,climbLinks:[]},admittedActorPoints:[]});assert.equal(cover(),undefined,'deleted access removes the cover');assert.equal(JSON.stringify(input),before);world.dispose();
});
