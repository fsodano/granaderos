import {formatAP} from '../game/action-points.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {targetPreview,equippedItemHelp,orderDescriptors} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';

function field(actor={},target={},sector={}){
 const s=createBattle([{id:'p',name:'Patriota',x:2,y:2,weapon:1809,blade:0,stance:'prone',movementMode:'prone',facing:2,strength:100,dexterity:100,agility:100,experienceLevel:10,...actor}],{
  width:14,height:10,seed:45,tiles:Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',name:'Realista',x:3,y:2,hp:100,agility:0,dexterity:0,experienceLevel:1,patrol:false,overwatch:false,...target},{id:'reserve',x:12,y:8,patrol:false,overwatch:false}],...sector,
 });
 s.units[0].ap=actor.ap??100;for(const unit of s.units.filter(u=>u.side==='enemy'))unit.ap=0;return s;
}
const pair=s=>[s.units[0],s.units.find(u=>u.id==='e')];

test('adjacent prone melee previews disclose stand plus strike and match the accepted order',()=>{
 for(const [actor,strike,label]of [
  [{weapon:1809},12,'Sable'],
  [{weapon:0,activeSlot:'unarmed'},12,'Puños'],
  [{weapon:1800,weaponMode:'melee'},16,'Culatazo'],
  [{weapon:1800,weaponMode:'melee',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'socket'}}},16,'Estocada de bayoneta'],
 ]){
  const s=field(actor),[u,e]=pair(s),before=structuredClone(s);
  for(const mode of ['move','useItem','melee']){
   const p=targetPreview(s,u,e,{mode});assert.equal(p.valid,true);assert.equal(p.pa,strike+6);assert.equal(p.remaining,100-strike-6);assert.equal(p.actionLabel,'Levantarse y atacar');assert.ok(p.attackLabel.includes(label));assert.match(p.coverNote,new RegExp(`Levantarse: 1,5 PA.*ataque: ${formatAP(strike)} PA`));
   assert.match(equippedItemHelp(s,u,{mode,target:e}),new RegExp(`${formatAP(strike+6)} PA.*Levantarse: 1,5 PA.*ataque: ${formatAP(strike)} PA`));
  }
  for(const id of ['melee','useItem']){const d=orderDescriptors(s,u,{target:e}).find(d=>d.id===id);assert.equal(d.pa,strike+6);assert.equal(d.disabled,false);}
  assert.deepEqual(s,before);
  const n=actBattle(s,{type:'useItem',unitId:u.id,targetId:e.id});assert.equal(n.lastError,null);assert.equal(n.units[0].stance,'standing');assert.equal(n.units[0].ap,100-strike-6);
  const short=field({...actor,ap:strike+5}),[a,b]=pair(short);assert.equal(targetPreview(short,a,b).valid,false);
  for(const id of ['melee','useItem'])assert.equal(orderDescriptors(short,a,{target:b}).find(d=>d.id===id).disabled,true);
 }
});

test('crawl approach preview and public target card include movement, stand and attack',()=>{
 const s=field({}, {x:6}),[u,e]=pair(s),p=targetPreview(s,u,e);
 assert.equal(p.valid,true);assert.equal(p.actionLabel,'Acercarse y atacar');assert.match(p.coverNote,/Desplazamiento: \d+(?:,\d+)? PA.*Levantarse: 1,5 PA.*ataque: 3 PA/);
 const n=actBattle(s,{type:'useItem',unitId:u.id,targetId:e.id});assert.equal(n.lastError,null);assert.equal(n.units[0].stance,'standing');assert.equal(n.units[0].ap,u.ap-p.pa);assert.ok(n.units[0].x>u.x);
 const card=playerKnownBattle(s).orders.find(o=>o.unitId===u.id).targets.find(t=>t.targetId===e.id);assert.equal(card.pa,p.pa);assert.equal(card.coverNote,p.coverNote);assert.equal(card.path,undefined);
 const local=targetPreview(s,u,e,{mode:'melee'});assert.equal(local.valid,false);assert.equal(local.pa,18);assert.equal(orderDescriptors(s,u,{target:e}).find(d=>d.id==='melee').disabled,true);
});

test('exploration hides combat AP costs but explains standing; firearm and crouched previews stay unchanged',()=>{
 const s=field({ap:0}),[u,e]=pair(s);s.mode='exploration';
 const p=targetPreview(s,u,e);assert.equal(p.valid,true);assert.equal(p.pa,0);assert.equal(p.remaining,0);assert.match(p.coverNote,/se levanta antes de atacar/i);assert.doesNotMatch(p.coverNote,/\d+(?:,\d+)? PA/);assert.match(equippedItemHelp(s,u,{target:e}),/0 PA/);assert.doesNotMatch(equippedItemHelp(s,u,{target:e}),/1,5 PA/);
 const crouched=field({stance:'crouched',movementMode:'crouch'}),[c,t]=pair(crouched),cPreview=targetPreview(crouched,c,t);assert.equal(cPreview.pa,12);assert.doesNotMatch(cPreview.coverNote??'',/Levantarse/);
 const gun=field({weapon:1800,weaponMode:'melee'}),[g,v]=pair(gun),shot=targetPreview(gun,g,v,{mode:'fire'});assert.equal(shot.attackType,'fire');assert.doesNotMatch(shot.coverNote??'',/Levantarse/);assert.doesNotMatch(equippedItemHelp(gun,g,{mode:'fire',target:v}),/Levantarse/);
 const knocked=field({knockedDown:true}),[k,o]=pair(knocked);assert.equal(targetPreview(knocked,k,o).valid,false);assert.match(targetPreview(knocked,k,o).reason,/levantarte/);
});
