import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,knifeThrowPreview,getKnifeThrowVisual} from '../game/tactical.js';
import {heldThrowingKnife} from '../game/thrown-knife.js';
import {attackCursorMode,aimedCursorMode,retainedAttackCursor,knifeThrowInputAction,targetItemAction,targetPreview,aimOptions,tacticalInputAction} from '../game/ja2-hud.js';
import {rightClickAim} from '../game/aim-cursor.js';
import {spriteOrderPose} from '../game/sprite-order-pose.js';
import {tacticalShortcut} from '../game/hotkeys.js';
export const knifeField=()=>createBattle([{id:'p',name:'Lanzador',x:1,y:1,facing:2,marksmanship:85,dexterity:85,agility:85,strength:85,weapon:1800,blade:1813,activeSlot:'blade'}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',name:'Guardia',x:5,y:1,morale:100,overwatch:false,patrol:false}]});

test('explicit aiming uses the actual held facón and default enemy clicks still request melee',()=>{
 const s=knifeField(),u=s.units[0];assert.equal(attackCursorMode(u),'throwKnife');assert.equal(aimedCursorMode('throwKnife'),true);
 assert.deepEqual(targetItemAction('move','e',u),{type:'useItem',targetId:'e'});
 assert.equal(tacticalShortcut({key:'f'}),'fire');
 assert.equal(attackCursorMode({...u,activeSlot:'primary'}),'fire');
 assert.equal(attackCursorMode({...u,blade:1810}),'useItem');
 assert.equal(attackCursorMode({...u,activeSlot:'medical'}),'useItem');
 assert.equal(retainedAttackCursor(u,'throwKnife'),'throwKnife');
 assert.equal(retainedAttackCursor({...u,blade:null},'throwKnife'),'move');
 assert.equal(spriteOrderPose('throwKnife'),'strike');
});

test('knife cursor enters, cycles four affordable aim levels and stays on empty tiles without state changes',()=>{
 const s=knifeField(),u=s.units[0],before=structuredClone(s);let cursor=rightClickAim(s,u,{mode:'move',aim:4});assert.deepEqual(cursor,{mode:'throwKnife',aim:0});
 for(let level=1;level<=4;level++){cursor=rightClickAim(s,u,{...cursor,target:s.units[1]});assert.equal(cursor.aim,level);}
 assert.equal(rightClickAim(s,u,{...cursor,target:s.units[1]}).aim,0);
 assert.deepEqual(rightClickAim(s,u,{...cursor,target:null}),{mode:'throwKnife',aim:0});
 assert.equal(rightClickAim(s,u,{...cursor,target:{x:5,y:2}}).mode,'throwKnife');
 assert.deepEqual(rightClickAim(s,u,{...cursor,target:{id:'absent',x:5,y:2}}),{mode:'move',aim:0});
 assert.equal(rightClickAim(s,u,{...cursor,busy:true}),null);assert.deepEqual(s,before);
});

test('affordable knife aim includes standing and turning and a confirmed throw pays the displayed cost',()=>{
 const s=knifeField(),u=s.units[0],target=s.units[1];u.stance='crouched';u.facing=1;
 const expected=knifeThrowPreview(s,u,target,{aim:2,hitLocation:'head'});u.ap=expected.pa;
 assert.ok(expected.costs.stance>0);assert.ok(expected.costs.turn>0);
 assert.deepEqual(aimOptions(s,u,{mode:'throwKnife',target,hitLocation:'head'}).filter(o=>!o.disabled).map(o=>o.level),[0,1,2]);
 assert.deepEqual(rightClickAim(s,u,{mode:'throwKnife',aim:2,target,hitLocation:'head'}),{mode:'throwKnife',aim:0});
 const preview=targetPreview(s,u,target,{mode:'throwKnife',aim:2,hitLocation:'head'});
 const action=knifeThrowInputAction(s,u,target,{aim:2,hitLocation:'head'});assert.deepEqual(tacticalInputAction(s,u,action),action);
 const next=actBattle(s,{unitId:u.id,...action});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-preview.pa);assert.equal(next.units[0].energy,u.energy-6);
 assert.equal(heldThrowingKnife(next.units[0]),null);assert.equal(retainedAttackCursor(next.units[0],'throwKnife'),'move');
 assert.equal(next.units[0].loaded,u.loaded);assert.equal(next.units[0].ammo,u.ammo);assert.ok(getKnifeThrowVisual(s,next));
});

test('point clicks consume the explicit throw route and cannot become loot, ally selection or corpse use',()=>{
 for(const patch of [{side:'player'},{hp:0},{surrendered:true}]){
  const s=knifeField(),u=s.units[0],target=s.units[1];Object.assign(target,patch);
  const action=knifeThrowInputAction(s,u,target,{aim:2,hitLocation:'head'});
  assert.deepEqual(action,{type:'throwKnife',aim:2,x:5,y:1,tacticalLevel:0,hitLocation:'torso'});
  const preview=targetPreview(s,u,target,{mode:'throwKnife',aim:2,hitLocation:'head'});assert.equal(preview.valid,true);assert.equal(preview.hitLocation,undefined);
  assert.equal(aimOptions(s,u,{mode:'throwKnife',target,hitLocation:'head'}).at(-1).disabled,false);
  assert.equal(actBattle(s,{unitId:u.id,...action}).lastError,null);
 }
 const s=knifeField(),u=s.units[0];for(const point of [{x:4,y:2},{x:4,y:2,anonymous:true,equipment:true},{x:4,y:2,tacticalLevel:1}]){
  const action=knifeThrowInputAction(s,u,point,{aim:3,hitLocation:'legs'});assert.equal(action.type,'throwKnife');assert.equal(action.hitLocation,'torso');assert.equal(action.targetId,undefined);assert.equal(action.tacticalLevel,point.tacticalLevel??0);
 }
});

test('invalid point throws remain explicit and do not spend equipment or AP',()=>{
 const s=knifeField(),u=s.units[0],before=structuredClone(s),point={x:99,y:99};
 const action=knifeThrowInputAction(s,u,point,{aim:4,hitLocation:'head'});assert.equal(action.type,'throwKnife');
 const next=actBattle(s,{unitId:u.id,...action});assert.ok(next.lastError);assert.deepEqual(next.units,s.units);assert.deepEqual(s,before);assert.equal(getKnifeThrowVisual(s,next),null);
});

test('standalone and exploration knife previews show finite costs without pickup or reload language',()=>{
 const s=knifeField(),u=s.units[0];u.loaded=0;u.ammo=0;
 const standalone=targetPreview(s,u,null,{mode:'throwKnife',aim:0});assert.equal(standalone.attackType,'throwKnife');assert.equal(standalone.energy,6);assert.equal(standalone.valid,false);assert.ok(standalone.pa>0);assert.doesNotMatch(JSON.stringify(standalone),/Recargar|cartuchos|recarga/);
 s.mode='exploration';s.units[1].side='player';u.ap=0;
 const preview=targetPreview(s,u,s.units[1],{mode:'throwKnife',aim:4});assert.equal(preview.pa,0);assert.equal(preview.valid,true);assert.equal(preview.remaining,0);
 assert.ok(aimOptions(s,u,{mode:'throwKnife',target:s.units[1]}).every(o=>o.pa===0&&!o.disabled));
 const next=actBattle(s,{unitId:u.id,...knifeThrowInputAction(s,u,s.units[1],{aim:4})});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,0);assert.equal(next.units[0].energy,u.energy-6);
});

test('hidden people cancel aim and prone targets cannot request a subdivided throw',()=>{
 const s=knifeField(),u=s.units[0],target=s.units[1];target.stance='prone';
 assert.equal(knifeThrowInputAction(s,u,target,{hitLocation:'head'}).hitLocation,'torso');
 assert.equal(targetPreview(s,u,target,{mode:'throwKnife',hitLocation:'head'}).valid,false);
 s.night=true;Object.assign(target,{x:15,y:7});
 assert.deepEqual(rightClickAim(s,u,{mode:'throwKnife',aim:2,target}),{mode:'move',aim:0});
 assert.equal(knifeThrowInputAction(s,u,target).targetId,undefined);
});
