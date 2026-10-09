import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStructureBlast,structureBlastProfile} from '../game/structure-blast.js';
import {createBattle,actBattle,canSee,hasLineOfSight,movementStepCost,grenadeThrowPreview,containerLootPreview} from '../game/tactical.js';
import {grenadeFlight,grenadeBlastExposure} from '../game/grenade-flight.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {environmentActionProfile,extractContainerItem} from '../game/environment-interactions.js';
import {obstacleVolumesAt} from '../game/sight-geometry.js';
import {propBlocksAt} from '../game/props.js';

const field=({props=[],upperSurfaces=[],extra={}}={})=>createBattle([{id:'p',x:1,y:3,facing:2,marksmanship:100,strength:100,dexterity:100,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',4)},...extra}],{
  width:16,height:9,seed:45,tiles:Array.from({length:144},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),props,upperSurfaces,enemies:[{id:'e',x:14,y:7,patrol:false,overwatch:false}]});
const tile=(s,x,y=3)=>s.tiles[y*s.width+x];
const wall=(s,x,material='wood',y=3,extra={})=>Object.assign(tile(s,x,y),{type:'wall',material,blocked:true,blocksSight:true,cover:40,...extra});
const roof=(x,y=3)=>({id:`roof:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0,material:'adobe'});
const act=(s,a)=>{const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,next.lastError);return next;};
const grenadeCount=s=>s.units[0].inventory.grenade?.count??0;

test('wood, adobe and stone retain distinct cumulative damage and JSON resumes exactly',()=>{
  for(const [material,first,hits]of [['wood',100,1],['adobe',48,3],['stone',20,5]]){
    let s=field();wall(s,7,material);const before=structuredClone(s);
    applyStructureBlast(s,{x:6,y:3},3);assert.equal(tile(s,7).structureDamage,first,material);
    assert.equal(before.tiles[55].structureDamage,undefined);
    for(let count=1;count<hits;count++){
      s=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));applyStructureBlast(s,{x:6,y:3},3);
    }
    const broken=tile(s,7);assert.equal(broken.destroyed,true);assert.equal(broken.type,'rubble');assert.equal(broken.blocked,false);assert.equal(broken.blocksSight,false);assert.equal(broken.cover,15);
    assert.equal(broken.structureDamage,100);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),s);
    const again=structuredClone(s);assert.deepEqual(applyStructureBlast(s,{x:6,y:3},3),[]);assert.deepEqual(s,again);
  }
});

test('finite radius and material armour reject weak and distant blasts without damage records',()=>{
  const s=field();wall(s,7,'stone');wall(s,11,'wood');
  const before=structuredClone(s);applyStructureBlast(s,{x:6,y:3},3,{strength:60});assert.deepEqual(s,before);
  for(const radius of [-1,NaN,Infinity,21]){assert.deepEqual(applyStructureBlast(s,{x:6,y:3},radius),[]);assert.deepEqual(s,before);}
  assert.equal(structureBlastProfile({type:'wall',material:'stone'}).durability,350);
});

test('closed walls and diagonal corners shield other structures throughout one blast',()=>{
  const s=field({props:[{id:'rear',type:'table',x:8,y:3}]});wall(s,7);
  const hits=applyStructureBlast(s,{x:6,y:3},3);assert.equal(hits.length,1);assert.equal(tile(s,7).destroyed,true);assert.equal(s.props[0].structureDamage,undefined);
  applyStructureBlast(s,{x:6,y:3},3);assert.equal(s.props[0].destroyed,true,'the next blast can cross the cleared wall');
  const corner=field({props:[{id:'rear',type:'table',x:7,y:4}]});wall(corner,7,'stone',3,{obstacleHeight:6});
  applyStructureBlast(corner,{x:6,y:3},3);assert.equal(corner.props[0].structureDamage,undefined);
});

test('roofs, floors and raised ground remain physical blast barriers and do not collapse',()=>{
  const upper=[roof(6),roof(7)],s=field({upperSurfaces:upper,props:[{id:'upstairs',type:'table',x:7,y:3,tacticalLevel:1}]});wall(s,7,'wood');
  const original=structuredClone(s.upperSurfaces);applyStructureBlast(s,{x:6,y:3},3);
  assert.deepEqual(s.upperSurfaces,original);assert.equal(s.props[0].structureDamage,undefined);assert.equal(tile(s,7).destroyed,true);
  const high=field({props:[{id:'rear',type:'table',x:8,y:3}]});tile(high,7).elevation=4;
  applyStructureBlast(high,{x:6,y:3},3);assert.equal(high.props[0].structureDamage,undefined);
  applyStructureBlast(s,{x:6,y:3,tacticalLevel:1},3);assert.equal(s.props[0].destroyed,true);assert.deepEqual(s.upperSurfaces,original);
});

test('a destroyed wall immediately clears walking, sight, projectiles and later grenade paths',()=>{
  const s=field(),near={x:6,y:3},far={x:8,y:3};wall(s,7,'wood',3,{obstacleHeight:6,projectileResistance:1000});
  assert.equal(hasLineOfSight(s,near,far),false);assert.equal(movementStepCost(s,s.units[0],near,{x:7,y:3}),Infinity);
  const shot={damage:100,range:20},a=s.units[0],b=s.units[1];Object.assign(a,near);Object.assign(b,far);
  assert.equal(projectileFlight(s,a,b,shot).blocked,true);assert.equal(grenadeFlight(s,a,far).blocked,true);
  applyStructureBlast(s,near,3);assert.equal(hasLineOfSight(s,near,far),true);assert.ok(Number.isFinite(movementStepCost(s,s.units[0],near,{x:7,y:3})));
  assert.equal(projectileFlight(s,a,b,shot).blocked,false);assert.equal(grenadeFlight(s,a,far).blocked,false);
});

test('doors and windows break open without allowing their leaves to be closed again',()=>{
  const s=field(),door=wall(s,7,'adobe',3,{type:'door',doorId:'door',open:false,locked:true,lockIntegrity:80}),window=wall(s,6,'adobe',4,{type:'window',blocksSight:false});
  applyStructureBlast(s,{x:6,y:3},3);
  assert.equal(door.type,'door');assert.equal(door.doorId,'door');assert.equal(door.destroyed,true);assert.equal(door.open,true);assert.equal(door.locked,false);assert.equal(door.broken,true);assert.equal(door.lockIntegrity,0);
  assert.equal(window.type,'rubble');assert.equal(window.destroyed,true);assert.equal(window.blocked,false);
  assert.equal(environmentActionProfile(s.units[0],door,'close').valid,false);assert.equal(environmentActionProfile(s.units[0],door,'inspect').valid,true);assert.ok(validateBattleSnapshot(s));
});

test('multi-cell furniture takes one strongest hit and keeps stable cleared debris geometry',()=>{
  const s=field({props:[{id:'large-cart',type:'cart',x:7,y:3,footprint:{width:2,height:2},obstacleHeight:1.3,projectileResistance:30}]});
  const hits=applyStructureBlast(s,{x:6,y:3},3);assert.equal(hits.length,1);assert.equal(hits[0].id,'large-cart');
  const prop=s.props[0];assert.equal(prop.destroyed,true);assert.deepEqual(prop.footprint,{width:2,height:2});assert.equal(prop.x,7);assert.equal(prop.blocksMovement,false);assert.equal(prop.blocksSight,false);
  for(const [x,y]of [[7,3],[8,3],[7,4],[8,4]]){assert.equal(propBlocksAt(s,x,y),false);assert.ok(!obstacleVolumesAt(s,{x,y}).some(v=>v.id==='prop:large-cart'));}
  assert.ok(validateBattleSnapshot(s));
});

test('a destroyed locked and trapped chest keeps each finite identified item for one extraction',()=>{
  const item={item:'inventory:linen',name:'Tela',count:1,weight:.2,instanceId:'owned-cloth',condition:67};
  const s=field({props:[{id:'cache',type:'chest',x:7,y:3,locked:true,open:false,contents:[item],trap:{type:'alarm',difficulty:40,armed:true}}]});
  applyStructureBlast(s,{x:6,y:3},3);const chest=s.props[0];assert.equal(chest.open,true);assert.equal(chest.broken,true);assert.equal(chest.trap.armed,false);assert.deepEqual(chest.contents,[item]);assert.equal(chest.id,'cache');assert.equal(s.groundItems.length,0);
  const extracted=extractContainerItem(chest,0,1);assert.deepEqual(extracted.stack,item);assert.deepEqual(extracted.target.contents,[]);assert.throws(()=>extractContainerItem(extracted.target,0,1));
  s.props[0]=extracted.target;applyStructureBlast(s,{x:6,y:3},3);assert.deepEqual(s.props[0].contents,[]);assert.ok(validateBattleSnapshot(s));
});

test('real container pickup from blast debris conserves identity and rejects a repeated order',()=>{
  let s=field({extra:{x:6},props:[{id:'cache',type:'chest',x:7,y:3,locked:true,open:false,contents:[{item:'inventory:cloth',name:'Tela',count:1,weight:.2,instanceId:'blast-cache-cloth',condition:67}]}]});
  applyStructureBlast(s,{x:6,y:3},3);const preview=containerLootPreview(s,s.units[0],{kind:'container',id:'cache'},0,1);assert.equal(preview.valid,true,preview.reason);
  const before=structuredClone(s),taken=act(s,preview.action);assert.deepEqual(taken.props[0].contents,[]);const record=Object.values(taken.units[0].inventory).find(r=>r.instanceId==='blast-cache-cloth');assert.equal(record.condition,67);assert.equal(record.count,1);
  assert.equal(taken.units[0].ap,before.units[0].ap-preview.pa);assert.equal(taken.seed,before.seed);assert.ok(validateBattleSnapshot(taken));
  const again=actBattle(taken,{unitId:'p',...preview.action});assert.ok(again.lastError);assert.deepEqual(again.units,taken.units);assert.deepEqual(again.props,taken.props);assert.deepEqual(again.groundItems,taken.groundItems);
});

test('real grenade orders damage terrain once, spend one owned grenade and preserve intact cover for people',()=>{
  const s=field();wall(s,7);Object.assign(s.units[1],{x:8,y:3});const target={x:6,y:3};
  const plan=grenadeThrowPreview(s,s.units[0],target),hp=s.units[1].hp,ap=s.units[0].ap;
  assert.equal(grenadeBlastExposure(s,target,s.units[1],3).multiplier,0);const next=act(s,{type:'throwGrenade',...target});
  assert.equal(grenadeCount(next),grenadeCount(s)-1);assert.equal(next.units[0].ap,ap-plan.pa);assert.equal(next.units[1].hp,hp);assert.equal(tile(next,7).destroyed,true);assert.equal(tile(s,7).structureDamage,undefined);assert.ok(canSee(next,next.units[0],next.units[1]));assert.ok(validateBattleSnapshot(next));
});

test('failed grenades and invalid orders cannot damage structures or duplicate stock',()=>{
  const s=field();s.units[0].inventory.grenade.condition=1;wall(s,7);const next=act(s,{type:'throwGrenade',x:6,y:3});
  assert.equal(tile(next,7).structureDamage,undefined);assert.equal(next.groundItems.filter(g=>g.kind==='grenade').length,1);assert.equal(grenadeCount(next),grenadeCount(s)-1);
  const invalid=actBattle(s,{unitId:'p',type:'throwGrenade',x:99,y:3});assert.ok(invalid.lastError);assert.deepEqual(invalid.tiles,s.tiles);assert.deepEqual(invalid.units,s.units);
});

test('legacy saves omit durability while new damage fields reject inconsistent or unsafe state',()=>{
  const legacy=field();wall(legacy,7);assert.ok(validateBattleSnapshot(legacy));assert.equal(tile(legacy,7).structureDamage,undefined);
  const broken=field({props:[{id:'table',type:'table',x:7,y:3}]});applyStructureBlast(broken,{x:6,y:3},3);
  for(const patch of [{structureDamage:-1},{structureDamage:101},{structureDamage:.5},{structureDamage:NaN},{structureDamage:'20'},{destroyed:'yes'},{destroyed:true,structureDamage:99},{destroyed:false,structureDamage:100},{blocksMovement:true},{blocksSight:true},{projectileResistance:30}]){
    const bad=structuredClone(broken);Object.assign(bad.props[0],patch);assert.throws(()=>validateBattleSnapshot(bad),JSON.stringify(patch));
  }
  for(const patch of [{structureDamage:10},{destroyed:true,structureDamage:100,blocksSight:false}]){
    const bad=structuredClone(legacy);Object.assign(tile(bad,8),patch);assert.throws(()=>validateBattleSnapshot(bad));
  }
  const upper=field({upperSurfaces:[roof(8)]});upper.upperSurfaces[0].structureDamage=10;assert.throws(()=>validateBattleSnapshot(upper));
  const rubble=field();wall(rubble,7);applyStructureBlast(rubble,{x:6,y:3},3);
  for(const patch of [{obstacleHeight:6},{projectileResistance:1000},{concealment:90},{cover:100},{blocked:true},{blocksSight:true}]){
    const bad=structuredClone(rubble);Object.assign(tile(bad,7),patch);assert.throws(()=>validateBattleSnapshot(bad),JSON.stringify(patch));
  }
});

test('manual crowbar destruction of a previously damaged wall clears all durability and cover overrides',()=>{
  const s=field({extra:{activeSlot:'tool',activeItem:undefined,activeTool:'inventory:crowbar',inventory:{crowbar:{itemType:'tool',toolKey:'crowbar',count:1,weight:2.5,condition:80}}}});
  wall(s,2,'adobe',3,{structureDamage:48,obstacleHeight:6,projectileResistance:300,concealment:70});const next=act(s,{type:'breach',x:2,y:3});
  const cleared=tile(next,2);assert.equal(cleared.structureDamage,100);assert.equal(cleared.destroyed,true);assert.equal(cleared.type,'rubble');for(const key of ['obstacleHeight','projectileResistance','concealment'])assert.equal(cleared[key],undefined);assert.ok(validateBattleSnapshot(next));
});

test('solid cannonballs retain direct breach rules and do not gain radial structural damage',()=>{
  const s=field({extra:{activeSlot:'primary',activeItem:undefined}});Object.assign(s.units[0],{x:3,y:3});s.artillery=[{id:'gun',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:1}];
  s.units.push({...structuredClone(s.units[0]),id:'crew',x:3,y:4});
  wall(s,7,'adobe',3,{structureDamage:48});wall(s,7,'wood',4);
  const next=act(s,{type:'artillery',artilleryId:'gun',x:10,y:3,mode:'solid'});assert.equal(tile(next,7).type,'rubble');assert.equal(tile(next,7).destroyed,true);assert.equal(tile(next,7).structureDamage,100);assert.equal(tile(next,7,4).type,'wall');assert.equal(tile(next,7,4).structureDamage,undefined);assert.ok(validateBattleSnapshot(next));
});

test('direct cannon breach of a previously damaged door keeps its identity and finite contents in open debris',()=>{
  const s=field({extra:{activeSlot:'primary',activeItem:undefined}});Object.assign(s.units[0],{x:3,y:3});s.units.push({...structuredClone(s.units[0]),id:'crew',x:3,y:4});s.artillery=[{id:'gun',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:1}];
  const contents=[{item:'inventory:cloth',count:1,weight:.2,instanceId:'door-cloth'}];wall(s,7,'adobe',3,{type:'door',doorId:'partial-door',open:false,locked:true,structureDamage:35,contents,trap:{type:'injury',difficulty:30,armed:true}});
  const next=act(s,{type:'artillery',artilleryId:'gun',x:10,y:3,mode:'solid'}),door=tile(next,7);
  assert.equal(door.type,'door');assert.equal(door.doorId,'partial-door');assert.equal(door.destroyed,true);assert.equal(door.open,true);assert.equal(door.locked,false);assert.equal(door.trap.armed,false);assert.deepEqual(door.contents,contents);assert.ok(validateBattleSnapshot(next));
});
