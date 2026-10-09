import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle,RENDERER_SCENARIOS} from '../web/app/renderer-sandbox/fixtures.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {actBattle,canSee,climbPreview,tileIllumination,artilleryCosts,artilleryCrewPlan} from '../game/tactical.js';
import {tacticalLevel,sameCell} from '../game/tactical-space.js';
import {BUILDING_TYPES} from '../game/building-types.js';
const actor=(battle,id)=>battle.units.find(unit=>unit.id===id);
function order(battle,action){
  const before=structuredClone(battle),next=actBattle(battle,action);
  assert.equal(next.lastError,null,`${JSON.stringify(action)}: ${next.lastError}`);
  assert.deepEqual(battle,before,'fixture actions use the ordinary immutable reducer');
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));
  return next;
}

test('all sandbox choices are fresh, valid real battle snapshots with legal equipment states',()=>{
  for(const {id}of RENDERER_SCENARIOS){
    const battle=createRendererSandboxBattle(id),again=createRendererSandboxBattle(id);
    assert.deepEqual(again,battle,`${id} resets to a repeatable state`);
    assert.notEqual(again,battle);assert.notEqual(again.units,battle.units);if(battle.units.length)assert.notEqual(again.units[0],battle.units[0]);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),id);
    assert.equal(battle.phase,'player');assert.equal(battle.status,id==='empty'?'defeat':'active');
    assert.ok(battle.units.filter(unit=>unit.side==='player').every(unit=>unit.ap>0&&unit.ap<=100));
  }
  for(const count of [24,60,100])assert.equal(createRendererSandboxBattle(`performance${count}`).units.length,count);
  const tucuman=createRendererSandboxBattle('tucuman');assert.equal(tucuman.sectorId,'tucuman');assert.equal(tucuman.units.length,8);assert.ok(tucuman.buildings.length>1);
  assert.throws(()=>createRendererSandboxBattle('unknown'));
});

test('combat starts with visible targets and real usable rifle, pistol, sabre, grenade and knife',()=>{
  const actions=[
    {type:'fire',unitId:'rifle',targetId:'target-rifle'},
    {type:'fire',unitId:'pistol',targetId:'target-pistol'},
    {type:'melee',unitId:'sabre',targetId:'target-sabre'},
    {type:'throwGrenade',unitId:'grenade',x:9,y:13},
    {type:'throwKnife',unitId:'knife',targetId:'target-knife'},
  ];
  for(const action of actions){
    const battle=createRendererSandboxBattle('combat');
    const unit=actor(battle,action.unitId),target=actor(battle,action.targetId??'target-grenade');
    assert.ok(canSee(battle,unit,target),action.unitId);
    const next=order(battle,action);assert.ok(actor(next,unit.id).ap<unit.ap);
    if(action.type==='fire')assert.equal(actor(next,unit.id).loaded,0);
    if(action.type==='throwGrenade')assert.equal(actor(next,unit.id).inventory.grenade.count,1);
    if(action.type==='throwKnife')assert.equal(actor(next,unit.id).weaponDropped,true);
  }
  const battle=createRendererSandboxBattle('combat');
  assert.equal(battle.tiles.find(tile=>tile.doorId==='sandbox-door').open,true);
  const fired=order(battle,actions[0]),reloaded=order(fired,{type:'reload',unitId:'rifle'});
  assert.equal(actor(reloaded,'rifle').loaded,1);assert.ok(actor(reloaded,'rifle').ammo<actor(fired,'rifle').ammo);
});

test('terrain detail covers a chunk crossing and real travel across the soil/grass boundary',()=>{
  const battle=createRendererSandboxBattle('terrain-detail'),at=(x,y)=>battle.tiles.find(tile=>tile.x===x&&tile.y===y);
  assert.equal(at(7,6).type,'road');assert.equal(at(8,6).type,'road');
  assert.equal(at(6,6).type,'grass');assert.equal(at(9,6).type,'grass');
  assert.equal(at(3,10).material,'stone');assert.equal(at(15,11).material,'cobble');
  assert.equal(at(15,4).type,'mud');assert.equal(at(4,14).type,'scrub');
  assert.equal(at(15,14).type,'forest');assert.equal(at(6,2).elevation,.35);
  const tiles=structuredClone(battle.tiles),next=order(battle,{type:'move',unitId:'terrain-guard',x:9,y:9});
  assert.equal(actor(next,'terrain-guard').x,9);assert.equal(actor(next,'terrain-guard').y,9);
  assert.deepEqual(next.tiles,tiles,'ordinary travel retains the authored terrain');
});

test('architecture has all nine building identities, two facade directions, and usable doors',()=>{
  const battle=createRendererSandboxBattle('architecture');
  assert.deepEqual(battle.buildings.map(building=>building.architecture),Object.keys(BUILDING_TYPES));
  for(const building of battle.buildings){
    const guard=actor(battle,`guard-${building.architecture}`),door=battle.tiles.find(tile=>tile.doorId===`${building.id}:door`);
    assert.ok(door);assert.equal(door.open,false);
    const near={x:door.x+(door.x===building.x+building.width-1?1:0),y:door.y+(door.y===building.y+building.height-1?1:0)};
    const approached=order(battle,{type:'move',unitId:guard.id,...near});
    const opened=order(approached,{type:'door',unitId:guard.id,doorId:door.doorId});
    assert.equal(opened.tiles.find(tile=>tile.doorId===door.doorId).open,true);
    const entered=order(opened,{type:'move',unitId:guard.id,x:door.x,y:door.y});
    assert.ok(sameCell(actor(entered,guard.id),door));
  }
});

test('posture review exercises real travel for both prone anatomy banks',()=>{
  const battle=createRendererSandboxBattle('postures');
  for(const id of ['walker','runner','croucher','crawler','crawler-woman']){
    const unit=actor(battle,id),next=order(battle,{type:'move',unitId:id,x:unit.x+1,y:unit.y});
    assert.equal(actor(next,id).x,unit.x+1);
    assert.equal(actor(next,id).stance,unit.stance);
    assert.equal(actor(next,id).movementMode,unit.movementMode);
  }
});

test('all-family cloth review uses valid postures and ordinary travel with base attire',()=>{
  for(const stance of ['standing','crouched','prone'])for(const gear of ['family','unarmed','rifle','pistol','sabre','knife','paired-pistols'])for(const facing of [3,5,7]){
    const id=`characters:${stance}:${gear}:${facing}`,battle=createRendererSandboxBattle(id);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
    assert.equal(new Set(battle.units.map(unit=>unit.spriteAppearance)).size,8);
    for(const unit of battle.units){
      assert.equal(unit.stance,stance);assert.equal(unit.facing,facing);
      for(const slot of ['headwear','outfit','legwear'])assert.equal(unit[slot],null,'base family attire is visible');
      if(gear==='unarmed')assert.equal(unit.activeSlot,'unarmed');
      if(gear==='rifle'){assert.equal(unit.weapon,1800);assert.equal(unit.activeSlot,'primary');}
      if(['pistol','sabre','knife','paired-pistols'].includes(gear)){assert.equal(unit.weapon,{pistol:1805,sabre:1810,knife:1813,'paired-pistols':1805}[gear]);assert.equal(unit.activeSlot,'primary');}
      if(gear==='paired-pistols'){assert.equal(unit.offHand.weapon,1806);assert.equal(unit.offHand.loaded,1);}
      const next=order(battle,{type:'move',unitId:unit.id,x:unit.x+1,y:unit.y});
      assert.equal(actor(next,unit.id).x,unit.x+1);assert.equal(actor(next,unit.id).stance,stance);
      assert.equal(actor(next,unit.id).loaded,unit.loaded);assert.equal(actor(next,unit.id).ammo,unit.ammo);if(gear==='paired-pistols')assert.deepEqual(actor(next,unit.id).offHand,unit.offHand);
    }
  }
  for(const id of ['characters:unknown','characters:standing:unknown','characters:standing:family:2'])assert.throws(()=>createRendererSandboxBattle(id));
});

test('individual building review keeps a real lone guard outside each closed facade',()=>{
  for(const type of Object.keys(BUILDING_TYPES)){
    const battle=createRendererSandboxBattle(`architecture:${type}`);
    assert.equal(battle.buildings.length,1);assert.equal(battle.buildings[0].architecture,type);
    assert.equal(battle.units.length,1);assert.equal(battle.units[0].id,`guard-${type}`);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
    const guard=battle.units[0],building=battle.buildings[0];
    assert.ok(guard.x>building.x+building.width-1||guard.y>building.y+building.height-1);
    assert.equal(battle.tiles.find(tile=>tile.type==='door').open,false);
  }
  assert.throws(()=>createRendererSandboxBattle('architecture:unknown'));
});

test('the loaded cannon has a complete adjacent crew and finite ammunition',()=>{
  const battle=createRendererSandboxBattle('combat'),gun=battle.artillery[0],gunner=actor(battle,'gunner');
  const crew=artilleryCrewPlan(battle,gunner,gun,artilleryCosts(battle,gunner,gun).fire);
  assert.equal(crew.reason,null);assert.deepEqual(new Set(crew.crew),new Set(['gunner','loader']));
  const fired=order(battle,{type:'artillery',unitId:'gunner',artilleryId:gun.id,targetId:'target-cannon',mode:'solid'});
  assert.equal(fired.artillery[0].loaded,false);assert.ok(fired.smoke.length>0);
  const reloaded=order(fired,{type:'artilleryReload',unitId:'gunner',artilleryId:gun.id});
  assert.equal(reloaded.artillery[0].loaded,true);assert.equal(reloaded.artillery[0].ammo,gun.ammo-1);
});

test('four-bore review loads both owned pistols with finite cartridges through ordinary exploration orders',()=>{
  const battle=createRendererSandboxBattle('four-bore-loading');
  assert.equal(battle.mode,'exploration');assert.equal(battle.units.length,2);
  for(const id of ['paired-loader','offhand-loader']){
    const unit=actor(battle,id),next=order(battle,{type:'reload',unitId:id}),loaded=actor(next,id);
    assert.equal(unit.weapon,1808);assert.equal(unit.offHand.weapon,1808);
    assert.equal(loaded.loaded,2);assert.equal(loaded.offHand.loaded,2);
    assert.equal(loaded.ammo,id==='paired-loader'?4:6);
    assert.equal(loaded.condition,81);assert.equal(loaded.offHand.condition,57);
  }
});

test('mounted movement, dismount, real roof ascent/descent and the open door use legal game orders',()=>{
  let battle=createRendererSandboxBattle('mounted');
  battle=order(battle,{type:'move',unitId:'rider',x:6,y:7});
  assert.ok(actor(battle,'rider').mounted);assert.equal(actor(battle,'rider').x,6);
  battle=order(battle,{type:'movement',unitId:'rider',movement:'run'});
  battle=order(battle,{type:'move',unitId:'rider',x:8,y:7});
  assert.equal(actor(battle,'rider').movementMode,'run');
  battle=order(battle,{type:'mount',unitId:'rider'});assert.equal(actor(battle,'rider').mounted,false);
  battle=order(battle,{type:'mount',unitId:'rider'});assert.equal(actor(battle,'rider').mounted,true);
  const link=battle.climbLinks[0];assert.ok(sameCell(actor(battle,'climber'),link.from));
  const preview=climbPreview(battle,actor(battle,'climber'),{linkId:link.id});assert.equal(preview.valid,true,preview.reason);
  battle=order(battle,{type:'climb',unitId:'climber',linkId:link.id});assert.equal(tacticalLevel(actor(battle,'climber')),1);
  battle=order(battle,{type:'move',unitId:'climber',x:12,y:8,tacticalLevel:1});
  battle=order(battle,{type:'move',unitId:'climber',...link.to});
  battle=order(battle,{type:'climb',unitId:'climber',linkId:link.id});assert.equal(tacticalLevel(actor(battle,'climber')),0);
  battle=order(battle,{type:'door',unitId:'door-guard',doorId:'sandbox-door'});assert.equal(battle.tiles.find(tile=>tile.doorId==='sandbox-door').open,false);
});

test('night uses actual lights, shot-produced smoke, reload supplies and usable torches',()=>{
  let battle=createRendererSandboxBattle('night');
  assert.equal(battle.night,true);assert.equal(actor(battle,'rifle').loaded,0);assert.ok(battle.smoke.some(cloud=>cloud.x===4&&cloud.y===5&&cloud.turns>0));
  assert.ok(tileIllumination(battle,10,5)>.25);assert.ok(tileIllumination(battle,0,19)<.25);
  battle=order(battle,{type:'reload',unitId:'rifle'});assert.equal(actor(battle,'rifle').loaded,1);
  const torches=actor(battle,'grenade').torches;
  battle=order(battle,{type:'weapon',unitId:'grenade',slot:'supply',supplyKey:'torches'});
  battle=order(battle,{type:'useItem',unitId:'grenade',x:5,y:13});
  assert.equal(actor(battle,'grenade').torches,torches-1);
  assert.ok(battle.lights.some(light=>light.type==='torch'&&light.x===5&&light.y===13));
});


test('same-cell hatch review uses ordinary climbs and keeps its roof walking cells',()=>{
 const initial=createRendererSandboxBattle('climb-hatches');
 for(const surface of initial.upperSurfaces.filter(surface=>initial.climbLinks.some(link=>sameCell(link.to,surface))))assert.ok(initial.units.some(unit=>canSee(initial,unit,surface)),'normal observers disclose both climb destinations');
 for(const id of ['hatch-man','hatch-woman']){
  const start=actor(initial,id),up=order(initial,{type:'climb',unitId:id,linkId:id});assert.equal(actor(up,id).tacticalLevel,1);assert.equal(climbPreview(initial,start,{linkId:id}).valid,true);
  assert.equal(actor(up,id).x,start.x);assert.equal(actor(up,id).y,start.y);
  const walk=order(up,{type:'move',unitId:id,x:start.x+1,y:start.y,tacticalLevel:1}),back=order(walk,{type:'move',unitId:id,x:start.x,y:start.y,tacticalLevel:1});
  const down=order(back,{type:'climb',unitId:id,linkId:id});assert.equal(actor(down,id).tacticalLevel,0);assert.equal(actor(down,id).x,start.x);assert.equal(actor(down,id).y,start.y);
  assert.deepEqual(down.upperSurfaces,initial.upperSurfaces);assert.deepEqual(down.climbLinks,initial.climbLinks);
 }
});
