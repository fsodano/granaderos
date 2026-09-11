import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,lootBatchPreview} from '../game/tactical.js';
import {lootBatchSelectionModel,nearbyLootOptions} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';

const empty={ammo:0,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,inventory:{}};
function field(actor={},extra={}){
  const s=createBattle([{id:'p',x:2,y:2,facing:2,...empty,...actor}],{width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0})),enemies:[{id:'body',x:3,y:2,hp:0,...empty,ammo:19,weapon:1800,loaded:1,condition:67,jammed:true,weaponInstanceId:'body-gun',weaponFittings:{bayonet:{weapon:1811,condition:43,fittingPattern:'india_socket',instanceId:'body-fitting'}},patrol:false},{id:'guard',x:14,y:8,patrol:false,overwatch:false}],...extra});
  s.units[0].ap=actor.ap??100;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;
  s.groundItems=[{id:'rounds',type:'item',item:'ammo',count:12,weight:.04,x:3,y:2},{id:'dressings',type:'item',item:'medkits',count:3,weight:.2,x:3,y:2}];
  return s;
}
const batch=(s,items)=>actBattle(s,{type:'lootBatch',unitId:'p',items});
const items=[{targetId:'body',item:'ammo',count:4},{groundId:'rounds',count:3},{groundId:'dressings',count:2},{targetId:'body',item:'weapon',count:1}];
function unchanged(s,selections){const n=batch(s,selections);assert.ok(n.lastError);for(const key of ['units','groundItems','droppedWeapons','seed','elapsedSeconds'])assert.deepEqual(n[key],s[key],key);}

test('one batch takes exact body and ground quantities for one pickup cost without equipping the recovered gun',()=>{
  const s=field(),before=structuredClone(s),preview=lootBatchPreview(s,s.units[0],items),n=batch(s,items);
  assert.equal(preview.valid,true);assert.equal(preview.pa,8);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,92);assert.equal(n.units[0].ammo,7);assert.equal(n.units[0].medkits,2);assert.equal(n.units[1].ammo,15);assert.equal(n.groundItems[0].count,9);assert.equal(n.groundItems[1].count,1);
  const gun=Object.values(n.units[0].inventory).find(item=>item.instanceId==='body-gun');assert.equal(gun.loaded,1);assert.equal(gun.condition,67);assert.equal(gun.jammed,true);assert.equal(gun.fittings.bayonet.instanceId,'body-fitting');assert.equal(gun.fittings.bayonet.condition,43);
  assert.equal(n.units[1].weaponDropped,true);assert.equal(n.units[1].weaponInstanceId,undefined);assert.deepEqual(n.units[1].weaponFittings,{});assert.equal(n.units[0].activeSlot,s.units[0].activeSlot);assert.equal(n.units[0].weapon,s.units[0].weapon);assert.equal(n.elapsedSeconds,6);assert.equal(n.seed,s.seed);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('a late capacity failure rolls back earlier otherwise valid selections',()=>{
  const s=field({ammo:220});
  const first=[{groundId:'rounds',count:1}],last=[{targetId:'body',item:'weapon',count:1}];
  assert.equal(lootBatchPreview(s,s.units[0],first).valid,true);assert.equal(lootBatchPreview(s,s.units[0],last).valid,false);
  unchanged(s,[...first,...last]);assert.equal(Boolean(s.units[1].weaponDropped),false);assert.equal(s.groundItems[0].count,12);
});

test('two selections that fit alone must also fit as a complete set',()=>{
  const s=field({ammo:220});s.groundItems=[{id:'a',type:'item',item:'medkits',count:1,weight:.2,x:3,y:2},{id:'b',type:'item',item:'rations',count:1,weight:.5,x:3,y:2}];
  const first={groundId:'a',count:1},second={groundId:'b',count:1};assert.equal(lootBatchPreview(s,s.units[0],[first]).valid,true);assert.equal(lootBatchPreview(s,s.units[0],[second]).valid,true);assert.equal(lootBatchPreview(s,s.units[0],[first,second]).valid,false);unchanged(s,[first,second]);
});

test('duplicate sources, body aliases, missing quantities and mixed selectors cannot duplicate equipment',()=>{
  const s=field();for(const selections of [[],null,[items[0],items[0]],[{targetId:'body',item:'weapon',count:1},{targetId:'body',item:'primary',count:1}],[{targetId:'body',item:'all',count:1}],[{groundId:'rounds',targetId:'body',item:'ammo',count:1}],[{groundId:'rounds'}],[{groundId:'rounds',count:0}],[{groundId:'rounds',count:1.5}],[{groundId:'rounds',count:13}],[{groundId:'rounds',count:1,unitId:'body'}],[{dropIndex:-1,count:1}],Array.from({length:1001},()=>items[0])])unchanged(s,selections);
});

test('stale final quantities and sources reject atomically without taking earlier selections',()=>{
  const s=field();unchanged(s,[items[0],{groundId:'gone',count:1}]);unchanged(s,[items[0],{groundId:'dressings',count:4}]);
  const depleted=structuredClone(s);depleted.groundItems[1].count=0;unchanged(depleted,[items[0],{groundId:'dressings',count:1}]);
});

test('batch items must all be at the same visible reachable tile, and the soldier must be able to act',()=>{
  const s=field();s.groundItems[1].y=3;unchanged(s,[{groundId:'rounds',count:1},{groundId:'dressings',count:1}]);
  for(const patch of [{ap:7},{knockedDown:true},{energy:0},{x:1},{facing:6,x:0}])unchanged(field(patch),items);
  const conscious=field();Object.assign(conscious.units[1],{hp:100,unconscious:false});unchanged(conscious,items);
  const departed=field();departed.units[1].fled=true;unchanged(departed,items);
  const trapped=field();trapped.groundItems[1].heldBy='body';unchanged(trapped,items);
});

test('select-all uses each actual stack quantity and stale IDs are not silently replaced',()=>{
  const s=field(),point={x:3,y:2},options=nearbyLootOptions(s,s.units[0],point),selection=Object.fromEntries(options.map(item=>[item.id,item.count]));
  const model=lootBatchSelectionModel(s,s.units[0],point,selection);assert.equal(model.selectedCount,options.length);assert.equal(model.preview.valid,true);assert.equal(model.action.items.find(item=>item.groundId==='rounds').count,12);
  const n=actBattle(s,{unitId:'p',...model.action});assert.equal(n.lastError,null);assert.equal(n.units[0].ammo,31);assert.equal(n.units[0].medkits,3);assert.equal(n.units[0].ap,92);assert.deepEqual(nearbyLootOptions(n,n.units[0],point),[]);
  const stale=lootBatchSelectionModel(n,n.units[0],point,selection);assert.equal(stale.preview.valid,false);assert.match(stale.preview.reason,/ya no está disponible/);assert.equal(lootBatchSelectionModel(s,s.units[0],point,{}).preview.valid,false);
});

test('legacy dropped weapons and loose ground items can be collected together only once',()=>{
  const s=field();s.droppedWeapons=[{x:3,y:2,weapon:1806,loaded:1,condition:29,jammed:true,instanceId:'dropped-pistol',taken:false}];
  const take=[{dropIndex:0,count:1},{groundId:'rounds',count:12}],n=batch(s,take);assert.equal(n.lastError,null);assert.equal(n.droppedWeapons[0].taken,true);assert.equal(n.groundItems[0].count,0);assert.equal(n.units[0].ammo,12);assert.equal(Object.values(n.units[0].inventory).find(item=>item.instanceId==='dropped-pistol').condition,29);unchanged(n,take);
});

test('exploration applies the pickup duration once for a multi-item transaction',()=>{
  const s=field({}, {exploration:true}),n=batch(s,items);assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds,1);assert.equal(n.units[0].ap,100);assert.equal(n.units[0].ammo,7);assert.equal(n.units[0].medkits,2);
});

test('a batch fits within a real saved player interrupt and resumes deterministically',()=>{
  const s=field({x:1,y:1,agility:100,experienceLevel:10},{enemies:[{id:'e',x:7,y:1,weapon:1813,agility:30,experienceLevel:1,patrol:false}]});s.units[1].ap=24;for(const source of s.groundItems)Object.assign(source,{x:2,y:1});
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const selected=[{groundId:'rounds',count:3},{groundId:'dressings',count:2}],n=batch(paused,selected);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,paused.units[0].ap-8);assert.equal(n.phase,'interrupt');
  assert.deepEqual(batch(validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),selected),n);assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(n)))),endTurn(n));
});

test('campaign save and reload keep all sources and receiver after one actual batch',()=>{
  const campaign=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(campaign.lastError,null);let battle=enterSector(campaign.pendingBattle);const actor=battle.units.find(unit=>unit.id==='4');
  battle=actBattle(battle,{type:'drop',unitId:actor.id,item:'ammo',count:2});assert.equal(battle.lastError,null);battle=actBattle(battle,{type:'drop',unitId:actor.id,item:'medkits',count:1});assert.equal(battle.lastError,null);
  const selected=battle.groundItems.filter(item=>item.x===actor.x&&item.y===actor.y&&item.count>0).map(item=>({groundId:item.id,count:item.count}));assert.equal(selected.length,2);
  battle=actBattle(battle,{type:'lootBatch',unitId:actor.id,items:selected});assert.equal(battle.lastError,null);const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle.units,pair.battle.units);assert.deepEqual(saved.battle.groundItems,pair.battle.groundItems);
  assert.ok(actBattle(saved.battle,{type:'lootBatch',unitId:actor.id,items:selected}).lastError);
});
