import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('blast review uses real finite grenade orders and valid durable geometry',()=>{
 const initial=createRendererSandboxBattle('blast-damage');
 assert.ok(validateBattleSnapshot(structuredClone(initial)));
 assert.equal(initial.units[0].inventory.grenade.count,8);
 for(const [y,material,expected]of [[4,'wood',100],[8,'adobe',38],[12,'stone',14]]){
  const edge=initial.wallEdges.find(edge=>edge.type==='wall'&&edge.material===material);
  assert.ok(edge);
  const next=actBattle(initial,{type:'throwGrenade',unitId:'blast-guard',x:9,y});
  assert.equal(next.lastError,null);assert.equal(next.units[0].inventory.grenade.count,7);
  assert.equal(next.wallEdges.find(wall=>wall.id===edge.id).structureDamage,expected);
  assert.ok(validateBattleSnapshot(structuredClone(next)));
  assert.equal(edge.structureDamage,undefined);
 }
 const next=actBattle(initial,{type:'throwGrenade',unitId:'blast-guard',x:7,y:10});
 assert.equal(next.lastError,null);assert.equal(next.props.find(p=>p.id==='blast-chest').destroyed,true);
 assert.equal(next.props.find(p=>p.id==='blast-chest').contents[0].count,2);
 assert.ok(validateBattleSnapshot(structuredClone(next)));
});
