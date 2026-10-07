import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {worldItemKind}=await import('../web/lib/three/world-items.ts');
const T=1.2360585147470482;
const ground=(width=12,height=8)=>Array.from({length:width*height},(_,n)=>({x:n%width,y:Math.floor(n/width),type:'grass',elevation:0}));
const terrain=(overrides={})=>({width:12,height:8,tiles:ground(),...overrides});
const setup=input=>{const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});world.update(input);return {scene,world,root:scene.getObjectByName('sector-world')};};
function frozen(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}return value;}
function buildingInput({open=false,breached=false,rooms=false,upper=false}={}){
 const building={id:'house',x:1,y:1,width:5,height:5,kind:'house',rooms:rooms?[{id:'west',cells:[{x:2,y:2},{x:2,y:3},{x:2,y:4}]},{id:'east',cells:[{x:3,y:2},{x:4,y:2},{x:3,y:3},{x:4,y:3},{x:3,y:4},{x:4,y:4}]}]:[]};
 const tiles=ground().map(tile=>{
  if(tile.x<1||tile.x>5||tile.y<1||tile.y>5)return tile;
  const border=tile.x===1||tile.x===5||tile.y===1||tile.y===5;
  if(tile.x===3&&tile.y===5)return {...tile,type:breached?'rubble':'door',doorId:'entrance',buildingId:'house',blocked:!open&&!breached,open};
  return {...tile,type:border?'wall':'floor',blocked:border,buildingId:'house'};
 });
 const upperSurfaces=upper?Array.from({length:25},(_,n)=>({id:`roof-${n}`,x:1+n%5,y:1+Math.floor(n/5),type:'floor',kind:'roof',buildingId:'house',tacticalLevel:1,elevation:3,slabThickness:.2})):[];
 return {terrain:terrain({tiles,buildings:[building],upperSurfaces}),revealedRooms:[]};
}
function hit(object,x,y,z,dx,dy,dz){object.updateMatrixWorld(true);const ray=new Raycaster(new Vector3(x,y,z),new Vector3(dx,dy,dz).normalize(),0,2);return ray.intersectObject(object,true);}

test('sector world uses real meshes at authored cell/elevation coordinates without state mutation',()=>{
 const input=frozen({terrain:terrain({tiles:[{x:2,y:3,type:'dirt',elevation:1.7}],upperSurfaces:[{id:'platform',x:4,y:2,type:'floor',kind:'platform',tacticalLevel:1,elevation:3.4,slabThickness:.23}]})}),before=JSON.stringify(input),{root,world}=setup(input);
 const surface=root.getObjectByName('upper-surfaces'),bounds=new Box3().setFromObject(surface);
 assert.ok(Math.abs(bounds.max.y-3.4)<1e-5);assert.ok(Math.abs(bounds.min.y-3.17)<1e-5);assert.ok(Math.abs(bounds.getCenter(new Vector3()).x-4*T)<1e-5);assert.ok(Math.abs(bounds.getCenter(new Vector3()).z-2*T)<1e-5);
 assert.ok(world.inspect().triangles>2);root.traverse(object=>{if(object instanceof Mesh){assert.ok(object.geometry.getAttribute('normal'));assert.ok(object.geometry.getAttribute('uv'));for(const value of object.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));}});
 assert.equal(JSON.stringify(input),before);world.dispose();
});

test('current building door state creates a real opening, hinge, and breach',()=>{
 const closed=buildingInput(),{root,world}=setup(closed),x=3*T,z=(5+.4)*T,building=root.getObjectByName('building:house');
 const fabric=building.getObjectByName('building-fabric:house');assert.equal(hit(fabric,x,1,z+.7,0,0,-1).length,0,'fabric must have an actual doorway');
 assert.ok(hit(building.getObjectByName('door:entrance'),x,1,z+.7,0,0,-1).length>0,'closed leaf covers doorway');
 world.update(buildingInput({open:true}));assert.equal(hit(root.getObjectByName('door:entrance'),x,1,z+.7,0,0,-1).length,0,'open leaf swings clear');
 world.update(buildingInput({breached:true}));assert.equal(root.getObjectByName('door:entrance'),undefined);assert.equal(hit(root.getObjectByName('building-fabric:house'),x,1,z+.7,0,0,-1).length,0,'breach removes obsolete structure');world.dispose();
});

test('independent doors and windows have openings on both wall axes',()=>{
 for(const axis of ['x','y']){
  const tiles=[{x:3,y:3,type:'door',doorId:'gate',open:true,blocked:false},...[-1,1].map(n=>({x:3+(axis==='x'?n:0),y:3+(axis==='y'?n:0),type:'wall',blocked:true}))],{root,world}=setup({terrain:terrain({tiles})});
  assert.ok(root.getObjectByName('door:gate'));assert.equal(hit(root.getObjectByName('independent-walls'),3*T+(axis==='y'?.7:0),1,3*T+(axis==='x'?.7:0),axis==='y'?-1:0,0,axis==='x'?-1:0).length,0);world.dispose();
 }
});

test('roof cutaways remove only revealed rooms and preserve the selected upper level',()=>{
 const input=buildingInput({rooms:true,upper:true}),{world,root}=setup(input),all=root.getObjectByName('upper-surfaces').userData.surfaceIds.length;
 world.update({...input,revealedRooms:['west']});const partial=root.getObjectByName('upper-surfaces').userData.surfaceIds.length;assert.ok(partial>0&&partial<all);
 world.update({...input,revealedRooms:['west','east']});assert.equal(root.getObjectByName('upper-surfaces'),undefined);
 world.updateActors([{x:2,y:3,tacticalLevel:1,elevation:3}]);assert.deepEqual(root.getObjectByName('upper-surfaces').userData.surfaceIds,['roof-11']);
 world.update({...input,revealedRooms:['west','east'],cursorLevel:1});assert.equal(root.getObjectByName('upper-surfaces').userData.surfaceIds.length,all);assert.equal(root.getObjectByName('building:house').userData.cutawayRooms.length,0);world.dispose();
});

test('an upper room disclosure does not cut unopened ground rooms',()=>{
 const input=buildingInput({rooms:true,upper:true});input.terrain.buildings[0].rooms.push({id:'upper-room',tacticalLevel:1,cells:[{x:2,y:3,tacticalLevel:1}]});input.revealedRooms=['upper-room'];
 const {world,root}=setup(input);assert.equal(root.getObjectByName('building:house').userData.cutawayRooms.length,0);assert.equal(root.getObjectByName('upper-surfaces').userData.surfaceIds.length,25);world.dispose();
});

test('world admission removes stale objects and rejects gameplay rosters',()=>{
 const input={terrain:terrain({props:[{id:'chest',type:'chest',x:2,y:3}],lights:[{id:'fire',type:'campfire',x:3,y:3}]}),loot:[{id:'rifle',weapon:'musket',x:4,y:3}],cannons:[{id:'gun',type:'bronze4',x:5,y:3}],smoke:[{id:'cloud',x:6,y:3,radius:1}]},{world}=setup(input);
 for(const id of ['prop:chest','light:fire','loot:rifle','cannon:gun','smoke:cloud'])assert.ok(world.inspect().semanticIds.includes(id));
 world.update({terrain:terrain()});assert.equal(world.inspect().semanticIds.length,0);assert.equal(world.anchor('gun','muzzle'),null);
 assert.throws(()=>world.update({terrain:terrain(),units:[]}),/roster/);assert.throws(()=>world.update({terrain:{...terrain(),npcs:[]}}),/roster/);world.dispose();
});

test('prop footprints and upper-level item/light heights remain authoritative',()=>{
 const props=['table','bench','bed','chest','barrels','hay','cart','hearth','washstand','shelf','pottery','sacks','rug','candle','rubble','broken-timber'].map((type,n)=>({id:type,type,x:n%6,y:Math.floor(n/6),tacticalLevel:1,elevation:3,footprint:{width:1,height:1}}));
 const {world,root}=setup({terrain:terrain({props}),loot:[{id:'upper',x:8,y:3,tacticalLevel:1,elevation:3,items:[{weapon:'musket'},{weapon:'pistol'},{blade:'sabre'}]}]});
 assert.equal(world.inspect().semanticIds.filter(id=>id.startsWith('prop:')).length,16);assert.ok(new Box3().setFromObject(root.getObjectByName('loot:upper')).min.y>=3);
 assert.deepEqual(root.getObjectByName('loot:upper').userData.itemKinds,['musket','pistol','sabre']);world.dispose();
 const wide=setup({terrain:terrain({props:[{id:'bed',type:'bed',x:2,y:3,footprint:{width:3,height:1},rotation:90}]})}),bounds=new Box3().setFromObject(wide.root.getObjectByName('props:0:0,0'));
 assert.ok(bounds.min.x>=(2-.5)*T&&bounds.max.x<=(4+.5)*T);assert.ok(bounds.min.z>=(3-.5)*T&&bounds.max.z<=(3+.5)*T);wide.world.dispose();
});

test('cannon muzzle anchors respect authored position, elevation, and facing',()=>{
 const {world}=setup({terrain:terrain(),cannons:[{id:'gun',type:'field8',x:4,y:2,tacticalLevel:1,elevation:3,facing:Math.PI*.5,loaded:true}]});
 const muzzle=world.anchor('gun','muzzle'),forward=world.anchor('gun','muzzleForward'),direction=forward.clone().sub(muzzle).normalize();assert.ok(Math.abs(direction.x)<1e-6);assert.ok(Math.abs(direction.y)<1e-6);assert.ok(direction.z>.999);assert.ok(Math.abs(muzzle.x-4*T)<1e-6);assert.ok(muzzle.y>3);world.dispose();
});

test('actor cutaways leave terrain/buildings stable; unchanged updates reuse geometry',()=>{
 const input={terrain:terrain({tiles:ground().map(tile=>tile.x===3&&tile.y===3?{...tile,type:'forest'}:tile)}),admittedActorPoints:[]},{root,world}=setup(input),terrainUuid=root.getObjectByName('terrain:0,0').uuid,vegetationUuid=root.getObjectByName('vegetation:0,0').uuid;
 world.update(input);assert.equal(root.getObjectByName('terrain:0,0').uuid,terrainUuid);assert.equal(root.getObjectByName('vegetation:0,0').uuid,vegetationUuid);
 world.updateActors([{x:3.1,y:3.1}]);assert.equal(root.getObjectByName('terrain:0,0').uuid,terrainUuid);assert.notEqual(root.getObjectByName('vegetation:0,0').uuid,vegetationUuid);
 const soft=root.getObjectByName('vegetation:0,0').uuid;world.updateActors([{x:3.2,y:3.2}]);assert.equal(root.getObjectByName('vegetation:0,0').uuid,soft);world.dispose();
});

test('world disposal releases every retained mesh/material once and detaches the scene',()=>{
 const {world,root,scene}=setup({terrain:terrain({props:[{id:'cart',type:'cart',x:2,y:2}],lights:[{id:'torch',type:'torch',x:2,y:3}]}),cannons:[{id:'gun',type:'swivel',x:3,y:3}]}),geometries=new Set(),materials=new Set();let geometryDisposals=0,materialDisposals=0;
 root.traverse(object=>{if(object instanceof Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
 for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
 world.dispose();world.dispose();assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size);assert.equal(scene.getObjectByName('sector-world'),undefined);assert.equal(world.inspect().disposed,true);assert.throws(()=>world.update({terrain:terrain()}),/disposed/);
});

test('all current architectural profiles retain distinct real massing',()=>{
 const kinds=['house','posta','barracks','church','chapel','cabildo','townhall','palace','pulperia','warehouse','depot','farmhouse','smithy','stable'],heights=new Map();
 for(const kind of kinds){
  const input=buildingInput();input.terrain.buildings[0].kind=kind;const {world,root}=setup(input),building=root.getObjectByName('building:house'),bounds=new Box3().setFromObject(building);heights.set(kind,bounds.max.y);
  assert.ok(world.inspect().triangles>100);assert.ok(bounds.max.y>2.5);building.traverse(object=>{if(object instanceof Mesh)for(const value of object.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));});world.dispose();
 }
 assert.ok(heights.get('church')>heights.get('house')+1.3);assert.ok(heights.get('palace')>heights.get('house')+.7);assert.ok(heights.get('smithy')>heights.get('house'));
});

test('numeric and authored ground equipment IDs render the proper weapon families',()=>{
 const expected=['brown-bess','charleville','baker-rifle','cavalry-carbine','shotgun','saddle-pistol','duelling-pistol','blunderbuss','double-pistol','curved-sabre','caroya-sabre','socket-bayonet','lance','facon'];
 assert.deepEqual(expected.map((_,n)=>worldItemKind({weapon:1800+n})),expected);assert.equal(worldItemKind({weapon:'authored-id',weaponMetadata:{contentWeapon:{template:1802}}}),'baker-rifle');assert.equal(worldItemKind({item:'weapon',itemMetadata:{contentWeapon:{template:1808}}}),'double-pistol');
 const {world,root}=setup({terrain:terrain(),loot:expected.map((_,n)=>({id:String(n),weapon:1800+n,x:n%7,y:Math.floor(n/7)}))});
 for(const [n,kind]of expected.entries())assert.deepEqual(root.getObjectByName(`loot:${n}`).userData.itemKinds,[kind]);
 const musket=new Box3().setFromObject(root.getObjectByName('loot:0')).getSize(new Vector3()).length(),pistol=new Box3().setFromObject(root.getObjectByName('loot:5')).getSize(new Vector3()).length();assert.ok(musket>pistol*2);world.dispose();
});

test('climbing geometry resolves endpoint heights from exact authored surfaces',()=>{
 const {world,root}=setup({terrain:terrain({tiles:ground().map(tile=>tile.x===1&&tile.y===2?{...tile,elevation:.4}:tile),upperSurfaces:[{id:'platform',x:2,y:2,type:'floor',kind:'platform',tacticalLevel:1,elevation:4.2}],climbLinks:[{id:'access',kind:'climb',from:{x:1,y:2},to:{x:2,y:2,tacticalLevel:1}}]})}),bounds=new Box3().setFromObject(root.getObjectByName('climb-links'));
 assert.ok(bounds.max.y>4.19&&bounds.max.y<4.3);assert.ok(bounds.min.y>.3);world.dispose();
});

test('climbing geometry refreshes after endpoint heights change without moving saved cells',()=>{
 const input={terrain:terrain({upperSurfaces:[{id:'roof',x:3,y:3,type:'floor',kind:'roof',tacticalLevel:1,elevation:3,slabThickness:.2}],climbLinks:[{id:'ladder',kind:'climb',from:{x:2,y:3},to:{x:3,y:3,tacticalLevel:1}}]})},{root,world}=setup(input);
 const initial=root.getObjectByName('climb-links'),before=new Box3().setFromObject(initial);
 const raised={...input,terrain:{...input.terrain,upperSurfaces:input.terrain.upperSurfaces.map(surface=>({...surface,elevation:4.2}))}};
 world.update(raised);const changed=root.getObjectByName('climb-links');assert.notEqual(changed.uuid,initial.uuid);assert.ok(new Box3().setFromObject(changed).max.y>before.max.y+1.19);
 world.update(raised);assert.equal(root.getObjectByName('climb-links').uuid,changed.uuid,'unchanged endpoint heights retain geometry');
 const groundRaised={...raised,terrain:{...raised.terrain,tiles:raised.terrain.tiles.map(tile=>tile.x===2&&tile.y===3?{...tile,elevation:.4}:tile)}};
 world.update(groundRaised);assert.notEqual(root.getObjectByName('climb-links').uuid,changed.uuid);assert.ok(new Box3().setFromObject(root.getObjectByName('climb-links')).min.y>.36);world.dispose();
});

test('light extinction removes illumination emitters while smoke expiry removes its volumes',()=>{
 const input={terrain:terrain({lights:[{id:'fire',x:2,y:2,type:'campfire',intensity:1,radius:4}]}),smoke:[{id:'smoke',x:3,y:2,radius:2,turns:3}]},{world,root}=setup(input);let emitters=0;root.traverse(object=>{if(object.isPointLight)emitters++;});assert.equal(emitters,1);
 const terrainUuid=root.getObjectByName('terrain:0,0').uuid;world.tick(.016,2);assert.equal(root.getObjectByName('terrain:0,0').uuid,terrainUuid);
 world.update({terrain:{...input.terrain,lights:[{...input.terrain.lights[0],extinguished:true}]},smoke:[{...input.smoke[0],turns:0}]});emitters=0;root.traverse(object=>{if(object.isPointLight)emitters++;});assert.equal(emitters,0);assert.equal(root.getObjectByName('smoke:smoke'),undefined);world.dispose();
});
