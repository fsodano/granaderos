import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {PRONE_WORK_TASKS} from '../web/app/renderer-sandbox/prone-work-fixture.js';
import {actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('each prone work choice owns legal finite supplies and performs one ordinary paid order for both anatomies',()=>{
  for(const task of PRONE_WORK_TASKS){
    const battle=createRendererSandboxBattle(`prone-work:${task.id}`),before=structuredClone(battle);
    assert.deepEqual(createRendererSandboxBattle(`prone-work:${task.id}`),battle);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
    for(const id of ['crawler','crawler-woman']){
      const unit=battle.units.find(actor=>actor.id===id),type=task.id.endsWith('prime')?'reprime':task.id.endsWith('unload')?'unloadAmmunition':task.id.endsWith('repair')?'repair':'reload',next=actBattle(battle,{type,unitId:id}),after=next.units.find(actor=>actor.id===id);
      assert.equal(next.lastError,null,task.id);assert.ok(after.ap<unit.ap);
      assert.equal(after.weaponInstanceId,unit.weaponInstanceId);assert.equal(after.stance,'prone');assert.equal(after.movementMode,'prone');
      assert.equal(after.x,unit.x);assert.equal(after.y,unit.y);assert.equal(after.ammo+after.loaded,unit.ammo+unit.loaded);
      if(type==='reprime')assert.equal(after.jammed,false);
      if(type==='unloadAmmunition')assert.equal(after.loaded,0);
      if(type==='repair'){assert.ok(after.condition>unit.condition);assert.ok(after.toolkitPoints<unit.toolkitPoints);}
      if(type==='reload')assert.equal(after.loaded,1);
      assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));
    }
    assert.deepEqual(battle,before);
  }
  assert.throws(()=>createRendererSandboxBattle('prone-work:unknown'));
});
