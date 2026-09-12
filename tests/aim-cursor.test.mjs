import test from 'node:test';
import assert from 'node:assert/strict';
import {aimedBodyPart,targetHitFrame,rightClickAim} from '../game/aim-cursor.js';
import {createBattle,actBattle,actionCosts,firearmShotOptions} from '../game/tactical.js';
import {targetPreview,aimOptions} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=()=>createBattle([{id:'p',x:1,y:1,marksmanship:85,weapon:1800,blade:1810}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:1,morale:100,overwatch:false}]});

test('right-click enters aiming without turning, firing, spending AP or advancing time',()=>{
 const s=field(),saved=structuredClone(s),u=s.units[0];const cursor=rightClickAim(s,u,{mode:'move',aim:4});assert.deepEqual(cursor,{mode:'fire',aim:0});assert.deepEqual(s,saved);
 let next=cursor;for(let i=1;i<=4;i++){next=rightClickAim(s,u,{...next,target:s.units[1]});assert.equal(next.aim,i);}assert.equal(rightClickAim(s,u,{...next,target:s.units[1]}).aim,0);assert.deepEqual(s,saved);
});
test('additional right clicks respect the affordable aim limit and the confirmed shot pays the displayed AP',()=>{
 const s=field(),u=s.units[0],target=s.units[1],costs=actionCosts(s,u);u.ap=costs.fire+2*costs.aim;
 let cursor=rightClickAim(s,u,{});cursor=rightClickAim(s,u,{...cursor,target});cursor=rightClickAim(s,u,{...cursor,target});assert.equal(cursor.aim,2);assert.equal(rightClickAim(s,u,{...cursor,target}).aim,0);
 const hitLocation=aimedBodyPart(target,.1),preview=targetPreview(s,u,target,{...cursor,hitLocation});assert.equal(hitLocation,'head');assert.equal(preview.pa,u.ap);assert.equal(preview.valid,true);
 const next=actBattle(s,{type:'fire',unitId:u.id,targetId:target.id,aim:cursor.aim,hitLocation});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-preview.pa);assert.equal(next.units[0].loaded,u.loaded-1);assert.equal(next.units[1].lastHitLocation,'head');assert.doesNotThrow(()=>validateBattleSnapshot(next));
});
test('standing and crouched frame areas select head, torso and legs independently of camera scale',()=>{
 for(const stance of ['standing','crouched'])for(const zoom of [1,2,3]){
  const target={stance},frame=targetHitFrame(target,{x:100,y:150});for(const [fraction,part] of [[.1,'head'],[.4,'torso'],[.9,'legs']]){const top=frame.y*zoom,clientY=top+frame.height*zoom*fraction;assert.equal(aimedBodyPart(target,(clientY-top)/(frame.height*zoom)),part);}
 }
});
test('prone and fallen targets have one region in pointer selection, AI choices, preview and the combat reducer',()=>{
 for(const state of [{stance:'prone'},{stance:'standing',knockedDown:true},{stance:'standing',unconscious:true},{stance:'standing',hp:10},{stance:'standing',energy:0}]){
  const s=field(),u=s.units[0],target=s.units[1];Object.assign(target,state);
  for(const fraction of [0,.3,.7,1])assert.equal(aimedBodyPart(target,fraction),'torso');
  assert.ok(firearmShotOptions(s,u,target).every(option=>option.hitLocation==='torso'));
  for(const hitLocation of ['head','legs']){const preview=targetPreview(s,u,target,{mode:'fire',hitLocation});assert.equal(preview.valid,false);const next=actBattle(s,{type:'fire',unitId:u.id,targetId:target.id,hitLocation});assert.match(next.lastError,/una sola zona/);assert.deepEqual({...next,lastError:null,log:[]},{...s,lastError:null,log:[]});}
  const next=actBattle(s,{type:'fire',unitId:u.id,targetId:target.id,hitLocation:aimedBodyPart(target,.1)});assert.equal(next.lastError,null);
 }
});
test('hidden target posture cannot be inferred from a rejected aimed shot',()=>{
 const s=field(),u=s.units[0],target=s.units[1];s.night=true;Object.assign(target,{x:15,y:7,stance:'prone'});const next=actBattle(s,{type:'fire',unitId:u.id,targetId:target.id,hitLocation:'head'});assert.match(next.lastError,/ver ese objetivo/);assert.doesNotMatch(next.lastError,/cuerpo a tierra/);
});
test('unloaded or unaffordable weapons can enter the cursor but cannot buy aim or fire',()=>{
 for(const change of [u=>u.loaded=0,u=>u.ap=0,u=>u.jammed=true]){const s=field(),u=s.units[0];change(u);const options=aimOptions(s,u);assert.ok(options.every(option=>option.disabled));const cursor=rightClickAim(s,u,{mode:'fire',aim:4});if(cursor)assert.equal(cursor.aim,0);const before=structuredClone(s);const next=actBattle(s,{type:'fire',unitId:u.id,targetId:'e'});assert.ok(next.lastError);assert.deepEqual({...next,lastError:null,log:[]},{...before,lastError:null,log:[]});}
});
test('right-click preserves equipped-item use and refuses input during another side or animation',()=>{
 const s=field(),u=s.units[0];u.activeSlot='medical';Object.assign(u,{hp:80,bleeding:2,medical:80,medkits:2});assert.deepEqual(rightClickAim(s,u,{}),{mode:'useItem',aim:0});assert.equal(rightClickAim(s,u,{busy:true}),null);
 const next=actBattle(s,{type:'useItem',unitId:u.id,targetId:u.id});assert.equal(next.lastError,null);assert.equal(next.units[0].bleeding,0);assert.equal(next.units[0].medkits,1);
 s.phase='enemy';assert.equal(rightClickAim(s,u,{}),null);
});

test('right-click off a character cancels aiming without spending AP or losing ground-fire access',()=>{
 const s=field(),u=s.units[0],before=structuredClone(s);
 for(const target of [null,{x:8,y:3},{id:'missing',x:8,y:3}])for(const mode of ['fire','useItem'])assert.deepEqual(rightClickAim(s,u,{mode,aim:3,target}),{mode:'move',aim:0});
 const entered=rightClickAim(s,u,{mode:'move',target:{x:8,y:3}});assert.deepEqual(entered,{mode:'fire',aim:0});
 assert.deepEqual(s,before);const shot=actBattle(s,{type:'firePoint',unitId:u.id,x:8,y:3,aim:entered.aim});assert.equal(shot.lastError,null);assert.equal(shot.units[0].loaded,u.loaded-1);
 u.ap=0;assert.deepEqual(rightClickAim(s,u,{mode:'fire',aim:2}),{mode:'move',aim:0});assert.equal(rightClickAim(s,u,{mode:'fire',busy:true}),null);
});
test('only a present visible character keeps aim active, including prone characters',()=>{
 const s=field(),u=s.units[0],target=s.units[1];
 for(const stance of ['standing','crouched','prone']){target.stance=stance;assert.deepEqual(rightClickAim(s,u,{mode:'fire',aim:1,target}),{mode:'fire',aim:2});}
 for(const patch of [{fled:true},{departure:{edge:'E'}},{x:15,y:7}]){const hidden=structuredClone(s);hidden.night=true;Object.assign(hidden.units[1],patch);assert.deepEqual(rightClickAim(hidden,hidden.units[0],{mode:'fire',aim:3,target}),{mode:'move',aim:0});}
});
