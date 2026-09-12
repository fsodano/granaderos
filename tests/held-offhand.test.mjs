import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,equipLootPreview,carriedWeight,stealPreview} from '../game/tactical.js';
import {handLayout} from '../game/hand-layout.js';import {inventoryUsage,transferItemQuantity} from '../game/tactical-inventory.js';
import {handSlots} from '../game/ja2-hud.js';import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';import {sectorInventoryModel} from '../game/sector-inventory.js';import {enterSector} from '../game/world.js';import {encodeSave,decodeSave} from '../game/save.js';import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
const field=(unit={},options={})=>createBattle([{id:'p',name:'Vigía',x:2,y:2,weapon:1805,loaded:1,ammo:8,blade:0,...unit}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:3,y:2,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}],...options});
const order=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const hold=(b,item)=>order(b,{type:'equipLoot',slot:'offhandItem',inventoryKey:item});
const reject=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.equal(n.seed,b.seed);assert.equal(n.elapsedSeconds,b.elapsedSeconds);};
const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const tool=(id='key')=>({kind:'tool',toolKey:'key',keyId:'gate',count:1,weight:.2,condition:57,instanceId:id});

test('a small gun shares its hands with one real dressing while the displaced blade uses a pocket',()=>{
 let b=field({blade:1813,medkits:1}),u=b.units[0],weight=carriedWeight(u);assert.equal(handLayout(u).left,'blade');b=hold(b,'medkits');u=b.units[0];assert.equal(u.ap,96);assert.equal(u.medkits,1);assert.equal(u.loaded,1);assert.equal(carriedWeight(u),weight);assert.equal(handLayout(u).left,'medkits');assert.ok(inventoryUsage(u).items.some(i=>i.item==='blade'));assert.ok(!inventoryUsage(u).items.some(i=>i.item==='medkits'));assert.doesNotThrow(()=>validateBattleSnapshot(b));
 b=order(b,{type:'fire',targetId:'e'});assert.equal(b.units[0].medkits,1);assert.equal(handLayout(b.units[0]).left,'medkits');assert.equal(b.units[0].loaded,0);
});
test('the second-hand dressing becomes the active medical item and treats the wound through ordinary use',()=>{
 let b=field({medkits:1,hp:80,maxHp:100,bleeding:4,medical:80});b=hold(b,'medkits');const action=handSlots(b,b.units[0])[1].action;assert.deepEqual(action,{type:'weapon',slot:'medical'});b=order(b,action);assert.equal(b.units[0].leftHandItem,null);assert.equal(handLayout(b.units[0]).right,'medkits');assert.equal(handLayout(b.units[0]).left,null);b=order(b,{type:'useItem',targetId:'p'});assert.ok(b.units[0].bleeding<4);assert.equal(b.units[0].hp,80);assert.equal(b.units[0].medkits,0);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('long guns block second-hand placement, and changing to a long gun must fit the displaced object',()=>{
 const b=field({weapon:1800,medkits:1});reject(b,{type:'equipLoot',slot:'offhandItem',inventoryKey:'medkits'});assert.match(equipLootPreview(b,b.units[0],'medkits','offhandItem').reason,/dos manos/);
 // The long gun is packed while the dressings are in the main hand. The single large slot it frees is needed by the displaced second-hand garment.
 let n=field({weapon:1800,activeSlot:'medical',medkits:1,inventory:{coat:{kind:'outfit',outfit:'poncho',count:1,weight:2,condition:43}}});n=hold(n,'inventory:coat');n=order(n,{type:'weapon',slot:'primary'});assert.equal(handLayout(n.units[0]).twoHanded,true);assert.equal(handLayout(n.units[0]).left,null);assert.equal(n.units[0].leftHandItem,null);assert.ok(inventoryUsage(n.units[0]).items.some(i=>i.item==='inventory:coat'));
});
test('pack identity and condition remain in one record when an arbitrary object is held, passed, or dropped',()=>{
 let b=field({inventory:{keepsake:{count:1,weight:.3,condition:44,instanceId:'keepsake'}}});b=hold(b,'inventory:keepsake');assert.equal(handLayout(b.units[0]).left,'inventory:keepsake');assert.equal(inventoryUsage(b.units[0]).items.some(i=>i.item==='inventory:keepsake'),false);assert.deepEqual(handSlots(b,b.units[0])[1].action,{type:'weapon',slot:'item',item:'inventory:keepsake'});
 const moved=transferItemQuantity(b.units[0],{id:'q',weapon:0,inventory:{}},'inventory:keepsake');assert.equal(moved.source.leftHandItem,null);assert.equal(moved.source.inventory.keepsake,undefined);assert.equal(moved.target.inventory.keepsake.instanceId,'keepsake');assert.equal(moved.target.inventory.keepsake.condition,44);
 b=order(b,{type:'drop',item:'inventory:keepsake'});assert.equal(b.units[0].leftHandItem,null);assert.equal(b.groundItems[0].instanceId,'keepsake');assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('a selected second-hand tool activates the exact tool rather than another tool in the pack',()=>{
 let b=field({inventory:{first:tool('first'),second:{...tool('second'),keyId:'other'}}});b=hold(b,'inventory:second');const hand=handSlots(b,b.units[0])[1];assert.deepEqual(hand.action,{type:'weapon',slot:'tool',toolKey:'inventory:second'});assert.equal(hand.disabled,false);b=order(b,hand.action);assert.equal(b.units[0].activeTool,'inventory:second');assert.equal(b.units[0].leftHandItem,null);assert.equal(b.units[0].inventory.second.instanceId,'second');assert.equal(inventoryUsage(b.units[0]).items.filter(i=>i.item==='inventory:second').length,0);
});
test('rations and torches use their exact second-hand selection; empty loose ammunition does not occupy a hand',()=>{
 let b=field({rations:1,torches:1});b=hold(b,'torches');assert.equal(handSlots(b,b.units[0])[1].action.supplyKey,'torches');b=order(b,handSlots(b,b.units[0])[1].action);b=order(b,{type:'useItem',x:3,y:3});assert.equal(b.units[0].torches,0);assert.equal(b.lights.length,1);assert.equal(b.units[0].leftHandItem,null);
 b=field({ammo:1,loaded:0});b=hold(b,'ammo');b=order(b,{type:'reload'});assert.equal(b.units[0].ammo,0);assert.equal(handLayout(b.units[0]).left,null);assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('full pockets reject stowing atomically; bare-hand theft requires the second hand to be empty',()=>{
 const b=field({activeSlot:'unarmed',ammo:240,priming:0,flints:0,rations:0,torches:0,boleadoras:0,medkits:1,weapon:0,leftHandItem:'medkits'});assert.equal(inventoryUsage(b.units[0]).overloaded,false);reject(b,{type:'equipLoot',slot:'offhandItem',inventoryKey:null});assert.equal(stealPreview(b,b.units[0],b.units[1]).valid,false);assert.match(stealPreview(b,b.units[0],b.units[1]).reason,/manos libres/);
 const low=field({medkits:1});low.units[0].ap=3;reject(low,{type:'equipLoot',slot:'offhandItem',inventoryKey:'medkits'});reject(field(),{type:'equipLoot',slot:'offhandItem',inventoryKey:'primary'});reject(field(),{type:'equipLoot',slot:'offhandItem',inventoryKey:'inventory:missing'});
});
test('second-hand choices reject forged weapon aliases and survive campaign return, map changes and reentry',()=>{
 const bad=field({inventory:{token:{count:1,weight:.1}}});bad.units[0].leftHandItem='token';assert.throws(()=>validateBattleSnapshot(bad));bad.units[0].leftHandItem='primary';assert.throws(()=>validateBattleSnapshot(bad));bad.units[0].leftHandItem='inventory:gun';bad.units[0].inventory.gun={count:1,weight:4,weapon:1800};assert.throws(()=>validateBattleSnapshot(bad));
 let c=step(initialCampaign(8),{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});c=step(c,{type:'visitSector'});let b=enterSector(c.pendingBattle);const id='1000';b=actBattle(b,{type:'weapon',unitId:id,slot:'medical'});assert.equal(b.lastError,null);b=actBattle(b,{type:'equipLoot',unitId:id,slot:'offhandItem',inventoryKey:'rations'});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id===id).leftHandItem,'rations');
 c=step(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.operativeState[1000].leftHandItem,'rations');assert.equal(playerKnownCampaign(c).operatives.find(u=>u.id===1000).leftHandItem,'rations');c=decodeSave(encodeSave(c)).campaign;
 let m=sectorInventoryModel(c,'retiro',rosterFor(c),1000),row=m.carried.find(r=>r.item==='rations');assert.equal(row.offhand.valid,true);c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',...row.offhand.action});assert.equal(c.operativeState[1000].leftHandItem,null);m=sectorInventoryModel(c,'retiro',rosterFor(c),1000);row=m.carried.find(r=>r.item==='torches');c=step(c,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',...row.offhand.action});assert.equal(c.operativeState[1000].leftHandItem,'torches');
 c=step(c,{type:'visitSector'});b=enterSector(c.pendingBattle,c.sectorStates.retiro);assert.equal(handLayout(b.units.find(u=>u.id===id)).left,'torches');assert.equal(playerKnownBattle(b).units.find(u=>u.id===id).leftHandItem,'torches');assert.deepEqual(decodeSave(encodeSave(c,b)).battle,b);
});
test('exploration placement spends time, preserves AP, and moves one item out of its pocket count',()=>{
 let b=field({medkits:2},{exploration:true,enemies:[]});const ap=b.units[0].ap;b=hold(b,'medkits');assert.equal(b.units[0].ap,ap);assert.ok(b.elapsedSeconds>0);assert.equal(inventoryUsage(b.units[0]).items.find(i=>i.item==='medkits').count,1);assert.equal(b.units[0].medkits,2);b=hold(b,null);assert.equal(inventoryUsage(b.units[0]).items.find(i=>i.item==='medkits').count,2);
});

test('the free-hands choice puts away a selected second-hand item even when the main hand was already empty',()=>{
 let b=field({weapon:0,activeSlot:'unarmed',medkits:1});b=hold(b,'medkits');assert.equal(handLayout(b.units[0]).left,'medkits');const ap=b.units[0].ap;b=order(b,{type:'weapon',slot:'unarmed'});assert.equal(b.units[0].ap,ap-4);assert.deepEqual(handLayout(b.units[0]).held,[]);assert.equal(b.units[0].leftHandItem,null);assert.equal(b.units[0].medkits,1);
});
