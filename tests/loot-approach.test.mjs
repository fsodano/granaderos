import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,lootApproachPreview,lootSearchPreview,approachCompleted,lootPreview} from '../game/tactical.js';
import {nearbyLootOptions,pickupSelection,lootSelectionModel,groundLootPiles,targetPreview} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {inventoryUsage} from '../game/tactical-inventory.js';

function field(actor={},extra={}){
  const s=createBattle([{id:'p',x:2,y:2,facing:2,...actor}],{width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0})),enemies:[{id:'guard',x:14,y:8,patrol:false,overwatch:false}],...extra});
  s.units[0].ap=actor.ap??100;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;
  s.groundItems=[{id:'ammo-pile',type:'item',x:6,y:2,item:'ammo',count:12,weight:.04}];return s;
}
const pick={type:'loot',unitId:'p',groundId:'ammo-pile',count:3};
const search={type:'approachLoot',unitId:'p',x:6,y:2};
const soldier=s=>s.units[0];
function rejected(s,action=pick){const n=actBattle(s,action);assert.ok(n.lastError);for(const key of ['units','groundItems','droppedWeapons','seed','elapsedSeconds'])assert.deepEqual(n[key],s[key],key);}

test('a selected ground quantity pays the same movement and pickup as separate legal orders',()=>{
  const s=field(),p=lootApproachPreview(s,soldier(s),pick),before=structuredClone(s);assert.equal(p.pa,32);assert.equal(p.movePa,24);assert.equal(p.actionPa,8);
  const after=actBattle(s,pick),manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),pick);assert.deepEqual(after,manual);assert.equal(after.units[0].ap,68);assert.equal(after.units[0].ammo,15);assert.equal(after.groundItems[0].count,9);assert.equal(after.elapsedSeconds,6);assert.deepEqual(s,before);
});

test('approaching a pile only pays movement and cannot grant its contents or a free equip',()=>{
  const s=field({activeSlot:'medical'}),p=lootSearchPreview(s,soldier(s),search),after=actBattle(s,search);assert.equal(p.pa,24);assert.equal(after.units[0].ap,76);assert.equal(after.units[0].activeSlot,'medical');assert.equal(after.units[0].medkits,2);assert.equal(after.units[0].ammo,s.units[0].ammo);assert.deepEqual(after.groundItems,s.groundItems.map(g=>({...g,knownToPlayer:true})));assert.equal(approachCompleted(s,after,'p',p),true);
  const again=actBattle(after,search);assert.deepEqual(again,after);assert.equal(lootSelectionModel(after,soldier(after),search).preview.pa,8);
});

test('body contents stay hidden at distance, including the difference between empty and full inventories',()=>{
  const s=field({}, {enemies:[{id:'body',x:6,y:2,hp:0,ammo:19,patrol:false},{id:'guard',x:14,y:8,patrol:false}]});s.groundItems=[];
  const empty=structuredClone(s);Object.assign(empty.units[1],{weapon:0,blade:0,loaded:0,ammo:0,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,inventory:{}});
  assert.deepEqual(nearbyLootOptions(s,soldier(s),search),[]);assert.deepEqual(nearbyLootOptions(empty,soldier(empty),search),[]);assert.deepEqual(pickupSelection(s,soldier(s),search),pickupSelection(empty,soldier(empty),search));
  const after=actBattle(s,search),options=nearbyLootOptions(after,soldier(after),search);assert.ok(options.some(item=>item.action.targetId==='body'&&item.action.item==='ammo'&&item.count===19));assert.equal(after.units[1].ammo,19);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(after)));assert.deepEqual(nearbyLootOptions(restored,soldier(restored),search),options);
});

test('full packs can approach and inspect but quantities must fit before pickup',()=>{
  const s=field({ammo:238,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,inventory:{}});assert.equal(inventoryUsage(soldier(s)).used,12);
  const approached=actBattle(s,search);assert.equal(approached.lastError,null);assert.equal(approached.units[0].ap,76);assert.equal(lootSelectionModel(approached,soldier(approached),search,{count:3}).preview.valid,false);rejected(approached);
  const after=actBattle(approached,{...pick,count:2});assert.equal(after.lastError,null);assert.equal(after.units[0].ammo,240);assert.equal(after.groundItems[0].count,10);assert.equal(after.units[0].ap,68);
  rejected(s,pick); // A direct combined pickup also rejects before movement.
});

test('a loaded, jammed and fitted ground weapon retains exact identities and condition through pickup and save',()=>{
  const s=field();s.groundItems=[];s.droppedWeapons=[{x:6,y:2,weapon:1800,loaded:1,condition:41,jammed:true,taken:false,instanceId:'found-gun',fittings:{bayonet:{weapon:1811,condition:39,fittingPattern:'india_socket',instanceId:'found-bayonet'}}}];
  const after=actBattle(s,{type:'loot',unitId:'p',dropIndex:0});assert.equal(after.lastError,null);assert.equal(after.droppedWeapons[0].taken,true);
  const record=Object.values(after.units[0].inventory).find(item=>item.instanceId==='found-gun');assert.ok(record);assert.equal(record.loaded,1);assert.equal(record.condition,41);assert.equal(record.jammed,true);assert.deepEqual(record.fittings,s.droppedWeapons[0].fittings);assert.equal(after.units[0].weapon,s.units[0].weapon);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(after)));assert.deepEqual(restored.units,after.units);rejected(restored,{type:'loot',unitId:'p',dropIndex:0});
});

test('unavailable targets, insufficient AP, invalid quantities, invisibility and restrained movement reject atomically',()=>{
  const short=field({ap:31});assert.equal(lootApproachPreview(short,soldier(short),pick).pa,32);rejected(short);
  for(const patch of [{facing:6},{entangled:true},{knockedDown:true},{energy:0}]){const s=field(patch);rejected(s);rejected(s,search);}
  for(const count of [0,-1,1.5,13])rejected(field(),{...pick,count});
  const taken=field();taken.groundItems[0].count=0;rejected(taken);rejected(taken,search);
  const tangled=field();tangled.groundItems[0].heldBy='guard';rejected(tangled);rejected(tangled,search);
  const enemy=field();rejected(enemy,{...search,unitId:'guard'});
});

test('exploration counts each approach second plus pickup and stops if the soldier collapses',()=>{
  const s=field({}, {exploration:true}),after=actBattle(s,pick);assert.equal(after.elapsedSeconds,10);assert.equal(after.units[0].ap,100);assert.equal(after.groundItems[0].count,9);
  const tired=field({energy:2},{exploration:true}),stopped=actBattle(tired,pick);assert.equal(stopped.units[0].unconscious,true);assert.equal(stopped.units[0].x,4);assert.equal(stopped.groundItems[0].count,12);assert.equal(stopped.elapsedSeconds,6);
});

test('enemy reactions stop both search and combined pickup before inventory changes',()=>{
  const s=field({agility:30,experienceLevel:1},{enemies:[{id:'e',x:5,y:4,facing:0,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});s.units[1].ap=6;
  for(const action of [pick,search]){const after=actBattle(s,action);assert.equal(after.lastError,null);assert.equal(after.units[1].reactionTurn,1);assert.deepEqual(after.groundItems,s.groundItems.map(g=>({...g,knownToPlayer:true})));assert.equal(after.units[0].ammo,s.units[0].ammo);assert.equal(approachCompleted(s,after,'p',lootSearchPreview(s,soldier(s),search)),false);}
});

test('a real saved player interrupt permits search and exact finite pickup within its remaining AP',()=>{
  // Trigger the saved window by movement from a melee-only sabre carrier.
  const s=field({x:1,y:1,agility:100,experienceLevel:10},{enemies:[{id:'e',x:7,y:1,weapon:1809,agility:30,experienceLevel:1,patrol:false}]});s.units[1].ap=24;Object.assign(s.groundItems[0],{x:4,y:4});
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');const after=actBattle(paused,pick);assert.equal(after.lastError,null);assert.equal(after.phase,'interrupt');assert.equal(after.groundItems[0].count,9);assert.equal(after.elapsedSeconds,6);
  assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),pick),after);assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(after)))),endTurn(after));
});

test('ground pile markers merge visible stacks and exclude taken, entangled and unseen equipment',()=>{
  const s=field();s.groundItems.push({...s.groundItems[0],id:'other',item:'medkits',count:1},{...s.groundItems[0],id:'hidden',x:14},{...s.groundItems[0],id:'empty',x:5,count:0},{...s.groundItems[0],id:'caught',x:4,heldBy:'guard'});s.droppedWeapons=[{x:6,y:2,weapon:1800,taken:false},{x:3,y:2,weapon:1800,taken:true}];
  assert.deepEqual(groundLootPiles(s,[soldier(s)]),[{x:6,y:2,count:3}]);assert.deepEqual(pickupSelection(s,soldier(s),{x:14,y:2}),[]);
  const p=targetPreview(s,soldier(s),{x:6,y:2});assert.equal(p.pa,24);assert.equal(p.actionLabel,'Acercarse al equipo');assert.match(p.coverNote,/8 PA adicionales/);
  assert.deepEqual(pickupSelection(s,soldier(s),search,{movementIntent:'preserveFacing'}),[]);
  assert.deepEqual(pickupSelection(s,{...soldier(s),activeSlot:'supply',activeSupply:'torches'},search),[]);
  assert.equal(lootPreview(s,soldier(s),pick).valid,false);
});
