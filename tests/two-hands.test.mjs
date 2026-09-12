import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,planEquipLoot,planSwapHands,swapHandsPreview,carriedWeight} from '../game/tactical.js';
import {handLayout,handsRequired} from '../game/hand-layout.js';import {inventoryUsage,handRecord,transferItemQuantity} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';import {playerKnownBattle} from '../game/player-known-state.js';import {handSlots,equipmentSlots,nearbyLootOptions} from '../game/ja2-hud.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';import {enterSector} from '../game/world.js';import {syncBattleTime} from '../game/time.js';import {encodeSave,decodeSave} from '../game/save.js';
const pistol=(id='second',extra={})=>({count:1,weapon:1808,weight:1.3,loaded:2,condition:57,jammed:false,instanceId:id,...extra});
const field=(unit={})=>createBattle([{id:'p',name:'Vigía',x:2,y:2,weapon:1805,loaded:1,ammo:8,weaponInstanceId:'first',...unit}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:2,patrol:false,overwatch:false},{id:'reserve',x:18,y:6,patrol:false,overwatch:false}]});
const order=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const reject=(b,a)=>{const n=actBattle(b,{unitId:'p',...a});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.equal(n.seed,b.seed);assert.equal(n.elapsedSeconds,b.elapsedSeconds);};
test('long guns occupy both hands and a blade consumes an actual pocket',()=>{
 const b=field({weapon:1800,blade:1813}),u=b.units[0],layout=handLayout(u);assert.equal(handsRequired(1800),2);assert.equal(layout.right,'primary');assert.equal(layout.left,null);assert.equal(layout.twoHanded,true);assert.deepEqual(layout.stowed,['blade']);assert.ok(inventoryUsage(u).slots.some(p=>p.entry?.item==='blade'));assert.ok(handSlots(b,u)[1].blocked);
});
test('small guns allow a second gun and equipping rejects a long gun in that hand atomically',()=>{
 let b=field({inventory:{pair:pistol(),rifle:pistol('rifle',{weapon:1800,weight:4,loaded:1})}});reject(b,{type:'equipLoot',inventoryKey:'rifle',slot:'offhand'});b=order(b,{type:'equipLoot',inventoryKey:'pair',slot:'offhand'});assert.equal(b.units[0].weapon,1805);assert.deepEqual(b.units[0].offHand,pistol());assert.equal(handLayout(b.units[0]).left,'offhand');assert.equal(inventoryUsage(b.units[0]).items.some(i=>i.item==='offhand'),false);assert.equal(b.units[0].ap,94);
 const long=field({weapon:1800,inventory:{pair:pistol()}});reject(long,{type:'equipLoot',inventoryKey:'pair',slot:'offhand'});
});
test('swapping hands preserves each load, condition and partial reload work, then fires only the selected gun',()=>{
 let b=field({loaded:0,reloadProgress:.5,condition:81,offHand:pistol()});const weight=carriedWeight(b.units[0]);b=order(b,{type:'swapHands'});const u=b.units[0];assert.equal(u.weapon,1808);assert.equal(u.loaded,2);assert.equal(u.condition,57);assert.equal(u.reloadProgress,undefined);assert.equal(u.offHand.loaded,0);assert.equal(u.offHand.reloadProgress,.5);assert.equal(u.offHand.condition,81);assert.equal(u.offHand.instanceId,'first');assert.equal(carriedWeight(u),weight);assert.equal(u.ap,96);
 b=order(b,{type:'fire',targetId:'e'});assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].offHand.loaded,0);b=order(b,{type:'swapHands'});assert.equal(b.units[0].weapon,1805);assert.equal(b.units[0].reloadProgress,.5);assert.equal(b.units[0].offHand.loaded,1);assert.equal(b.units[0].offHand.instanceId,'second');assert.doesNotThrow(()=>validateBattleSnapshot(b));
});
test('a full pack still allows swapping two held pistols, but cannot stow them for empty hands',()=>{
 const b=field({ammo:240,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,offHand:pistol()});assert.equal(inventoryUsage(b.units[0]).free,0);assert.equal(inventoryUsage(b.units[0]).overloaded,false);const n=order(b,{type:'swapHands'});assert.equal(n.units[0].weapon,1808);reject(n,{type:'weapon',slot:'unarmed'});assert.equal(equipmentSlots(n,n.units[0]).find(o=>o.slot==='unarmed').disabled,true);
});
test('holding medical supplies puts the long gun away and removes one held supply from pockets',()=>{
 const b=field({weapon:1800,blade:1813,medkits:1}),n=order(b,{type:'weapon',slot:'medical'}),u=n.units[0];assert.equal(handLayout(u).right,'medkits');assert.equal(handLayout(u).left,'blade');assert.deepEqual(handLayout(u).stowed,['primary']);const items=inventoryUsage(u).items;assert.ok(items.some(i=>i.item==='primary'));assert.ok(!items.some(i=>i.item==='medkits'));assert.equal(u.medkits,1);
});
test('a stowed long gun and its fitted bayonet retain their exact state when the second pistol is selected',()=>{
 const b=field({weapon:1800,activeSlot:'unarmed',loaded:1,condition:61,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'bayonet',condition:73}},offHand:pistol()});const n=order(b,{type:'swapHands'}),u=n.units[0],stored=Object.values(u.inventory).find(i=>i.weapon===1800);assert.equal(u.offHand,undefined);assert.equal(stored.loaded,1);assert.equal(stored.condition,61);assert.equal(stored.fittings.bayonet.instanceId,'bayonet');assert.equal(stored.fittings.bayonet.condition,73);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('second-hand transfers, dropping and corpse loot expose one exact record without copies',()=>{
 const b=field({offHand:pistol()}),target={id:'q',inventory:{}};const transfer=transferItemQuantity(b.units[0],target,'offhand');assert.equal(transfer.source.offHand,undefined);assert.equal(Object.values(transfer.target.inventory)[0].instanceId,'second');assert.deepEqual(b.units[0].offHand,pistol());
 const dropped=order(b,{type:'drop',item:'offhand'});assert.equal(dropped.units[0].offHand,undefined);assert.equal(dropped.groundItems[0].loaded,2);assert.equal(dropped.groundItems[0].condition,57);assert.doesNotThrow(()=>validateBattleSnapshot(dropped));
 const corpse=structuredClone(b);Object.assign(corpse.units[1],{hp:0,unconscious:true,offHand:pistol('enemy-hand'),knownToPlayer:true,x:3});const options=nearbyLootOptions(corpse,corpse.units[0]);assert.ok(options.some(o=>o.action.item==='offhand'));const looted=order(corpse,{type:'loot',targetId:'e',item:'offhand'});assert.equal(looted.units[1].offHand,undefined);assert.equal(Object.values(looted.units[0].inventory).filter(i=>i.instanceId==='enemy-hand').length,1);
});
test('validation rejects impossible and duplicated second-hand records; public state shows only owned contents',()=>{
 const b=field({offHand:pistol()});assert.deepEqual(validateBattleSnapshot(b).units[0].offHand,pistol());const known=playerKnownBattle(b);assert.equal(known.units.find(u=>u.id==='p').offHand.loaded,2);assert.equal(known.units.find(u=>u.id==='p').offHand.instanceId,undefined);assert.equal(known.units.find(u=>u.id==='e')?.offHand,undefined);
 for(const bad of [pistol('first'),pistol('second',{count:2}),pistol('second',{weapon:1800,loaded:1}),pistol('second',{loaded:3}),pistol('second',{weapon:1820,loaded:1}),pistol('second',{reloadProgress:.5})]){const n=structuredClone(b);n.units[0].offHand=bad;assert.throws(()=>validateBattleSnapshot(n));}
 b.units[0].ap=3;assert.equal(handSlots(b,b.units[0])[0].disabled,false);assert.equal(handSlots(b,b.units[0])[1].disabled,true);assert.equal(swapHandsPreview(b,b.units[0]).valid,false);reject(b,{type:'swapHands'});
});
test('a second gun survives an actual campaign return, full save and redeployment with ammunition conserved',()=>{
 const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};let c=step(initialCampaign(),{type:'createOfficer',name:'Juana del Sur',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 c.operativeState[1000].inventory={second:pistol('campaign-second'),third:pistol('campaign-third',{weapon:1805,loaded:0})};c=step(c,{type:'visitSector'});let b=enterSector(c.pendingBattle),u=b.units.find(u=>u.id==='1000');const total=c.resources.cartridges+u.ammo+u.loaded+2;
 b=actBattle(b,{type:'equipLoot',unitId:u.id,inventoryKey:'second',slot:'primary'});assert.equal(b.lastError,null);b=actBattle(b,{type:'equipLoot',unitId:u.id,inventoryKey:'third',slot:'offhand'});assert.equal(b.lastError,null);b=actBattle(b,{type:'swapHands',unitId:u.id});assert.equal(b.lastError,null);let pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;c=step(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.operativeState[1000].offHand.instanceId,'campaign-second');assert.equal(c.operativeState[1000].offHand.loaded,2);
 c=decodeSave(encodeSave(c,null)).campaign;c=step(c,{type:'visitSector'});b=enterSector(c.pendingBattle);u=b.units.find(u=>u.id==='1000');assert.equal(u.offHand.instanceId,'campaign-second');assert.equal(u.offHand.loaded,2);assert.equal(c.resources.cartridges+u.ammo+u.loaded+u.offHand.loaded+Object.values(u.inventory).reduce((n,r)=>n+(r.loaded||0),0),total);assert.doesNotThrow(()=>decodeSave(encodeSave(c,b)));
});
test('dropping or passing a held gun with full pockets keeps the remaining pistol in hand',()=>{
 const b=field({ammo:240,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,offHand:pistol()});
 const n=order(b,{type:'drop',item:'primary'}),u=n.units[0];assert.equal(u.weapon,1808);assert.equal(u.offHand,undefined);assert.equal(u.loaded,2);assert.equal(u.weaponInstanceId,'second');assert.equal(inventoryUsage(u).overloaded,false);assert.equal(n.groundItems[0].instanceId,'first');assert.doesNotThrow(()=>validateBattleSnapshot(n));
 const transfer=transferItemQuantity(b.units[0],{id:'q',inventory:{}},'primary');assert.equal(transfer.source.weaponInstanceId,'second');assert.equal(inventoryUsage(transfer.source).overloaded,false);assert.equal(Object.values(transfer.target.inventory)[0].instanceId,'first');
});
test('replacing the primary gun stores it once and keeps the other pistol through the atomic swap',()=>{
 const b=field({offHand:pistol(),inventory:{replacement:pistol('third',{weapon:1806,loaded:1})}}),n=order(b,{type:'equipLoot',inventoryKey:'replacement',slot:'primary'}),u=n.units[0];assert.equal(u.weaponInstanceId,'third');assert.equal(u.offHand.instanceId,'second');assert.equal(Object.values(u.inventory).filter(r=>r.instanceId==='first').length,1);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
