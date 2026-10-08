import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle,CROUCH_REVIEW_EQUIPMENT} from '../web/app/renderer-sandbox/fixtures.js';
import {actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('each owned crouched weapon keeps both anatomies and finite equipment through ordinary sideways travel',()=>{
  for(const gear of CROUCH_REVIEW_EQUIPMENT){
    const battle=createRendererSandboxBattle(`equipped-crouch:${gear.id}`),before=structuredClone(battle);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
    assert.equal(battle.units.length,2);
    assert.deepEqual(battle.units.map(unit=>unit.spriteAppearance),['granadero','woman-scout']);
    for(const unit of battle.units){
      assert.equal(unit.weapon,gear.weapon);assert.equal(unit.stance,'crouched');
      const moved=actBattle(battle,{type:'move',unitId:unit.id,x:unit.x,y:unit.y-1,movementIntent:'preserveFacing'});
      assert.equal(moved.lastError,null);const after=moved.units.find(actor=>actor.id===unit.id);
      assert.equal(after.x,unit.x);assert.equal(after.y,unit.y-1);assert.equal(after.facing,unit.facing);
      for(const key of ['weapon','weaponInstanceId','loaded','ammo','inventory','stance','movementMode'])assert.deepEqual(after[key],unit[key],key);
      assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(moved))));
    }
    assert.deepEqual(battle,before);
  }
  assert.throws(()=>createRendererSandboxBattle('equipped-crouch:unknown'));
});
