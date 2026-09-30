import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,grenadeThrowPreview,getGrenadeThrowVisual} from '../game/tactical.js';
import {heldGrenade} from '../game/grenade-throw.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {attackCursorMode,aimedCursorMode,retainedAttackCursor,grenadeTargetingMode,grenadeThrowInputAction,targetPreview,aimOptions,shotLocationOptions,resolvedOrderType,tacticalInputAction,targetingHelp,equippedItemHelp} from '../game/ja2-hud.js';
import {rightClickAim} from '../game/aim-cursor.js';
const field=()=>createBattle([{id:'p',name:'Lanzador',x:1,y:1,facing:2,marksmanship:85,dexterity:85,strength:85,weapon:1800,loaded:1,ammo:5,blade:0,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Guardia',x:6,y:1,hp:100,morale:100,overwatch:false,patrol:false}]});

test('grenade targeting requires the actual main-hand object and ends when that object is spent',()=>{
 const s=field(),u=s.units[0];assert.ok(heldGrenade(u));assert.equal(attackCursorMode(u),'throwGrenade');assert.equal(aimedCursorMode('throwGrenade'),true);assert.equal(retainedAttackCursor(u,'throwGrenade'),'throwGrenade');
 for(const mode of ['useItem','throwGrenade'])assert.equal(grenadeTargetingMode(u,mode),true);
 assert.equal(attackCursorMode({...u,activeSlot:'primary'}),'fire');assert.equal(attackCursorMode({...u,activeSlot:'unarmed',leftHandItem:u.activeItem}),'useItem');assert.equal(retainedAttackCursor({...u,inventory:{}},'throwGrenade'),'move');
 assert.equal(grenadeTargetingMode(u,'move'),false);assert.equal(grenadeTargetingMode({...u,activeSlot:'unarmed'},'move'),false);assert.equal(grenadeTargetingMode(u,'talk'),false);
});
test('grenade right-click enters a fixed-cost cursor and the second click cancels on people or ground',()=>{
 const s=field(),u=s.units[0],before=structuredClone(s),cursor=rightClickAim(s,u,{mode:'move',aim:4,target:s.units[1]});assert.deepEqual(cursor,{mode:'throwGrenade',aim:0});
 for(const target of [s.units[1],u,{x:5,y:3},null])assert.deepEqual(rightClickAim(s,u,{...cursor,aim:4,target}),{mode:'move',aim:0});
 assert.equal(rightClickAim(s,u,{...cursor,busy:true}),null);assert.deepEqual(s,before);
});
test('grenade costs and chance do not change with stale aim or body-region settings',()=>{
 const s=field(),u=s.units[0],target=s.units[1],preview=targetPreview(s,u,target,{mode:'throwGrenade',aim:0});
 assert.equal(preview.valid,true);assert.equal(preview.attackType,'throwGrenade');assert.ok(preview.blastRadius>0);assert.equal(preview.hitLocation,undefined);
 assert.deepEqual(targetPreview(s,u,target,{mode:'throwGrenade',aim:4,hitLocation:'head'}),preview);assert.deepEqual(shotLocationOptions(s,u,{mode:'throwGrenade',target}),[]);
 const options=aimOptions(s,u,{mode:'throwGrenade',target});assert.equal(options.length,1);assert.deepEqual(options[0],{level:0,pa:preview.pa,disabled:false});
 u.ap=preview.pa-1;assert.equal(aimOptions(s,u,{mode:'throwGrenade',target})[0].disabled,true);
});
test('people, corpses, allies and NPCs all produce point throws without dialogue or body targeting',()=>{
 const s=field(),u=s.units[0];s.npcs=[{id:'civil',name:'Vecino',x:5,y:2}];
 for(const point of [s.units[1],{...s.units[1],hp:0},{...s.units[1],side:'player'},s.npcs[0],{x:5,y:3},{x:5,y:3,tacticalLevel:1}]){
  const action=grenadeThrowInputAction(s,u,point,{aim:4,hitLocation:'head'});assert.deepEqual(action,{type:'throwGrenade',x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0,aim:0});assert.deepEqual(tacticalInputAction(s,u,action),action);
 }
 for(const mode of ['useItem','throwGrenade']){const preview=targetPreview(s,u,s.npcs[0],{mode});assert.equal(preview.attackType,'throwGrenade');assert.equal(preview.actionLabel,'Lanzar granada');assert.doesNotMatch(preview.coverNote,/entrega|reserva del cuartel/);}
 assert.equal(resolvedOrderType(s,u,{type:'useItem',targetId:'civil'}),'throwGrenade');
});
test('a confirmed point throw pays the displayed cost and consumes the held grenade, not the stored firearm',()=>{
 const s=field(),u=s.units[0],point={x:6,y:2},before=structuredClone(s),preview=targetPreview(s,u,point,{mode:'throwGrenade'}),next=actBattle(s,{unitId:'p',...grenadeThrowInputAction(s,u,point)});
 assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-preview.pa);assert.equal(heldGrenade(next.units[0]),null);assert.equal(retainedAttackCursor(next.units[0],'throwGrenade'),'move');assert.equal(next.units[0].loaded,u.loaded);assert.equal(next.units[0].ammo,u.ammo);assert.ok(getGrenadeThrowVisual(s,next));assert.deepEqual(s,before);
});
test('exploration grenade use omits AP costs and incomplete targets cannot spend inventory',()=>{
 const s=field(),u=s.units[0];s.mode='exploration';s.units=[u];u.ap=0;const point={x:6,y:2},preview=targetPreview(s,u,point,{mode:'throwGrenade'});
 assert.equal(preview.pa,0);assert.equal(preview.remaining,0);assert.equal(preview.valid,true);assert.equal(aimOptions(s,u,{mode:'throwGrenade',target:point})[0].pa,0);
 const noTarget=targetPreview(s,u,null,{mode:'throwGrenade'});assert.equal(noTarget.valid,false);assert.equal(noTarget.attackType,'throwGrenade');
 const bad=actBattle(s,{unitId:'p',...grenadeThrowInputAction(s,u,{x:99,y:99})});assert.ok(bad.lastError);assert.deepEqual(bad.units,s.units);assert.equal(getGrenadeThrowVisual(s,bad),null);
 const next=actBattle(s,{unitId:'p',...grenadeThrowInputAction(s,u,point)});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,0);assert.equal(next.units[0].energy,u.energy);
});
test('the target preview states observed ally risk, range and area effect',()=>{
 const s=field(),u=s.units[0];s.units.push({...structuredClone(u),id:'ally',x:5,y:2});const point={x:6,y:2},raw=grenadeThrowPreview(s,u,point),preview=targetPreview(s,u,point,{mode:'useItem'});
 assert.equal(preview.friendlyRisk,true);assert.match(preview.coverNote,/Aliados dentro del radio/);assert.ok(preview.coverNote.includes(String(raw.blastRadius)));assert.match(preview.coverNote,/Alcance/);
 assert.match(targetingHelp('move',u),/Granada/);assert.match(equippedItemHelp(s,u),/Granada/);assert.doesNotMatch(equippedItemHelp(s,u),/Objeto en mano/);
});
test('blocked grenade previews identify the nearer landing and do not advertise accuracy at the intended point',()=>{
 const s=field(),u=s.units[0];Object.assign(s.tiles.find(tile=>tile.x===4&&tile.y===1),{type:'wall',blocked:true,obstacleHeight:6});
 const point={x:6,y:1},raw=grenadeThrowPreview(s,u,point),preview=targetPreview(s,u,point,{mode:'throwGrenade'});
 assert.equal(raw.valid,true);assert.equal(raw.flight.blocked,true);assert.equal(preview.blocked,true);assert.deepEqual(preview.landing,raw.flight.landing);assert.ok(preview.landing.x<4);assert.equal(preview.chance,undefined);assert.match(preview.coverNote,/obstáculo.*Caída prevista/);assert.ok(preview.coverNote.includes(preview.landingLabel));assert.equal(preview.friendlyRisk,true);
});
