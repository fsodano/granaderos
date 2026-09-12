import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,canSee,actBattle,environmentTargetAt} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {spaceKey} from '../game/tactical-space.js';
const secret='PRIVATE_UPPER_ID';
const platform=(level=1)=>Array.from({length:25},(_,i)=>({id:`roof-${level}-${i}`,x:3+i%5,y:3+Math.floor(i/5),tacticalLevel:level,elevation:level*3,type:'floor',kind:'roof',blocked:false,cover:0,slabThickness:.2}));
function fixture(level=1,extra={}){
 return createBattle([{id:'p',x:4,y:4,tacticalLevel:level}],{width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),upperSurfaces:platform(),climbLinks:[{id:'west',kind:'climb',from:{x:2,y:4,tacticalLevel:0},to:{x:3,y:4,tacticalLevel:1}}],exploration:true,enemies:[],...extra});
}
test('public spatial records retain their observed floor and hide stacked actors, items and light',()=>{
 for(const level of [0,1]){
  const other=1-level,s=fixture(level,{enemies:[{id:'seen',x:5,y:4,tacticalLevel:level},{id:secret,x:5,y:4,tacticalLevel:other}],npcs:[{id:'neighbor',name:'Vecino',x:4,y:5,tacticalLevel:level}]});
  const known={x:5,y:4,tacticalLevel:level},hidden={x:5,y:4,tacticalLevel:other};
  s.groundItems=[{id:'rounds',...known,item:'ammo',count:2},{id:secret,...hidden,item:'ammo',count:3}];
  s.droppedWeapons=[{...known,weapon:1800},{...hidden,weapon:1800,label:secret}];
  s.lights=[{...known,type:'torch',radius:3},{...hidden,type:secret,radius:3}];
  s.smoke=[{...known,radius:1},{...hidden,radius:99}];
  assert.equal(canSee(s,s.units[0],s.units[1]),true);assert.equal(canSee(s,s.units[0],s.units[2]),false);
  const before=structuredClone(s),view=playerKnownBattle(s);
  assert.deepEqual(s,before);assert.deepEqual(view.units.map(u=>u.id),['p','seen']);assert.ok(view.units.every(u=>u.tacticalLevel===level));
  assert.equal(view.npcs[0].tacticalLevel,level);assert.equal(view.groundItems.length,1);assert.equal(view.groundItems[0].tacticalLevel,level);
  assert.equal(view.droppedWeapons.length,1);assert.equal(view.droppedWeapons[0].tacticalLevel,level);
  assert.deepEqual(view.lights,[{...known,type:'torch',radius:3}]);assert.deepEqual(view.smoke,[{...known,radius:1}]);
  assert.ok(!JSON.stringify(view).includes(secret));
 }
});
test('surface and climb IDs require observed cells on both endpoint floors',()=>{
 const s=fixture();s.upperSurfaces.push(...platform(2).map(surface=>({...surface,id:`${secret}-${surface.id}`,privateData:secret})));
 s.climbLinks.push({id:secret,kind:'climb',from:{x:4,y:4,tacticalLevel:1},to:{x:4,y:4,tacticalLevel:2},privateData:secret});
 let view=playerKnownBattle(s);assert.ok(view.upperSurfaces.length>0);assert.ok(view.upperSurfaces.every(surface=>surface.tacticalLevel===1));
 assert.deepEqual(view.climbLinks,[]);assert.ok(!JSON.stringify(view).includes(secret));
 const altered=structuredClone(s);altered.climbLinks[1].id='DIFFERENT_PRIVATE_ID';altered.upperSurfaces.filter(surface=>surface.tacticalLevel===2).forEach(surface=>surface.id+='-changed');
 assert.deepEqual(playerKnownBattle(altered),view,'hidden identities must not affect public geometry');
 s.units.push({...s.units[0],id:'ground-observer',x:2,y:4,tacticalLevel:0});view=playerKnownBattle(s);
 assert.deepEqual(view.climbLinks,[s.climbLinks[0]]);
 const known=new Set([...view.tiles,...view.upperSurfaces].map(spaceKey));
 assert.ok(view.climbLinks.every(link=>known.has(spaceKey(link.from))&&known.has(spaceKey(link.to))));
 view.upperSurfaces[0].elevation=99;view.climbLinks[0].from.x=99;assert.equal(s.upperSurfaces[0].elevation,3);assert.equal(s.climbLinks[0].from.x,2);
});
test('roof container IDs and anonymous observed contacts preserve floor without private metadata',()=>{
 const s=fixture();s.props=[{id:'roof-cache',type:'chest',x:5,y:4,tacticalLevel:1,open:false,locked:false,keyId:secret,contents:[{item:'ammo',count:2}]}];
 s.units[0].lastKnownEnemy={x:6,y:4,tacticalLevel:1,turn:s.turn,enemyId:secret};
 s.units[0].lastHeardNoise={x:6,y:4,kind:'move',uncertainty:2,turn:s.turn,enemyId:secret};
 let view=playerKnownBattle(s);assert.equal(view.props[0].tacticalLevel,1);assert.equal(view.environment[0].tacticalLevel,1);assert.equal(view.environment[0].contents,undefined);
 assert.equal(view.contacts.find(contact=>contact.kind==='lastSeen').tacticalLevel,1);assert.equal(view.contacts.find(contact=>contact.kind==='heard').tacticalLevel,undefined);
 const target=environmentTargetAt(s,view.environment[0]);assert.equal(target.id,'roof-cache');
 const opened=actBattle(s,{type:'useItem',unitId:'p',environment:{kind:'container',id:target.id}});assert.equal(opened.lastError,null);
 view=playerKnownBattle(opened);assert.equal(view.environment[0].open,true);assert.equal(view.environment[0].contents[0].count,2);assert.ok(!JSON.stringify(view).includes(secret));
});
test('ground-only public maps do not acquire physical fields or fabricated geometry',()=>{
 const s=createBattle([{id:'p',x:1,y:1}],{width:8,height:8,exploration:true,enemies:[]});const view=playerKnownBattle(s);
 assert.equal(view.upperSurfaces,undefined);assert.equal(view.climbLinks,undefined);assert.ok(!Object.hasOwn(view.units[0],'tacticalLevel'));assert.ok(view.tiles.every(tile=>!Object.hasOwn(tile,'tacticalLevel')&&!Object.hasOwn(tile,'elevation')));
});
