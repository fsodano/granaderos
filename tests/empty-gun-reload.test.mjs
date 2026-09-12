import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,reloadCost,weaponFor} from '../game/tactical.js';
import {tacticalInputAction,targetPreview,equippedItemHelp} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(weapon=1800,exploration=false)=>createBattle([{id:'p',x:1,y:1,marksmanship:85,weapon,blade:1810}],{width:12,height:8,exploration,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:exploration?[]:[{id:'e',x:5,y:1,morale:100,overwatch:false}]});
const click=(s,a)=>actBattle(s,{unitId:'p',...tacticalInputAction(s,s.units[0],a)});
const physical=s=>({...s,log:[],lastError:null});

test('empty character, ground and contextual firing clicks reload once and spend only the displayed cost',()=>{
 for(const a of [{type:'fire',targetId:'e'},{type:'firePoint',x:8,y:3},{type:'useItem',targetId:'e'}]){
  const s=field(),u=s.units[0];Object.assign(u,{loaded:0,ammo:4,ap:100});
  const before=structuredClone(s),preview=targetPreview(s,u,s.units[1],{mode:a.type==='useItem'?'move':'fire',aim:4,hitLocation:'head'});
  assert.equal(preview.valid,true);assert.equal(preview.attackType,'reload');assert.equal(preview.pa,reloadCost(u,s));assert.equal(preview.chance,undefined);
  const next=click(s,{...a,aim:4,hitLocation:'head'}),v=next.units[0];
  assert.equal(next.lastError,null);assert.equal(v.loaded,1);assert.equal(v.ammo,3);assert.equal(v.ap,u.ap-preview.pa);assert.equal(v.facing,u.facing);
  assert.equal(next.units[1].hp,s.units[1].hp);assert.deepEqual(next.smoke,s.smoke);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(next));
  assert.match(equippedItemHelp(s,u,{mode:'fire'}),/Recargar/);
 }
});
test('reload fills only available capacity and rounds, with stance cost and no extra aim charge',()=>{
 for(const ammo of [1,2,7])for(const stance of ['standing','prone']){
  const s=field(1808),u=s.units[0];Object.assign(u,{loaded:0,ammo,stance,ap:100});const capacity=weaponFor(u).capacity;assert.equal(capacity,2);
  const preview=targetPreview(s,u,null,{mode:'fire',aim:4}),next=click(s,{type:'firePoint',x:8,y:3,aim:4});
  assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,Math.min(ammo,capacity));assert.equal(next.units[0].ammo,Math.max(0,ammo-capacity));assert.equal(next.units[0].ap,u.ap-preview.pa);assert.equal(preview.rounds,next.units[0].loaded);
 }
});
test('an exhausted gun shows an X state; rejected clicks change no physical state or time',()=>{
 const s=field(),u=s.units[0];Object.assign(u,{loaded:0,ammo:0});
 for(const point of [null,s.units[1],{x:8,y:3}]){const p=targetPreview(s,u,point,{mode:'fire'});assert.equal(p.cursor,'empty');assert.equal(p.valid,false);assert.equal(p.pa,0);assert.equal(p.remaining,u.ap);assert.match(p.reason,/Sin munición/);}
 for(const a of [{type:'fire',targetId:'e'},{type:'firePoint',x:8,y:3}]){const next=click(s,a);assert.ok(next.lastError);assert.deepEqual(physical(next),physical(s));}
 u.ammo=1;assert.equal(targetPreview(s,u,null,{mode:'fire'}).cursor,'reload');
});
test('a loaded last round still fires with no reserve; a subsequent click cannot shoot or reload',()=>{
 const s=field(),u=s.units[0];Object.assign(u,{loaded:1,ammo:0,ap:100});const a={type:'firePoint',x:8,y:3};assert.deepEqual(tacticalInputAction(s,u,a),a);
 const next=click(s,a);assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ammo,0);assert.equal(targetPreview(next,next.units[0],null,{mode:'fire'}).cursor,'empty');
 const failed=click(next,a);assert.ok(failed.lastError);assert.deepEqual(physical(failed),physical(next));
});
test('reload attempts retain AP, jam, knockdown and turn guards',()=>{
 for(const change of [(s,u)=>u.ap=0,(s,u)=>u.jammed=true,(s,u)=>u.knockedDown=true,(s)=>s.phase='enemy']){
  const s=field(),u=s.units[0];Object.assign(u,{loaded:0,ammo:2});change(s,u);
  assert.equal(targetPreview(s,u,null,{mode:'fire'}).valid,false);const next=click(s,{type:'fire',targetId:'e'});assert.ok(next.lastError);assert.deepEqual(physical(next),physical(s));
 }
});
test('exploration reload advances exactly one reload duration without spending AP',()=>{
 const s=field(1808,true),u=s.units[0];Object.assign(u,{loaded:0,ammo:1});const cost=reloadCost(u,s),next=click(s,{type:'firePoint',x:8,y:3,aim:4});assert.equal(next.lastError,null);assert.equal(next.elapsedSeconds,Math.max(1,Math.ceil(cost*.06)));assert.equal(next.units[0].ap,u.ap);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].ammo,0);
});
test('contextual fitted bayonet thrusts and equipped medical items stay contextual',()=>{
 const s=field(),u=s.units[0],e=s.units[1];Object.assign(u,{weaponMode:'melee',loaded:0,ammo:0,weaponFittings:{bayonet:{weapon:1811,condition:100,instanceId:'test-bayonet',fittingPattern:'india_socket'}}});e.x=2;
 const use={type:'useItem',targetId:'e'};assert.deepEqual(tacticalInputAction(s,u,use),use);assert.equal(targetPreview(s,u,e,{mode:'move'}).attackType,'melee');assert.equal(tacticalInputAction(s,u,{type:'fire',targetId:'e'}).type,'reload');
 for(const activeSlot of ['medical','blade','tool','supply','unarmed']){u.activeSlot=activeSlot;assert.deepEqual(tacticalInputAction(s,u,use),use);}
});

test('the click after a successful reload fires normally and consumes the loaded round only',()=>{
 const s=field(),u=s.units[0];Object.assign(u,{loaded:0,ammo:2,ap:100});const a={type:'firePoint',x:8,y:3};
 const reloaded=click(s,a),v=reloaded.units[0],preview=targetPreview(reloaded,v,a,{mode:'fire'});assert.equal(preview.attackType,'fire');assert.equal(preview.valid,true);
 const fired=click(reloaded,a);assert.equal(fired.lastError,null);assert.equal(fired.units[0].loaded,0);assert.equal(fired.units[0].ammo,1);assert.equal(fired.units[0].ap,v.ap-preview.pa);
});
