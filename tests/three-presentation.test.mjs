import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,visibleRooms,canSee} from '../game/tactical.js';
import {buildSectorMap} from '../game/maps.js';import {buildTerrace} from '../game/buildings.js';import {OPERATIVES} from '../game/data.js';import {propBlocksAt} from '../game/props.js';
import {relativeBodyHeight} from '../game/sight-geometry.js';
const {admittedActors,presentActors,presentWorld,actorItems}=await import('../web/lib/three/presentation.ts');
const {createSceneTerrainCache}=await import('../game/scene-terrain.js');
function floor(){return createBattle([{id:'one',x:2,y:2,skinTone:'dark',weapon:1800,blade:1810,activeSlot:'primary'}],{width:12,height:12,tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],exploration:true});}

test('actor renderer records preserve game state and the shared body-height contract',()=>{
 const state=floor(),players=state.units.filter(u=>u.side==='player'),revealed=new Set(visibleRooms(state)),before=structuredClone(state),entries=admittedActors(state,players,revealed);
 for(const stance of ['standing','crouched','prone'])for(const skin of ['light','brown','dark']){
  const copy={...state,units:state.units.map(unit=>({...unit,stance,skinTone:skin}))},actors=presentActors(copy,admittedActors(copy,copy.units,revealed),{},revealed);
  assert.equal(actors.length,1);assert.equal(actors[0].skin,skin);assert.equal(actors[0].posture,stance);
  for(const part of ['head','torso','legs','muzzle'])assert.equal(actors[0].bodyHeights[part],relativeBodyHeight(copy.units[0],part));
 }
 presentWorld(state,createSceneTerrainCache()(state),players,revealed,entries,0);assert.deepEqual(state,before);
});
test('real hand ownership supplies held, dropped and stowed equipment',()=>{
 const unit={weapon:1800,blade:1810,offHand:{weapon:1805},activeSlot:'primary'};
 assert.equal(actorItems(unit).find(item=>item.id==='1800').socket,'handRight');assert.ok(!actorItems(unit).some(item=>item.socket==='handLeft'));
 const pistol={...unit,activeSlot:'offhand',leftHandItem:'blade'};
 assert.equal(actorItems(pistol).find(item=>item.id==='1805').socket,'handRight');assert.equal(actorItems(pistol).find(item=>item.id==='1810').socket,'handLeft');assert.equal(actorItems(pistol).find(item=>item.id==='1800').socket,'back');
 assert.ok(!actorItems({...unit,weaponDropped:true}).some(item=>item.id==='1800'));
});
test('inventory identity remains separate from its rendered equipment kind',()=>{
 const records=[
  [{kind:'grenade',grenadeType:'arsenal',count:1},'grenade'],
  [{kind:'ammunition',ammoType:'ammoMusket',count:8},'ammunition'],
  [{itemType:'tool',toolKey:'crowbar',count:1},'crowbar'],
  [{kind:'outfit',outfit:'poncho',count:1},'item'],
  [{id:'letter-from-command',name:'Carta',count:1},'item'],
  [{weapon:1805,contentWeapon:{id:'authored-pistol',template:1805},count:1},'1805'],
 ];
 for(const [record,expected]of records){const unit={activeSlot:'item',activeItem:'inventory:custom-key',inventory:{'custom-key':record}};assert.equal(actorItems(unit)[0].id,expected);assert.equal(actorItems(unit)[0].reference,'inventory:custom-key');}
});
test('preserved-facing lateral movement selects anatomical left or right without rotating the unit',()=>{
 const state=floor(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor},before=structuredClone(actor);
 for(const [travelX,expected]of [[1,'strafeLeft'],[-1,'strafeRight']]){
  const rendered=presentActors(state,[entry],{'unit:one':{x:2.5,y:2,direction:5,moving:true,travelX,travelY:0}},new Set())[0];
  assert.equal(rendered.action,expected);assert.equal(rendered.yaw,0);
 }
 assert.deepEqual(actor,before);
});
test('hidden roof actors and dynamic objects never cross the renderer boundary',()=>{
 const map=buildSectorMap({sector:'tucuman',compactLayout:true,squad:[OPERATIVES[0]],enemies:[],exploration:true}),building=map.buildings[0];Object.assign(map,buildTerrace(building));
 const ground=map.tiles.find(tile=>tile.roomId===building.rooms[0].id&&!tile.blocked&&!propBlocksAt(map,tile.x,tile.y));Object.assign(map.squad[0],{id:'observer',x:ground.x,y:ground.y});
 const point={x:ground.x+1,y:ground.y,tacticalLevel:1};map.enemies=[{id:'secret',name:'Guardia oculto',...point,patrol:false}];
 const state=createBattle(map.squad,map);state.props.push({id:'roof-chest',type:'chest',...point});state.lights=[{id:'secret-light',...point,type:'torch',radius:3,intensity:1}];state.smoke=[{...point,radius:1}];
 const players=state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(state)),entries=admittedActors(state,players,revealed),world=presentWorld(state,createSceneTerrainCache()(state),players,revealed,entries,1);
 assert.equal(canSee(state,players[0],point),false);assert.ok(!entries.some(entry=>entry.actor.id==='secret'));assert.ok(!world.terrain.props.some(prop=>prop.id==='roof-chest'));assert.equal(world.terrain.lights.length,0);assert.equal(world.smoke.length,0);assert.equal('units'in world,false);assert.equal('npcs'in world,false);
 assert.ok(world.terrain.upperSurfaces.length>0,'known static building geometry remains without its occupants');
});
test('life state overrides an old attack cue and animation does not infer attacks from ammunition',()=>{
 const state=floor(),revealed=new Set(),actor=state.units[0],entry={key:'unit:one',kind:'unit',actor};
 const dead={...entry,actor:{...actor,hp:0}};assert.equal(presentActors(state,[dead],{},revealed,{cues:{'unit:one':{id:'old',action:'fire',startedAt:0}}})[0].action,'dead');
 const after={...entry,actor:{...actor,loaded:false,ammo:0}};assert.equal(presentActors(state,[after],{},revealed)[0].action,'idle');
 const hit={...entry,actor:{...actor,unconscious:true}};assert.equal(presentActors(state,[hit],{},revealed)[0].action,'unconscious');
});
