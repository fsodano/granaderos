import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
const {presentCombatEffects}=await import('../web/lib/three/effect-presentation.ts');
const state={width:3,height:3,tiles:Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3),elevation:0})),upperSurfaces:[{x:2,y:2,tacticalLevel:1,elevation:3}]};
const point=(x,y,height)=>({x,y,height});
const shot={visible:true,source:point(0,0,1.4),impact:point(2,2,1.1),outcome:'hit'};
const frame=(visual=shot)=>({sequenceId:'1:2',index:4,type:'projectile',startedAt:1000,durationMs:320,shotVisual:visual});

test('the 3D effect boundary preserves admitted endpoints and never receives the roster or private shot data',()=>{
 const source=structuredClone(state),f=frame({...shot,victimId:'hidden',trajectoryModel:{private:true},flight:[point(100,100,5)]});f.state={units:[{id:'hidden',x:100,y:100}]};
 const result=presentCombatEffects(source,f);assert.equal(result.length,1);assert.deepEqual(result[0],{id:'1:2:4:firearm',kind:'firearm',stage:'projectile',startedAtSeconds:1,durationSeconds:.32,visual:shot});
 assert.deepEqual(source,state);assert.equal(JSON.stringify(result).includes('hidden'),false);assert.equal(JSON.stringify(result).includes('private'),false);
 assert.deepEqual(presentCombatEffects(state,frame({...shot,visible:false})),[]);assert.deepEqual(presentCombatEffects(state,frame({...shot,impact:point(NaN,0,0)})),[]);
});
test('ricochet/penetration segments retain exact identities, heights and discharge suppression',()=>{
 const first=presentCombatEffects(state,frame())[0],continuation=presentCombatEffects(state,{...frame({...shot,source:point(1,1,.8),impact:point(2,2,.2),discharge:false,material:'stone'}),index:6})[0];
 assert.notEqual(first.id,continuation.id);assert.equal(continuation.visual.discharge,false);assert.deepEqual(continuation.visual.source,point(1,1,.8));assert.equal(continuation.visual.material,'stone');
});
test('grenade time stays fixed across playback frames and its landing uses the actual upper surface',()=>{
 const visual={visible:true,source:point(0,0,1.4),impact:{...point(2,2,3),tacticalLevel:1},landing:{x:2,y:2,tacticalLevel:1},points:[point(0,0,1.4),point(1,1,5),point(2,2,3)],radius:2,detonated:true};
 const effect={id:2,startedAt:1500,visual},a=presentCombatEffects(state,{sequenceId:'q',index:2,startedAt:1500,grenadeEffect:effect})[0],b=presentCombatEffects(state,{sequenceId:'q',index:3,startedAt:2100,grenadeEffect:effect})[0];
 assert.deepEqual(a,b);assert.equal(a.startedAtSeconds,1.5);assert.equal(a.visual.landing.elevation,3);assert.deepEqual(a.visual.points,visual.points);
 assert.deepEqual(presentCombatEffects(state,{grenadeEffect:{...effect,visual:{...visual,landing:{x:2,y:2,tacticalLevel:2}}}}),[]);
});
test('local knife events have separate identities and use supplied height before the compatibility fallback',()=>{
 const visual={...shot,weapon:1813},first=presentCombatEffects(state,null,{id:1,startedAt:2000,visual})[0],next=presentCombatEffects(state,null,{id:2,startedAt:2500,visual})[0];
 assert.equal(first.id,'local:knife:1');assert.notEqual(first.id,next.id);assert.equal(first.visual.source.height,1.4);assert.equal(first.durationSeconds,.6);
 const fallback=presentCombatEffects(state,null,{id:3,startedAt:2600,visual:{...visual,source:{x:2,y:2,tacticalLevel:1}}})[0];assert.equal(fallback.visual.source.height,4.4);
});
test('artillery adapter retains only admitted path samples and impact metadata',()=>{
 const visual={visible:true,source:point(0,0,.65),points:[point(0,0,.65),point(2,2,.65)],impact:point(2,2,.65),impacts:[{...point(2,2,1.1),outcome:'hit',unitId:'hidden'}],discharge:false,privateTrace:{secret:true}},result=presentCombatEffects(state,{sequenceId:'q',index:1,startedAt:500,type:'impact',durationMs:900,artilleryVisual:visual})[0];
 assert.equal(result.kind,'artillery');assert.equal(result.stage,'impact');assert.deepEqual(result.visual.points,visual.points);assert.equal(result.visual.discharge,false);assert.deepEqual(result.visual.impacts,[{...point(2,2,1.1),outcome:'hit'}]);assert.equal(JSON.stringify(result).includes('secret'),false);
});
