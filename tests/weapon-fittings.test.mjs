import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,bladeFor,carriedWeight,contextualAttack,fitBayonetPreview,removeBayonetPreview} from '../game/tactical.js';
import {planFitBayonet,planRemoveBayonet,extractItemQuantity,applyItemQuantity,inventoryUsage,handRecord,validateItemStack} from '../game/tactical-inventory.js';
import {fixedBayonetFor,validateFitting} from '../game/weapon-fittings.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';

const bayonet=(id='socket-1',condition=73)=>({weapon:1811,fittingPattern:'india_socket',instanceId:id,condition});
const loose=(id='socket-1',condition=73)=>({count:1,weight:.5,loaded:0,jammed:false,...bayonet(id,condition)});
function battle(extra={},sector={}){
  const s=createBattle([{id:'p',name:'Portador',x:1,y:3,weapon:1800,weaponInstanceId:'gun-1',condition:66,loaded:1,jammed:true,blade:1811,bladeCondition:73,bladeInstanceId:'socket-1',bladeFittingPattern:'india_socket',ammo:0,medkits:0,rations:0,priming:0,flints:0,torches:0,boleadoras:0,...extra}],{
    id:'fitting-test',width:12,height:8,seed:127,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),
    enemies:[{id:'e',x:3,y:3,weapon:1800,morale:100,overwatch:false},{id:'reserve',x:10,y:7,overwatch:false}],...sector,
  });
  s.units[0].ap=100;return s;
}
function order(s,a){const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,next.lastError);return next;}
function reject(s,a){const old=structuredClone(s),next=actBattle(s,{unitId:'p',...a});assert.ok(next.lastError);assert.deepEqual(s,old);assert.deepEqual(next.units,s.units);assert.equal(next.seed,s.seed);assert.equal(next.elapsedSeconds,s.elapsedSeconds);return next;}

test('fit and remove move one identified secondary item, preserve both conditions and exact assembly weight',()=>{
  const s=battle(),u=s.units[0],weight=carriedWeight(u),before=structuredClone(u);
  const plan=planFitBayonet(u,'blade');assert.deepEqual(u,before);assert.deepEqual(plan.fitting,bayonet());assert.equal(plan.unit.blade,undefined);assert.equal(plan.unit.bladeInstanceId,undefined);
  assert.equal(carriedWeight(plan.unit),weight);assert.equal(plan.unit.condition,66);assert.equal(plan.unit.loaded,1);assert.equal(plan.unit.jammed,true);
  const fitted=order(s,{type:'fitBayonet',item:'blade'});assert.equal(fitted.units[0].ap,88);assert.deepEqual(fitted.units[0].weaponFittings.bayonet,bayonet());
  const removed=order(fitted,{type:'removeBayonet',destination:'blade'});assert.equal(removed.units[0].ap,80);assert.equal(removed.units[0].bladeInstanceId,'socket-1');assert.equal(removed.units[0].bladeCondition,73);assert.equal(removed.units[0].bladeFittingPattern,'india_socket');assert.deepEqual(removed.units[0].weaponFittings,{});assert.equal(carriedWeight(removed.units[0]),weight);
});

test('compatibility and source failures preserve AP, clocks, RNG and ownership',()=>{
  for(const weapon of [1801,1802,1803,1804,1805,1806,1807,1808,1809,1810,1811,1812,1813])reject(battle({weapon,loaded:0}),{type:'fitBayonet',item:'blade'});
  for(const extra of [{bladeFittingPattern:null},{bladeInstanceId:undefined},{bladeCondition:0},{activeSlot:'blade'},{activeSlot:'medical',medkits:1},{weaponDropped:true},{knockedDown:true}])reject(battle(extra),{type:'fitBayonet',item:'blade'});
  for(const item of ['primary','missing','inventory:no-such-item'])reject(battle(),{type:'fitBayonet',item});
  const low=battle();low.units[0].ap=11;reject(low,{type:'fitBayonet',item:'blade'});
});

test('pack source and full-pack removal are atomic; empty secondary can receive a removed fitting',()=>{
  let s=battle({blade:undefined,bladeInstanceId:undefined,bladeFittingPattern:null,inventory:{socket:loose()}});
  s=order(s,{type:'fitBayonet',item:'inventory:socket'});assert.deepEqual(s.units[0].inventory,{});
  s.units[0].inventory={bulk:{count:48,weight:1}};
  assert.equal(inventoryUsage(s.units[0]).used,12);assert.equal(removeBayonetPreview(s,s.units[0],'inventory').valid,false);
  reject(s,{type:'removeBayonet',destination:'inventory'});s=order(s,{type:'removeBayonet',destination:'blade'});assert.equal(s.units[0].bladeInstanceId,'socket-1');
});

test('repeat fitting and occupied secondary removal cannot overwrite or duplicate an item',()=>{
  let s=order(battle(),{type:'fitBayonet',item:'blade'});reject(s,{type:'fitBayonet',item:'blade'});
  s.units[0].blade=1813;reject(s,{type:'removeBayonet',destination:'blade'});
  s=order(s,{type:'removeBayonet',destination:'inventory'});assert.equal(s.units[0].blade,1813);assert.equal(Object.values(s.units[0].inventory)[0].instanceId,'socket-1');reject(s,{type:'removeBayonet',destination:'inventory'});
});

test('close-combat mode thrusts a fixed loaded jammed gun without spending its charge or changing firearm condition',()=>{
  let s=order(order(battle(),{type:'fitBayonet',item:'blade'}),{type:'weaponMode',mode:'melee'}),u=s.units[0],enemy=s.units[1];
  const preview=contextualAttack(s,u,enemy);assert.equal(preview.type,'melee');assert.equal(preview.pa,16);assert.equal(preview.profile.reach,2);
  s=order(s,{type:'useItem',targetId:'e',aim:4});u=s.units[0];assert.equal(u.ap,72);assert.equal(u.loaded,1);assert.equal(u.ammo,0);assert.equal(u.jammed,true);assert.equal(u.condition,66);assert.equal(u.weaponFittings.bayonet.condition,72);assert.equal(s.units[1].hp,57);
});

test('explicit close fire uses firearm cost/readiness and only wears the firearm',()=>{
  let s=order(battle({jammed:false,condition:100,priming:50}),{type:'fitBayonet',item:'blade'});
  assert.equal(contextualAttack(s,s.units[0],s.units[1],{type:'fire',aim:2}).type,'fire');
  assert.equal(contextualAttack(s,s.units[0],{...s.units[1],x:6}).type,'fire');
  s=order(s,{type:'fire',targetId:'e'});assert.equal(s.units[0].loaded,0);assert.equal(s.units[0].condition,99);assert.equal(s.units[0].weaponFittings.bayonet.condition,73);
  const jam=order(battle(),{type:'fitBayonet',item:'blade'});reject(jam,{type:'fire',targetId:'e'});
});

test('loose, broken and stowed bayonets cannot borrow fixed reach or brace',()=>{
  const s=battle({activeSlot:'blade'});assert.equal(bladeFor(s.units[0]).reach,1);assert.equal(bladeFor(s.units[0]).damage,24);reject(s,{type:'melee',targetId:'e'});reject(s,{type:'brace'});
  let fitted=order(battle(),{type:'fitBayonet',item:'blade'});assert.equal(fixedBayonetFor(fitted.units[0]).instanceId,'socket-1');
  fitted=order(fitted,{type:'weapon',slot:'unarmed'});assert.equal(fixedBayonetFor(fitted.units[0]),null);assert.equal(bladeFor(fitted.units[0]).id,0);reject(fitted,{type:'brace'});
  const broken=order(battle(),{type:'fitBayonet',item:'blade'});broken.units[0].weaponFittings.bayonet.condition=0;assert.equal(fixedBayonetFor(broken.units[0]),null);reject(broken,{type:'brace'});assert.equal(removeBayonetPreview(broken,broken.units[0],'blade').valid,true);
});

test('a fitting wears through its last committed thrust and then permits only stock melee',()=>{
  let s=order(order(battle({bladeCondition:1}),{type:'fitBayonet',item:'blade'}),{type:'weaponMode',mode:'melee'});s=order(s,{type:'useItem',targetId:'e'});assert.equal(s.units[0].weaponFittings.bayonet.condition,0);assert.equal(fixedBayonetFor(s.units[0]),null);assert.notEqual(bladeFor(s.units[0]).id,1811);reject(s,{type:'melee',targetId:'e'});
});

test('hand extraction and pack transfer retain the complete assembly and loaded charge weight once',()=>{
  const unit=planFitBayonet(battle().units[0],'blade').unit,weight=carriedWeight(unit),stack=handRecord(unit,'primary');
  const extracted=extractItemQuantity(unit,'primary');assert.deepEqual(extracted.stack.fittings,unit.weaponFittings);assert.deepEqual(extracted.unit.weaponFittings,{});
  const stored=applyItemQuantity(extracted.unit,extracted.stack);assert.equal(carriedWeight(stored),weight);assert.equal(inventoryUsage(stored).used,1);assert.equal(stack.weight,4);assert.equal(stack.fittings.bayonet.condition,73);
  assert.throws(()=>applyItemQuantity(unit,extracted.stack),/identificado/);
  assert.throws(()=>applyItemQuantity(unit,{item:'weapon',...loose()}),/identificado/);
});

test('ordinary drop, pickup, equip and host swap preserve the fitting identity and separate conditions',()=>{
  let s=order(battle(),{type:'fitBayonet',item:'blade'});s=order(s,{type:'drop',item:'primary'});
  assert.equal(s.groundItems[0].fittings.bayonet.instanceId,'socket-1');assert.deepEqual(s.units[0].weaponFittings,{});
  s=order(s,{type:'loot',groundId:s.groundItems[0].id});assert.equal(s.groundItems[0].count,0);
  const key=Object.keys(s.units[0].inventory)[0];s=order(s,{type:'equipLoot',inventoryKey:key});assert.equal(s.units[0].weaponFittings.bayonet.condition,73);assert.equal(s.units[0].condition,66);assert.equal(s.units[0].jammed,true);
  s.units[0].inventory.other={count:1,weapon:1805,weight:1.2,loaded:0,condition:42,instanceId:'other-gun'};
  s=order(s,{type:'equipLoot',inventoryKey:'other'});assert.deepEqual(s.units[0].weaponFittings,{});assert.equal(Object.values(s.units[0].inventory)[0].fittings.bayonet.instanceId,'socket-1');
});

test('exploration fitting consumes real handling time without AP refill and retains completed ownership on collapse',()=>{
  let s=battle({hp:15,maxHp:100,bleeding:1},{exploration:true,enemies:[]});s.bleedSeconds=5;
  const ap=s.units[0].ap;s=order(s,{type:'fitBayonet',item:'blade'});assert.equal(s.elapsedSeconds,1);assert.equal(s.units[0].hp,14);assert.equal(s.units[0].unconscious,true);assert.equal(s.units[0].ap,0);assert.ok(ap>0);assert.equal(s.units[0].weaponFittings.bayonet.instanceId,'socket-1');
});

test('fit/remove previews share reducer gates without mutating their source',()=>{
  const s=battle(),before=structuredClone(s),preview=fitBayonetPreview(s,s.units[0],'blade');assert.equal(preview.valid,true);assert.equal(preview.pa,12);assert.deepEqual(preview.fitting,bayonet());assert.deepEqual(s,before);
  s.phase='interrupt';s.interrupt={unitIds:[]};assert.equal(fitBayonetPreview(s,s.units[0],'blade').valid,false);
});

test('AI pays to fit a real compatible item before choosing a separate melee strike',()=>{
  let s=battle(),enemy=s.units[1];Object.assign(enemy,{weapon:1800,weaponFittings:{},blade:1811,bladeCondition:60,bladeInstanceId:'enemy-socket',bladeFittingPattern:'india_socket',activeSlot:'primary',ap:80,loaded:0,ammo:0,jammed:false});
  const original=structuredClone(s),choice=chooseEnemyAction(s,enemy);assert.deepEqual(choice,{type:'fitBayonet',unitId:'e',item:'blade'});assert.deepEqual(s,original);
  enemy.bladeFittingPattern=null;assert.notEqual(chooseEnemyAction(s,enemy)?.type,'fitBayonet');
});

test('nested fitting schema rejects counterfeit patterns, duplicate identities and malformed assemblies',()=>{
  assert.throws(()=>validateFitting({...bayonet(),loaded:1},1800));assert.throws(()=>validateFitting(bayonet(),1801));
  for(const fittingPattern of ['constructor','__proto__','universal',{},null])assert.throws(()=>validateItemStack({item:'weapon',...loose(),fittingPattern,...(fittingPattern===null?{fittings:{bayonet:{...bayonet(),fittingPattern}}}: {})}));
  assert.throws(()=>validateItemStack({item:'weapon',count:2,weapon:1800,weight:4,fittings:{bayonet:bayonet()}}));
  assert.throws(()=>validateItemStack({item:'weapon',count:1,weapon:1800,weight:4,instanceId:'socket-1',fittings:{bayonet:bayonet()}}));
  assert.throws(()=>validateItemStack({item:'weapon',count:1,weapon:1800,weight:0,fittings:{bayonet:bayonet()}}));
});

test('deployment fitting ownership is detached from its campaign request',()=>{
  const player={id:'issued',weapon:1800,weaponFittings:{bayonet:bayonet('issued-socket')}};
  const enemy={id:'enemy-issued',weapon:1800,weaponFittings:{bayonet:bayonet('enemy-issued-socket')}};
  const before=structuredClone({player,enemy});
  const deployment=createBattle([player],{deferContact:true,enemies:[enemy]});
  // The authoritative deployment can later wear or remove these items during
  // initial contact as well as ordinary turns. Its issue records stay historical.
  deployment.units[0].weaponFittings.bayonet.condition--;
  delete deployment.units[1].weaponFittings.bayonet;
  assert.deepEqual({player,enemy},before);
});
