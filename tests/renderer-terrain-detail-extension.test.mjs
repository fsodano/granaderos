import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {actBattle,visibleRooms} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createSceneTerrainCache} from '../game/scene-terrain.js';
const {Scene}=await import('../web/node_modules/three/build/three.module.js');
const {seeded}=await import('../web/lib/three/world-geometry.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {admittedActors,presentWorld}=await import('../web/lib/three/presentation.ts');
const rocks=[[3,5],[11,5],[17,9]],trees=[[10,9],[11,11],[12,9]],route=[[9,9],[10,10],[12,10],[14,10]],sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const oldFixtureSHA='c666648620fc95d19c4996e154d7081c87b9f45018e6f71be15db05d6f5b243a',oldTilesSHA='bd677768158fd82cd29e561802960c99921308e744c257f9a1e9c134fd04ec08';
function normalWorld(battle){const players=battle.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(battle)),entries=admittedActors(battle,players,revealed);return presentWorld(battle,createSceneTerrainCache()(battle),players,revealed,entries,0);}
function move(battle,x,y){const before=structuredClone(battle),next=actBattle(battle,{type:'move',unitId:'terrain-guard',x,y});assert.equal(next.lastError,null);assert.deepEqual(battle,before);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));const guard=next.units.find(unit=>unit.id==='terrain-guard');assert.equal(guard.x,x);assert.equal(guard.y,y);return next;}

test('six explicit terrain cells add valid seeded rocks and mature trees while exactly preserving the old snapshot',()=>{
 const battle=createRendererSandboxBattle('terrain-detail'),restored=structuredClone(battle);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
 assert.equal(battle.units.length,1);assert.equal(battle.units[0].id,'terrain-guard');assert.deepEqual([battle.units[0].x,battle.units[0].y],[8,8]);assert.equal(battle.seed,45);assert.equal(battle.width,20);assert.equal(battle.height,18);
 assert.equal(new Set(rocks.map(([x,y])=>seeded(x,y))).size,3);
 for(const [x,y]of rocks){const tile=battle.tiles.find(tile=>tile.x===x&&tile.y===y);assert.deepEqual(tile,{x,y,type:'stone',cover:40,blocked:true,elevation:0,material:'stone'});}
 for(const [x,y]of trees){const tile=battle.tiles.find(tile=>tile.x===x&&tile.y===y);assert.deepEqual(tile,{x,y,type:'forest',cover:15,blocked:false,elevation:0});assert.ok(seeded(x,y)>.2,'the existing renderer must choose a mature tree, not scrub');}
 for(const [x,y]of [...rocks,...trees]){const tile=restored.tiles.find(tile=>tile.x===x&&tile.y===y);tile.type='grass';tile.cover=0;tile.blocked=false;delete tile.material;}
 assert.equal(sha(restored),oldFixtureSHA,'only six terrain records may change; all actor, visibility and simulation fields stay exact');assert.equal(sha(restored.tiles),oldTilesSHA);
 const edited=new Set([...rocks,...trees].map(([x,y])=>`${x},${y}`));for(const tile of battle.tiles)if(!edited.has(`${tile.x},${tile.y}`))assert.deepEqual(tile,restored.tiles.find(old=>old.x===tile.x&&old.y===tile.y));
 const roads=battle.tiles.filter(tile=>tile.x===7||tile.x===8||tile.y===7||tile.y===8);assert.ok(roads.every(tile=>tile.type==='road'&&!tile.blocked));
 assert.ok(battle.tiles.filter(tile=>tile.material==='cobble'||tile.x>=1&&tile.x<=4&&tile.y>=9&&tile.y<=12).every(tile=>!tile.blocked),'original unblocked stone/cobble samples remain');
});

test('ordinary guard orders reject the rock cells and complete the canopy review route without changing terrain',()=>{
 let battle=createRendererSandboxBattle('terrain-detail');const tiles=structuredClone(battle.tiles);
 for(const [x,y]of rocks){const before=structuredClone(battle),rejected=actBattle(battle,{type:'move',unitId:'terrain-guard',x,y});assert.ok(rejected.lastError);assert.deepEqual(battle,before);assert.deepEqual([rejected.units[0].x,rejected.units[0].y],[8,8]);assert.deepEqual(rejected.tiles,tiles);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(rejected))));}
 for(const [x,y]of route){battle=move(battle,x,y);assert.deepEqual(battle.tiles,tiles);assert.equal(battle.mode,'exploration');}
});

test('normal admitted guard positions fade the mature canopies then restore them after movement completes',()=>{
 let battle=createRendererSandboxBattle('terrain-detail');const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:1.2360585147470482,assetUrl:x=>x});world.update(normalWorld(battle));
 const root=scene.getObjectByName('sector-world'),terrainIds=new Map(root.children.filter(node=>node.name.startsWith('terrain:')).map(node=>[node.name,node.uuid])),soft=()=>root.children.filter(node=>node.userData.kind==='vegetation').flatMap(node=>node.userData.softenedCells).sort();assert.deepEqual(soft(),[]);
 const expected=[['10,9'],['10,9','11,11'],['11,11','12,9'],[]];
 for(const [index,[x,y]]of route.entries()){
  battle=move(battle,x,y);const before=structuredClone(battle),input=normalWorld(battle);assert.deepEqual(battle,before,'presentation does not modify the real battle');assert.equal(input.admittedActorPoints.length,1);world.update(input);assert.deepEqual(soft(),expected[index]);
  for(const [name,uuid]of terrainIds)assert.equal(root.getObjectByName(name).uuid,uuid,'movement and foliage fade retain every terrain chunk');
  const leaves=root.children.filter(node=>node.userData.kind==='vegetation').flatMap(node=>node.children).filter(mesh=>['world:leaf','world:poplar'].includes(mesh.material.name));assert.ok(leaves.some(mesh=>mesh.material.opacity===.42)===Boolean(expected[index].length));
 }
 assert.deepEqual(world.inspect().assetErrors,[]);world.dispose();
});
