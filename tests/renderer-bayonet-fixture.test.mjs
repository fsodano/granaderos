import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {actBattle,presentedActBattle,contextualAttack} from '../game/tactical.js';
import {fixedBayonetFor} from '../game/weapon-fittings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('both review anatomies own separately identified paid socket assemblies and perform finite bayonet strikes',()=>{
  const original=createRendererSandboxBattle('bayonets');assert.deepEqual(createRendererSandboxBattle('bayonets'),original);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(original))));
  const sockets=new Set();
  for(const anatomy of ['male','female']){
    const id=`bayonet-${anatomy}`,targetId=`target-${id}`,unit=original.units.find(u=>u.id===id),fitting=fixedBayonetFor(unit);assert.ok(fitting);assert.equal(fitting.instanceId,`review-socket-${anatomy}`);sockets.add(fitting.instanceId);assert.equal(unit.weaponInstanceId,`review-rifle-${anatomy}`);assert.equal(unit.ap,88,'ordinary fitting costs 12 internal AP');
    const before=structuredClone(original),mode=actBattle(original,{type:'weaponMode',unitId:id,mode:'melee'});assert.equal(mode.lastError,null);const preview=contextualAttack(mode,mode.units.find(u=>u.id===id),mode.units.find(u=>u.id===targetId));assert.equal(preview.type,'melee');assert.equal(preview.pa,16);
    const shown=presentedActBattle(mode,{type:'useItem',unitId:id,targetId,aim:0}),next=shown.state;assert.equal(next.lastError,null);assert.ok(shown.frames.some(frame=>frame.type==='contact'));const actor=next.units.find(u=>u.id===id),target=next.units.find(u=>u.id===targetId);assert.equal(actor.ap,72);assert.ok(target.hp<100);assert.equal(actor.loaded,unit.loaded);assert.equal(actor.ammo,unit.ammo);assert.equal(actor.condition,unit.condition);assert.equal(actor.weaponInstanceId,unit.weaponInstanceId);assert.equal(actor.weaponFittings.bayonet.instanceId,fitting.instanceId);assert.equal(actor.weaponFittings.bayonet.condition,fitting.condition-1);assert.deepEqual(original,before);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));
  }
  assert.equal(sockets.size,2);
});
