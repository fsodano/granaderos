import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {PRONE_WORK_TASKS} from '../web/app/renderer-sandbox/prone-work-fixture.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('ordinary prone reload review offers every owned native rifle without replacing earlier work choices',()=>{
  assert.deepEqual(PRONE_WORK_TASKS.filter(task=>task.id.startsWith('rifle-reload-')).map(task=>task.weapon),[1800,1801,1802,1803,1804,1807]);
  for(const task of PRONE_WORK_TASKS.filter(task=>task.id.startsWith('rifle-reload-'))){
    const battle=createRendererSandboxBattle(`prone-work:${task.id}`);
    for(const unit of battle.units.filter(unit=>unit.side==='player')){
      assert.equal(unit.weapon,task.weapon);assert.equal(unit.loaded,0);
      assert.equal(unit.ammo,8);assert.ok(unit.weaponInstanceId.includes(String(task.weapon)));
    }
  }
  for(const id of ['rifle-prime','rifle-unload','pistol-prime','pistol-repair','pistol-reload','paired-pistol-reload'])assert.ok(PRONE_WORK_TASKS.some(task=>task.id===id));
});

test('each prone work choice owns legal finite supplies and performs one ordinary paid order for both anatomies',()=>{
  for(const task of PRONE_WORK_TASKS){
    const battle=createRendererSandboxBattle(`prone-work:${task.id}`),before=structuredClone(battle);
    assert.deepEqual(createRendererSandboxBattle(`prone-work:${task.id}`),battle);
    assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
    for(const id of ['crawler','crawler-woman']){
      const unit=battle.units.find(actor=>actor.id===id),type=task.id.endsWith('prime')?'reprime':task.id.endsWith('unload')?'unloadAmmunition':task.id.endsWith('repair')?'repair':'reload',next=actBattle(battle,{type,unitId:id}),after=next.units.find(actor=>actor.id===id);
      assert.equal(next.lastError,null,task.id);assert.ok(after.ap<unit.ap);
      assert.equal(after.weaponInstanceId,unit.weaponInstanceId);assert.equal(after.stance,'prone');assert.equal(after.movementMode,'prone');
      assert.equal(after.x,unit.x);assert.equal(after.y,unit.y);assert.equal(after.ammo+after.loaded+(after.offHand?.loaded??0),unit.ammo+unit.loaded+(unit.offHand?.loaded??0));
      if(task.paired){assert.equal(after.offHand.loaded,1);assert.equal(after.offHand.instanceId,unit.offHand.instanceId);assert.equal(after.leftHandItem,'offhand');}
      if(type==='reprime')assert.equal(after.jammed,false);
      if(type==='unloadAmmunition')assert.equal(after.loaded,0);
      if(type==='repair'){assert.ok(after.condition>unit.condition);assert.ok(after.toolkitPoints<unit.toolkitPoints);}
      if(type==='reload'){
        if(task.weapon===1802){
          assert.equal(after.loaded,0);assert.equal(after.ammo,unit.ammo);assert.equal(after.ap,0);
          assert.ok(Math.abs(after.reloadProgress-20/21)<1e-12,'the Baker retains its real paid partial reload');
          const resumed=actBattle(endTurn(next),{type:'reload',unitId:id}),finished=resumed.units.find(actor=>actor.id===id);
          assert.equal(resumed.lastError,null);assert.equal(finished.loaded,1);assert.equal(finished.ammo,7);assert.equal(finished.ap,95);
          assert.equal(finished.weaponInstanceId,unit.weaponInstanceId);assert.equal(finished.reloadProgress,undefined);
          assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(resumed))));
        }else assert.equal(after.loaded,1);
      }
      assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));
    }
    assert.deepEqual(battle,before);
  }
  assert.throws(()=>createRendererSandboxBattle('prone-work:unknown'));
});
