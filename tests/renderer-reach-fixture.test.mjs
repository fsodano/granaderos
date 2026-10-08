import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('both anatomy groups use paid care, ground pickup and self release with finite owned supplies',()=>{
  const battle=createRendererSandboxBattle('reach-actions'),before=structuredClone(battle);
  assert.deepEqual(createRendererSandboxBattle('reach-actions'),battle);
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
  for(const anatomy of ['male','female'])for(const role of ['healer','pickup','free']){
    const unitId=`reach-${role}-${anatomy}`,unit=battle.units.find(actor=>actor.id===unitId);
    const action=role==='healer'?{type:'heal',unitId,targetId:`reach-patient-${anatomy}`}:role==='pickup'?{type:'lootBatch',unitId,items:[{groundId:`reach-dressings-${anatomy}`,count:1}]}:{type:'free',unitId};
    const shown=presentedActBattle(battle,action),next=shown.state,after=next.units.find(actor=>actor.id===unitId);
    assert.equal(next.lastError,null,role);assert.ok(shown.frames.length>1,'Real prepare and result presentation');
    assert.ok(after.ap<unit.ap);assert.equal(after.x,unit.x);assert.equal(after.y,unit.y);
    for(const key of ['weapon','weaponInstanceId','loaded','ammo'])assert.deepEqual(after[key],unit[key],key);
    if(role==='healer'){
      assert.ok(after.medkits<unit.medkits);assert.ok(next.units.find(actor=>actor.id===action.targetId).bleeding<10);
    }else if(role==='pickup'){
      assert.equal(unit.ap-after.ap,8);assert.equal(after.medkits,unit.medkits+1);assert.equal(next.groundItems.find(item=>item.id===`reach-dressings-${anatomy}`).count,1);
    }else{
      assert.equal(unit.ap-after.ap,15);assert.equal(after.entangled,false);assert.equal(next.groundItems.find(item=>item.id===`reach-bolas-${anatomy}`).heldBy,null);
    }
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));assert.deepEqual(battle,before);
  }
});
