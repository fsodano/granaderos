import test from 'node:test';
import assert from 'node:assert/strict';
import {createRendererSandboxBattle,RENDERER_SCENARIOS} from '../web/app/renderer-sandbox/fixtures.js';
import {createProjectileReviewBattle,projectileReviewOrder,PROJECTILE_CASES} from '../web/app/renderer-sandbox/projectile-fixture.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

for(const {id} of PROJECTILE_CASES)test(`projectile review ${id} uses a real finite shot and preserves the ordinary saved result`,()=>{
 const s=createRendererSandboxBattle(`projectiles:${id}`),before=structuredClone(s),action=projectileReviewOrder(id),result=presentedActBattle(s,action),frames=result.frames.filter(frame=>frame.type==='projectile'),target=result.state.units.find(unit=>unit.id==='projectile-target'),shooter=result.state.units.find(unit=>unit.id==='projectile-gunner');
 assert.deepEqual(s,createProjectileReviewBattle(id));assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(s,action));assert.deepEqual(s,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result.state))),result.state);
 assert.equal(shooter.loaded,0);assert.equal(shooter.ammo,8);assert.ok(shooter.ap<s.units[0].ap);assert.equal(result.state.elapsedSeconds,6);assert.equal(frames.length,id==='paired'?2:1);
 for(const frame of frames){assert.ok(frame.shotVisual.points.length>=2);assert.deepEqual(frame.shotVisual.points.at(-1),frame.shotVisual.impact);assert.doesNotMatch(JSON.stringify(frame.shotVisual),/victimId|trajectoryModel|sourceId/);}
 if(id==='hit')assert.ok(target.hp<100);
 if(id==='miss'){assert.equal(target.hp,100);assert.equal(frames[0].shotVisual.outcome,'miss');assert.ok(frames[0].shotVisual.points.filter(point=>Math.abs(point.x-9)<.5).every(point=>Math.abs(point.y-5)>.5),'the lateral miss does not cross the selected body');}
 if(id==='rock'){assert.equal(target.hp,100);assert.equal(frames[0].shotVisual.outcome,'cover');assert.equal(frames[0].shotVisual.material,'stone');assert.ok(frames[0].shotVisual.impact.x<8.5);}
 if(id==='paired'){assert.deepEqual(frames.map(frame=>frame.shotVisual.shotHand),['primary','offhand']);assert.notEqual(frames[0].shotId,frames[1].shotId);assert.equal(shooter.offHand.loaded,0);assert.ok(target.hp<100);}
 if(id==='gravity'){assert.equal(target.hp,100);assert.ok(frames[0].shotVisual.impact.x>30);assert.ok(frames[0].shotVisual.impact.height<.7);}
});
test('projectile review is registered and rejects unknown cases',()=>{assert.ok(RENDERER_SCENARIOS.some(item=>item.id==='projectiles'));assert.throws(()=>createProjectileReviewBattle('unknown'),/Unknown projectile/);});
