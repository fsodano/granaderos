import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartialLoadingBattle} from '../web/app/renderer-sandbox/partial-loading-fixture.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

test('legal shots and one paid reload leave insufficient AP for the next whole charge',()=>{
  const battle=createPartialLoadingBattle(),loader=battle.units.find(unit=>unit.id==='partial-loader');
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle))));
  assert.deepEqual(createPartialLoadingBattle(),battle,'The legal order sequence repeats exactly');
  assert.equal(battle.mode,'combat');assert.equal(battle.status,'active');
  assert.equal(loader.loaded,0);assert.equal(loader.ammo,11);assert.equal(loader.ap,31);assert.equal(loader.reloadProgress,undefined);
  const before=structuredClone(battle),partial=actBattle(battle,{type:'reload',unitId:loader.id}),working=partial.units.find(unit=>unit.id===loader.id);
  assert.deepEqual(battle,before);assert.equal(partial.lastError,null);
  assert.equal(working.loaded,0);assert.equal(working.ammo,11);assert.equal(working.ap,0);assert.equal(working.reloadProgress,31/45);
  const next=endTurn(partial),rested=next.units.find(unit=>unit.id===loader.id);
  assert.equal(next.phase,'player');assert.equal(next.status,'active');assert.equal(rested.hp,loader.hp);assert.equal(rested.reloadProgress,31/45);
  const continued=actBattle(next,{type:'reload',unitId:loader.id}),complete=continued.units.find(unit=>unit.id===loader.id);
  assert.equal(continued.lastError,null);assert.equal(complete.loaded,1);assert.equal(complete.ammo,10);assert.equal(complete.ap,rested.ap-14);assert.equal(complete.reloadProgress,undefined);
  assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(continued))));
});
