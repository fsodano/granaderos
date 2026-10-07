import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,presentedActBattle} from '../game/tactical.js';
import {BATTLE_PLAYBACK} from '../game/battle-playback.js';
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
function fixture(vertical=false){
 const from={x:3,y:4,tacticalLevel:0},to={x:vertical?3:4,y:4,tacticalLevel:1};
 return createBattle([{id:'climber',...from,spriteAppearance:'woman-scout',activeSlot:'unarmed',energy:100}],{width:10,height:10,tiles:Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',elevation:.4,blocked:false,cover:0})),upperSurfaces:[{id:'platform',...to,elevation:3.4,kind:'platform',type:'floor',blocked:false,cover:0}],climbLinks:[{id:'access',kind:'climb',from,to}],exploration:true,enemies:[]});
}
for(const vertical of [false,true])test(`recorded ${vertical?'vertical':'inclined'} climb retains measured pace and paid endpoints`,()=>{
 let state=fixture(vertical);
 for(let direction=0;direction<2;direction++){
  const before=structuredClone(state),result=presentedActBattle(state,{type:'climb',unitId:'climber',linkId:'access'}),step=result.frames.find(frame=>frame.type==='step');
  assert.equal(result.state.lastError,null);assert.ok(step);assert.deepEqual(state,before);
  const duration=presentedFrameDuration(step,state),nativeInterval=movementStepDuration(state.units[0],{x:3,y:4,renderedHeight:direction?3.4:.4},{x:vertical?3:4,y:4,kind:'climb',renderedHeight:direction?.4:3.4});
  assert.ok(Math.abs(duration-nativeInterval)<.001);assert.ok(duration>=3/.65*1000,'A full native interval cannot exceed the measured vertical pace');
  assert.equal(step.state.units[0].lastMovePath.at(-1).linkId,'access');
  assert.equal(result.state.units[0].tacticalLevel,direction===0?1:0);
  state=result.state;
 }
});
test('a distant reappearing climb actor keeps ordinary admission timing',()=>{
 const previous=fixture(),result=presentedActBattle(previous,{type:'climb',unitId:'climber',linkId:'access'}),step=result.frames.find(frame=>frame.type==='step'),hidden=structuredClone(previous);
 hidden.units[0].x=0;assert.equal(presentedFrameDuration(step,hidden),BATTLE_PLAYBACK.step);
 assert.equal(presentedFrameDuration({...step,unitId:'missing'},previous),BATTLE_PLAYBACK.step);
});
