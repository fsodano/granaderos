import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {surfaceAt,spaceKey,sameCell,validateTacticalSpace} from '../game/tactical-space.js';
import {buildSectorMap} from '../game/maps.js';
import {enterSector} from '../game/world.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
const upper=(x,y)=>({id:`roof:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0});
function field(players=[{id:'p',x:5,y:5,tacticalLevel:1}],extra={}){
 return createBattle(players,{width:16,height:10,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),upperSurfaces:Array.from({length:12},(_,i)=>upper(4+i%4,4+Math.floor(i/4))),climbLinks:[{id:'access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}}],exploration:true,enemies:[],...extra});
}
const decodeBattle=b=>validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
function deployment(compactLayout){return {sector:'retiro',compactLayout,exploration:true,squad:[{id:'p'}],enemies:[{id:'low'},{id:'high',x:17,y:3,tacticalLevel:1,patrol:false,overwatch:false}],upperSurfaces:[upper(17,3),upper(16,3)],climbLinks:[{id:'post-access',kind:'climb',from:{x:15,y:3,tacticalLevel:0},to:{x:16,y:3,tacticalLevel:1}}]};}

test('out-of-map surface lookups return before reading or scanning tile arrays',()=>{
 const tiles=new Proxy([],{get(){throw Error('An out-of-map neighbour must not read the tiles.');}}),state={width:64,height:48,tiles};
 for(const p of [{x:-1,y:0},{x:0,y:-1},{x:64,y:0},{x:0,y:48},{x:999,y:999}])for(const tacticalLevel of [0,1])assert.equal(surfaceAt(state,{...p,tacticalLevel}),null);
 const sparse={width:4,height:4,tiles:[{x:2,y:2,type:'grass',blocked:false,cover:0}]};assert.equal(surfaceAt(sparse,{x:2,y:2}),sparse.tiles[0],'legacy sparse in-bounds lookup still works');
});

test('roof admission rejects live soldiers or ordinary civilians sharing one physical cell',()=>{
 for(const add of [s=>s.units.push({...structuredClone(s.units[0]),id:'second'}),s=>s.npcs.push({id:'civilian',name:'Vecino',x:5,y:5,tacticalLevel:1})]){
  const s=field();add(s);const before=structuredClone(s);assert.throws(()=>decodeBattle(s),/ocupantes superpuestos/);assert.deepEqual(s,before);
 }
 const allowed=field([{id:'above',x:4,y:4,tacticalLevel:1},{id:'below',x:4,y:4},{id:'access-user',x:3,y:4},{id:'body',x:4,y:4,tacticalLevel:1,hp:0},{id:'unconscious',x:4,y:4,tacticalLevel:1,energy:0}]);
 assert.deepEqual(decodeBattle(allowed),allowed,'different floors, occupied climb endpoints and bodies remain legal');
 const ground=field([{id:'a',x:1,y:1},{id:'b',x:1,y:1}]);ground.npcs.push({id:'civilian',name:'Vecino',x:1,y:1});assert.deepEqual(decodeBattle(ground),ground,'legacy ground overlap semantics are unchanged');
});

test('ordinary civilians initialize healthy and need an unblocked upper surface and clear furniture footprint',()=>{
 const s=field([{id:'p',x:3,y:4}],{npcs:[{id:'civilian',name:'Vecino',x:6,y:5,tacticalLevel:1}]});
 assert.equal(s.npcs[0].hp,100);assert.deepEqual(decodeBattle(s),s);
 const blocked=structuredClone(s);blocked.upperSurfaces.find(p=>sameCell(p,blocked.npcs[0])).blocked=true;assert.throws(()=>decodeBattle(blocked),/apoyos de personas/);
 for(const actor of ['civilian','soldier']){
  const b=actor==='civilian'?structuredClone(s):field([{id:'p',x:6,y:5,tacticalLevel:1}]);
  b.props.push({id:'bed',type:'bed',x:5,y:5,tacticalLevel:1,footprint:{width:2,height:1}});
  assert.throws(()=>decodeBattle(b),/personas dentro del mobiliario/,actor);
  b.props[0].blocksMovement=false;assert.deepEqual(decodeBattle(b),b,'nonblocking furniture does not obstruct people');
  b.props[0].blocksMovement=true;b.props[0].tacticalLevel=0;assert.deepEqual(decodeBattle(b),b,'downstairs furniture cannot obstruct a roof occupant');
 }
});

test('mounted upper actors cannot enter a snapshot; dismounted horse owners remain valid',()=>{
 for(const extra of [{mounted:true},{horse:true,mounted:true}])assert.throws(()=>decodeBattle(field([{id:'p',x:5,y:5,tacticalLevel:1,...extra}])),/monturas fuera del suelo/);
 const dismounted=field([{id:'p',x:5,y:5,tacticalLevel:1,horse:true,mounted:false}]);assert.deepEqual(decodeBattle(dismounted),dismounted);
 const ground=field([{id:'p',x:3,y:4,mounted:true}]);assert.deepEqual(decodeBattle(ground),ground);
});

test('fresh compact and expanded deployments preserve authored upper enemy posts and separate downstairs occupants',()=>{
 for(const compactLayout of [true,false]){
  const request=deployment(compactLayout),before=structuredClone(request),map=buildSectorMap(request),post=map.upperSurfaces.find(p=>p.id==='roof:17:3'),high=map.enemies.find(u=>u.id==='high'),low=map.enemies.find(u=>u.id==='low');
  assert.equal(spaceKey(high),spaceKey(post));assert.deepEqual([low.x,low.y],[high.x,high.y]);assert.notEqual(spaceKey(low),spaceKey(high));
  assert.deepEqual([post.x,post.y],compactLayout?[17,3]:[39,19]);validateTacticalSpace({...map,units:map.enemies});
  const battle=enterSector(request);assert.equal(spaceKey(battle.units.find(u=>u.id==='high')),spaceKey(post));assert.deepEqual(decodeBattle(battle),battle);assert.deepEqual(request,before);
 }
});

test('fresh map requests cannot bypass support, overlap, mounted or finite-height admission',()=>{
 for(const mutate of [r=>delete r.upperSurfaces,r=>r.enemies[1].x=18,r=>r.enemies[1].tacticalLevel=null,r=>r.enemies[1].mounted=true,r=>r.enemies.push({...r.enemies[1],id:'duplicate'}),r=>r.upperSurfaces[0].blocked=true,r=>r.upperSurfaces[0].elevation=Infinity]){
  const request=deployment(true);mutate(request);request.restorePrevious=true;request.deferUpperDeployment=true;
  const before=structuredClone(request);assert.throws(()=>buildSectorMap(request),/espacio táctico/);assert.throws(()=>enterSector(request),/espacio táctico/);assert.deepEqual(request,before);
 }
});

test('saved full-map reentry restores upper residents and defenders against saved geometry before admission',()=>{
 let campaign=initialCampaign();for(const action of [{type:'recruitCivic',id:128,term:'day'},{type:'visitSector'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 const authored=deployment(false),request={...campaign.pendingBattle,upperSurfaces:authored.upperSurfaces,climbLinks:authored.climbLinks,enemies:authored.enemies};
 const battle=enterSector(request),roof=battle.upperSurfaces.find(p=>p.id==='roof:16:3'),player=battle.units.find(u=>u.side==='player');Object.assign(player,{x:roof.x,y:roof.y,tacticalLevel:1});
 const loaded=decodeSave(encodeSave(campaign,battle)),before=structuredClone(loaded.battle);
 const returning={...loaded.campaign.pendingBattle,exploration:false,squad:loaded.battle.units.filter(u=>u.side==='player').map(u=>({...u,entryReason:'resident'})),enemies:loaded.battle.units.filter(u=>u.side==='enemy')};
 assert.equal(returning.upperSurfaces,undefined);assert.ok(returning.enemies.find(u=>u.id==='high').x>=20);
 const returned=enterSector(returning,loaded.battle),again=enterSector(returning,returned);
 for(const state of [returned,again]){
  assert.deepEqual(state.upperSurfaces,before.upperSurfaces);assert.deepEqual(state.climbLinks,before.climbLinks);
  for(const original of before.units){const unit=state.units.find(u=>u.id===original.id);assert.equal(spaceKey(unit),spaceKey(original));assert.equal(unit.loaded,original.loaded);assert.equal(unit.ammo,original.ammo);}
  assert.deepEqual(decodeBattle(state),state);
 }
 assert.deepEqual(loaded.battle,before);
 for(const mutate of [s=>s.units.find(u=>u.id==='high').tacticalLevel=2,s=>s.units.find(u=>u.side==='player').x=0,s=>s.units.find(u=>u.side==='player').mounted=true,s=>s.npcs.push({id:'floating-civilian',name:'Vecino',x:0,y:0,tacticalLevel:1})]){
  const invalid=structuredClone(before);mutate(invalid);const original=structuredClone(invalid);
  assert.throws(()=>enterSector(returning,invalid),/espacio táctico/);assert.deepEqual(invalid,original,'invalid residents must not be silently repositioned');
 }
});
