import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {targetPreview,pickupSelection} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');
const {default:JA2LootPicker}=await import('../web/app/JA2LootPicker.tsx');

const variants=[['fire',{weapon:1805,loaded:1,ammo:5}],['melee',{weapon:1800,weaponMode:'melee',loaded:1,ammo:5}]];
function field(actor={},bodyFirst=true){
 const corpse={id:'body',name:'Caído',x:3,y:2,hp:0,weapon:1800,ammo:7,patrol:false,overwatch:false};
 const live={id:'live',name:'Realista vivo',x:3,y:2,hp:100,weapon:1809,agility:0,dexterity:0,experienceLevel:1,patrol:false,overwatch:false};
 const state=createBattle([{id:'p',name:'Granadero',x:2,y:2,facing:2,marksmanship:100,strength:100,dexterity:100,agility:100,experienceLevel:10,...actor}],{
  width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),
  enemies:[...(bodyFirst?[corpse,live]:[live,corpse]),{id:'reserve',x:10,y:6,patrol:false,overwatch:false}],
 });
 state.units[0].ap=100;for(const unit of state.units.filter(unit=>unit.side==='enemy'))unit.ap=0;
 return state;
}
const person=(state,id)=>state.units.find(unit=>unit.id===id);
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('a living enemy over a corpse retains attack previews and public orders regardless of unit order',()=>{
 for(const [attackType,actor]of variants)for(const bodyFirst of [true,false]){
  const state=field(actor,bodyFirst),unit=person(state,'p'),target=person(state,'live'),before=structuredClone(state);
  for(const point of [target,{x:target.x,y:target.y}])for(const mode of ['move','useItem']){
   const preview=targetPreview(state,unit,point,{mode});
   assert.equal(preview.name,target.name);assert.equal(preview.attackType,attackType);assert.equal(preview.valid,true,preview.reason);
   assert.deepEqual(pickupSelection(state,unit,point,{mode}),[]);
  }
  const publicTarget=playerKnownBattle(state).orders.find(order=>order.unitId===unit.id).targets.find(row=>row.targetId===target.id);
  assert.equal(publicTarget.name,target.name);assert.equal(publicTarget.attackType,attackType);assert.equal(publicTarget.valid,true);
  assert.deepEqual(state,before,'inspecting a shared cell does not mutate either person');
 }
});

test('explicit corpse and equipment selections remain available beside a living enemy',()=>{
 for(const bodyFirst of [true,false]){
  const state=field(variants[0][1],bodyFirst),unit=person(state,'p'),body=person(state,'body'),live=person(state,'live');
  for(const point of [body,{x:body.x,y:body.y,loot:true}]){
   assert.equal(pickupSelection(state,unit,point).length,1);
   assert.equal(targetPreview(state,unit,point).actionLabel,'Elegir qué recoger');
  }
  assert.equal(pickupSelection(state,unit,{x:body.x,y:body.y},{mode:'loot'}).length,1);
  assert.equal(targetPreview(state,unit,live,{mode:'loot'}).actionLabel,'Quitar arma');
  assert.equal(targetPreview(state,unit,live,{mode:'move',itemIntent:'steal'}).actionLabel,'Quitar arma');
 }
});

for(const [attackType,actor]of variants)test(`mounted normal click on a living enemy over a corpse performs ${attackType} against the selected identity`,async t=>{
 let battle=field(actor),commits=[];
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true});
 const scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalSceneControls);
 const before=structuredClone(battle),target=person(before,'live');
 const expected=actBattle(before,{unitId:'p',type:'useItem',targetId:target.id,hitLocation:'torso'});
 assert.equal(expected.lastError,null);
 await mounted.act(async()=>scene().props.onTile(target));await mounted.settle();await mounted.render(props());
 assert.equal(commits.length,1,'a normal target click commits an attack');assert.equal(battle.lastError,null);
 assert.equal(nodes(mounted.tree()).some(node=>node.type===JA2LootPicker),false,'the attack does not open the equipment picker');
 assert.deepEqual(battle,expected,'the controller retains the living targetId through the actual order');
 assert.equal(person(battle,'body').hp,0);assert.deepEqual(person(battle,'body').inventory,person(before,'body').inventory);
 assert.ok(person(battle,'p').ap<person(before,'p').ap);
 if(attackType==='fire')assert.equal(person(battle,'p').loaded,0);else assert.ok(person(battle,'live').hp<target.hp);
});
